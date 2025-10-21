const express = require('express');
const router = express.Router();
const erpImportService = require('../services/erpImportService');

// Liste alle Dateien die auf Import warten
router.get('/pending', async (req, res) => {
  try {
    const files = await erpImportService.listPendingFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Importiere eine spezifische Datei
router.post('/import/:filename', async (req, res) => {
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