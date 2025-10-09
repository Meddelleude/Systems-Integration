const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Registrierung
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, address } = req.body;
    
    // Prüfen ob Email schon existiert
    const existing = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Kunde erstellen (Achtung: Passwort sollte in Produktion gehashed werden!)
    const result = await pool.query(
      'INSERT INTO customers (name, email, password, address) VALUES ($1, $2, $3, $4) RETURNING id, name, email, address',
      [name, email, password, address]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT id, name, email, address FROM customers WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Kundeninfo mit Bestellhistorie
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kundeninfo
    const customer = await pool.query(
      'SELECT id, name, email, address FROM customers WHERE id = $1',
      [id]
    );
    
    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Bestellhistorie
    const orders = await pool.query(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    res.json({
      ...customer.rows[0],
      orders: orders.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Kundeninfo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address } = req.body;
    
    const result = await pool.query(
      'UPDATE customers SET name = $1, email = $2, address = $3 WHERE id = $4 RETURNING id, name, email, address',
      [name, email, address, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;