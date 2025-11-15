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
          console.warn(`⚠️  Product ${item.product_id} not found in local DB, will try to fetch from ERP`);
          // Try to get product info from cart item (frontend may have this)
          // For now, use placeholder values that will be resolved by ERP
          enrichedItems.push({ productId: item.product_id, productName: `Product${item.product_id}`, quantity: item.quantity, price: 0 });
        } else {
          const p = productRes.rows[0];
          const price = parseFloat(p.price);
          enrichedItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, price });
          total += price * item.quantity;
        }
      } catch (dbErr) {
        console.error(`❌ Error fetching product ${item.product_id}:`, dbErr.message);
        // Don't fail completely; let ERP validate
        enrichedItems.push({ productId: item.product_id, productName: `Product${item.product_id}`, quantity: item.quantity, price: 0 });
      }
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
      erpOrders = await erpRpcClient.getOrdersByCustomerEmail(customer.email);
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
      // statusVal might be object, number or string
      const code = (typeof statusVal === 'object' && statusVal && (statusVal.status || statusVal.code))
        ? statusVal.status || statusVal.code
        : statusVal;

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

    const normalized = (erpOrders || []).map(o => {
      const id = o.orderID || o.orderId || o.OrderID || o.ID || o.cuid || o.id || null;
      const created_at = o.orderDate || o.createdAt || o.created_at || o._createdAt || null;
      const status = mapStatus(o.orderStatus);
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