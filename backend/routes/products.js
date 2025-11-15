const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const erpRpcClient = require('../services/erpRpcClient');
const { syncProductsFromERP } = require('../services/syncService');

// GET alle Produkte
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Sync products from ERP (called before fetching product list in frontend)
router.post('/sync', async (req, res) => {
  try {
    const result = await syncProductsFromERP();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync products from ERP', details: err.message });
  }
});

// GET ein Produkt
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = result.rows[0];

    // Real-time stock query from ERP when viewing a product
    try {
      const stockResp = await erpRpcClient.getStock(product.name);
      // merge stock info but do not overwrite local price/description
      product.stock = (typeof stockResp.stock === 'number') ? stockResp.stock : product.stock;
      product.erpAvailability = stockResp;
      product.inStock = product.stock > 0;
    } catch (rpcErr) {
      // ERP unavailable; mark as unknown but still return product info
      product.erpAvailability = { error: rpcErr.message };
      product.inStock = null; // unknown
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST neues Produkt
router.post('/', async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, price, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Produkt
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET batch stock for multiple products by name (single ERP RPC call)
router.get('/stocks', async (req, res) => {
  try {
    // Accept ?names=ProductA,ProductB,ProductC
    const namesParam = req.query.names;
    if (!namesParam) return res.status(400).json({ error: 'Missing names query param' });
    const names = namesParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) return res.status(400).json({ error: 'No valid product names' });

    const stockMap = await erpRpcClient.getStocks(names);
    res.json(stockMap);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch batch stocks from ERP', details: err.message });
  }
});

module.exports = router;