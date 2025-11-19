const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const erpRpcClient = require('../services/erpRpcClient');

// POST neue Bestellung erstellen
router.post('/', async (req, res) => {
  try {
    const { customer, items } = req.body;
    // items = [{ product_id, quantity }, ...]

    console.log('📦 Order creation request received:', { customer, items });

    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing customer or items' });
    }

    // Build enriched items with product names and prices from local DB
    const enrichedItems = [];
    let total = 0;
    for (const item of items) {
      try {
        const productRes = await pool.query('SELECT id, name, price FROM products WHERE id = $1', [item.product_id]);
        if (productRes.rows.length === 0) {
          console.warn(`⚠️  Product ${item.product_id} not found in local DB, will try to use cart-provided name or fall back to placeholder`);
          // Try to get product info from cart item (frontend may provide productName or name)
          const providedName = item.productName || item.product_name || item.name || null;
          const productNameToUse = providedName ? String(providedName) : `Product${item.product_id}`;
          if (providedName) console.log(`ℹ️ Using product name from request for id=${item.product_id}: ${productNameToUse}`);
          enrichedItems.push({ productId: item.product_id, productName: productNameToUse, quantity: item.quantity, price: 0 });
        } else {
          const p = productRes.rows[0];
          const price = parseFloat(p.price);
          enrichedItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, price });
          total += price * item.quantity;
        }
      } catch (dbErr) {
        console.error(`❌ Error fetching product ${item.product_id}:`, dbErr.message);
        // Try to use cart-provided name if available, otherwise fall back to placeholder
        const providedName = item.productName || item.product_name || item.name || null;
        const productNameToUse = providedName ? String(providedName) : `Product${item.product_id}`;
        enrichedItems.push({ productId: item.product_id, productName: productNameToUse, quantity: item.quantity, price: 0 });
      }
    }

    // BEFORE sending order to ERP: check live stock via ERP RPC for all products
    try {
      const productNames = enrichedItems.map(i => i.productName);
      const stockMap = await erpRpcClient.getStocks(productNames);

      // Find insufficient items
      const insufficient = [];
      for (const it of enrichedItems) {
        const available = typeof stockMap[it.productName] === 'number' ? stockMap[it.productName] : 0;
        if (available < it.quantity) {
          insufficient.push({ productName: it.productName, requested: it.quantity, available });
        }
      }

      if (insufficient.length > 0) {
        console.warn('⚠️ Order blocked due to insufficient stock:', insufficient);
        return res.status(409).json({ error: 'Insufficient stock', details: insufficient });
      }
    } catch (stockErr) {
      console.error('❌ Failed to verify stock with ERP before creating order:');
      console.error(stockErr && stockErr.stack ? stockErr.stack : stockErr);

      // Build a safe details object to return to client (avoid exposing stacks in production)
      const errInfo = {
        message: stockErr && stockErr.message ? stockErr.message : String(stockErr),
        code: stockErr && stockErr.code ? stockErr.code : null,
        status: stockErr && stockErr.response && stockErr.response.status ? stockErr.response.status : null,
        erpBody: stockErr && stockErr.response && stockErr.response.data ? stockErr.response.data : null
      };

      return res.status(502).json({ error: 'Failed to verify stock with ERP', details: errInfo });
    }

    // Call ERP to create the purchase order in real-time
    const orderPayload = {
      customer,
      items: enrichedItems,
      total
    };

    console.log('📤 Sending order to ERP:', JSON.stringify(orderPayload, null, 2));

    let erpResp;
    try {
      erpResp = await erpRpcClient.createPurchaseOrder(orderPayload);
      console.log('✅ ERP order created successfully:', erpResp);
    } catch (rpcErr) {
      console.error('❌ ERP RPC failed:', rpcErr.message);
      console.error('Full error:', rpcErr);
      return res.status(502).json({ error: 'Failed to create order in ERP', details: rpcErr.message });
    }

    // ERP should be source of truth; we return ERP response to client.
    // Optionally, the webshop could store a local reference here (not implemented).
    return res.status(201).json({ success: true, erp: erpResp });
  } catch (err) {
    console.error('❌ Unexpected error in order creation:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET alle Orders eines Kunden
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    // Lookup customer's email in local DB
    const custRes = await pool.query('SELECT id, name, email FROM customers WHERE id = $1', [customerId]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const customer = custRes.rows[0];

    // Always fetch orders from ERP (system of record)
    let erpOrders;
    try {
      // First try by email
      erpOrders = await erpRpcClient.getOrdersByCustomerEmail(customer.email);

      // If no results, try variations: lowercased email, exact name, then name contains
      if ((!erpOrders || (Array.isArray(erpOrders) && erpOrders.length === 0)) && customer.email) {
        try {
          const lowerEmail = String(customer.email).toLowerCase();
          if (lowerEmail !== customer.email) {
            console.log(`ℹ️ No ERP orders for email ${customer.email}, trying lowercased email ${lowerEmail}`);
            const byLowerEmail = await erpRpcClient.getOrdersByCustomerEmail(lowerEmail);
            if (byLowerEmail && byLowerEmail.length > 0) erpOrders = byLowerEmail;
          }
        } catch (byEmailLowerErr) {
          console.warn('⚠️ ERP lookup by lowercased email failed:', byEmailLowerErr && byEmailLowerErr.message ? byEmailLowerErr.message : byEmailLowerErr);
        }
      }

      if ((!erpOrders || (Array.isArray(erpOrders) && erpOrders.length === 0)) && customer.name) {
        console.log(`ℹ️ No ERP orders found for email ${customer.email}, trying lookup by name: ${customer.name}`);
        try {
          const byName = await erpRpcClient.getOrdersByCustomerName(customer.name);
          if (byName && Array.isArray(byName) && byName.length > 0) {
            erpOrders = byName;
          } else {
            // try contains (partial match)
            console.log(`ℹ️ No exact name match, trying contains search for: ${customer.name}`);
            const byNameContains = await erpRpcClient.getOrdersByCustomerNameContains(customer.name);
            if (byNameContains && Array.isArray(byNameContains) && byNameContains.length > 0) erpOrders = byNameContains;
          }
        } catch (byNameErr) {
          console.warn('⚠️ ERP lookup by name/contains failed:', byNameErr && byNameErr.message ? byNameErr.message : byNameErr);
        }
      }
    } catch (erpErr) {
      console.error('❌ Failed fetching orders from ERP for', customer.email, erpErr.message || erpErr);

      // ERP unavailable — fallback to local DB orders but signal ERP is unreachable
      try {
        const local = await pool.query(
          `SELECT o.id, o.created_at, o.status, o.total_price,
            json_agg(json_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price, 'name', p.name)) as items
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE o.customer_id = $1
           GROUP BY o.id
           ORDER BY o.created_at DESC`,
          [customerId]
        );

        // Normalize local rows to frontend shape
        const normalizedLocal = (local.rows || []).map(r => ({
          id: r.id,
          created_at: r.created_at,
          status: r.status,
          items: (r.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          total_price: r.total_price
        }));

        return res.json({ erp_unreachable: true, orders: normalizedLocal });
      } catch (localErr) {
        console.error('❌ Failed reading local orders during ERP fallback', localErr.message || localErr);
        return res.status(502).json({ error: 'Failed to fetch orders from ERP and local fallback failed', details: localErr.message || localErr });
      }
    }

    // Normalize ERP orders to the shape the frontend expects
    const mapStatus = (statusVal) => {
      // statusVal might be object, number or string; handle nested shapes and numeric codes
      let code = statusVal;

      if (typeof statusVal === 'object' && statusVal && !Array.isArray(statusVal)) {
        // common possibilities: { status: 30 } or { code: 30 }
        if (statusVal.status !== undefined) code = statusVal.status;
        else if (statusVal.code !== undefined) code = statusVal.code;
      }

      // Accept number or string; coerce to string for switch
      switch (String(code)) {
        case '10': return 'pending';
        case '20': return 'picked';
        case '30': return 'shipped';
        case '40': return 'completed';
        case '-10': return 'canceled';
        case 'new': return 'pending';
        case 'picked': return 'picked';
        case 'shipped': return 'shipped';
        case 'completed': return 'completed';
        case 'canceled': return 'canceled';
        default: return 'pending';
      }
    };

    console.log('ℹ️ Raw ERP orders payload length:', Array.isArray(erpOrders) ? erpOrders.length : 0);
    console.log('ℹ️ Sample ERP order (first):', erpOrders && erpOrders[0] ? JSON.stringify(erpOrders[0], null, 2) : null);

    const normalized = (erpOrders || []).map(o => {
      const id = o.orderID || o.orderId || o.OrderID || o.ID || o.cuid || o.id || null;
      const created_at = o.orderDate || o.createdAt || o.created_at || o._createdAt || null;

      // ERP may expose the status in different fields; prefer structured -> numeric `orderStatus_status` (CAP generated)
      const rawStatus = (o.orderStatus !== undefined)
        ? o.orderStatus
        : (o.orderStatus_status !== undefined ? o.orderStatus_status : (o.order_status !== undefined ? o.order_status : o.status));

      const status = mapStatus(rawStatus);
      const total_price = o.orderAmount || o.total || o.total_price || o.orderTotal || 0;

      const items = (o.items || []).map(it => {
        const prod = it.product || it.product[0] || it.Product || null;
        const name = (prod && (prod.name || prod.productID || prod.productId)) || it.productName || it.name || `product-${it.product}`;
        const quantity = it.quantity || it.qty || it.quantityOrdered || 0;
        const price = it.itemAmount || it.price || it.unitPrice || 0;
        return { name, quantity, price };
      });

      return {
        id,
        created_at,
        status,
        items,
        total_price
      };
    });

    res.json(normalized);
  } catch (err) {
    console.error('❌ Error in GET /customer/:customerId', err.message || err);
    res.status(500).json({ error: err.message || err });
  }
});

// UPDATE Order Status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;