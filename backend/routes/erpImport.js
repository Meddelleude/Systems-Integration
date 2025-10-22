const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const erpImportService = require('../services/erpImportService');

// Liste alle Dateien
router.get('/pending', async (req, res) => {
  try {
    const files = await erpImportService.listPendingFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Lösche eine Datei
router.delete('/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, '../../erp_import', filename);
    
    // Prüfe ob Datei existiert
    await fs.access(filepath);
    
    // Lösche die Datei
    await fs.unlink(filepath);
    
    res.json({
      success: true,
      message: `File ${filename} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Importiere Products
router.post('/import/products/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await erpImportService.importProductFile(filename);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Importiere Customers
router.post('/import/customers/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await erpImportService.importCustomerFile(filename);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
// Importiere Order Status
router.post('/import/orderstatus/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await erpImportService.importOrderStatusFile(filename);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
// Importiere alle ausstehenden Dateien
router.post('/import-all', async (req, res) => {
  try {
    const results = await erpImportService.importAllPending();
    res.json({ 
      results,
      totalFiles: results.length,
      successful: results.filter(r => r.success).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;