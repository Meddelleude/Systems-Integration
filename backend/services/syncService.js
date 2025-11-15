const pool = require('../config/db');
const erpRpcClient = require('./erpRpcClient');

/**
 * Synchronisiere Produkte vom ERP mit der lokalen Webshop-DB
 * - Neue Produkte vom ERP werden hinzugefügt
 * - Bestehende Produkte werden mit Stock/Price vom ERP aktualisiert
 * - Produkte, die im ERP nicht mehr existieren, werden gelöscht
 */
async function syncProductsFromERP() {
  try {
    console.log('🔄 Starting ERP product sync...');
    
    // Hole Produkte vom ERP
    let erpProducts;
    try {
      erpProducts = await erpRpcClient.getProducts();
    } catch (err) {
      console.error('Failed to fetch products from ERP, attempting manual OData query...');
      // Fallback: direct axios call to OData
      const axios = require('axios');
      const ERP_URL = process.env.ERP_BASE_URL || 'http://localhost:4004';
      const resp = await axios.get(`${ERP_URL.replace(/\/$/, '')}/odata/v4/simple-erp/Products`, { timeout: 5000 });
      erpProducts = resp.data.value || resp.data;
    }

    if (!Array.isArray(erpProducts)) {
      throw new Error(`ERP returned invalid product list (type: ${typeof erpProducts})`);
    }

    console.log(`📦 Received ${erpProducts.length} products from ERP`);

    // Sammle die Namen aller ERP-Produkte
    const erpProductNames = [];

    let upserted = 0;
    for (const erpProd of erpProducts) {
      // ERP-Felder: ID, productID, name, description, price, stock, currency_code
      const name = erpProd.name || erpProd.productID;
      if (!name) {
        console.warn(`⚠️  Skipping product with no name/productID:`, erpProd);
        continue;
      }
      erpProductNames.push(name);
      
      const description = erpProd.description || '';
      const price = parseFloat(erpProd.price) || 0;
      const stock = parseInt(erpProd.stock) || 0;

      try {
        // Prüfe ob Produkt mit diesem Namen bereits existiert
        const existing = await pool.query(
          'SELECT id FROM products WHERE name = $1',
          [name]
        );

        if (existing.rows.length > 0) {
          // Update: Stock und Price vom ERP
          await pool.query(
            'UPDATE products SET price = $1, stock = $2 WHERE name = $3',
            [price, stock, name]
          );
          console.log(`  ✅ Updated: ${name} (stock: ${stock})`);
        } else {
          // Insert: Neues Produkt
          await pool.query(
            'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4)',
            [name, description, price, stock]
          );
          console.log(`  ✅ Inserted: ${name} (stock: ${stock})`);
        }
        upserted++;
      } catch (err) {
        console.error(`  ❌ Error syncing product ${name}:`, err.message);
      }
    }

    // Lösche Produkte, die nicht mehr im ERP existieren
    if (erpProductNames.length > 0) {
      const placeholders = erpProductNames.map((_, i) => `$${i + 1}`).join(',');
      const deleteResult = await pool.query(
        `DELETE FROM products WHERE name NOT IN (${placeholders})`,
        erpProductNames
      );
      
      if (deleteResult.rowCount > 0) {
        console.log(`🗑️  Deleted ${deleteResult.rowCount} products that no longer exist in ERP`);
      }
    } else {
      // Falls keine Produkte im ERP, lösche alle aus der DB
      const deleteAll = await pool.query('DELETE FROM products');
      if (deleteAll.rowCount > 0) {
        console.log(`🗑️  Deleted all ${deleteAll.rowCount} products (ERP has no products)`);
      }
    }

    console.log(`✅ Product sync complete: ${upserted}/${erpProducts.length} products synced`);
    return { success: true, synced: upserted, total: erpProducts.length };
  } catch (err) {
    console.error('❌ ERP sync failed:', err.message);
    console.error('Full error:', err);
    throw err;
  }
}

module.exports = { syncProductsFromERP };
