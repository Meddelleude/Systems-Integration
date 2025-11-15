const express = require('express');
const router = express.Router();
const erpRpcClient = require('../services/erpRpcClient');

// GET /api/erp/status
router.get('/status', async (req, res) => {
  try {
    console.log('GET /api/erp/status called from', req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    const ok = await erpRpcClient.ping();
    console.log('ERP ping result:', !!ok);
    res.json({ reachable: !!ok });
  } catch (err) {
    res.json({ reachable: false, error: err.message });
  }
});

module.exports = router;
