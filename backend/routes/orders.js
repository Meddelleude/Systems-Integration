const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// POST neue Bestellung erstellen
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { customer_id, items } = req.body;
    // items = [{ product_id, quantity }, ...]
    
    await client.query('BEGIN');
    
    // Gesamtpreis berechnen
    let total = 0;
    for (const item of items) {
      const product = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      total += product.rows[0].price * item.quantity;
    }
    
    // Order erstellen
    const orderResult = await client.query(
      'INSERT INTO orders (customer_id, total_price, status) VALUES ($1, $2, $3) RETURNING *',
      [customer_id, total, 'pending']
    );
    
    const orderId = orderResult.rows[0].id;
    
    // Order Items einfügen
    for (const item of items) {
      const product = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, product.rows[0].price]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET alle Orders eines Kunden
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const orders = await pool.query(
      `SELECT o.*, 
        json_agg(json_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price, 'name', p.name)) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.customer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [customerId]
    );
    
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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