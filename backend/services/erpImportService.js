const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

const IMPORT_DIR = path.join(__dirname, '../../erp_import');
const PROCESSED_DIR = path.join(__dirname, '../../erp_import/processed');
const ERROR_DIR = path.join(__dirname, '../../erp_import/errors');

class ERPImportService {
  
  // Verzeichnisse erstellen
  async ensureDirectories() {
    await fs.mkdir(IMPORT_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
    await fs.mkdir(ERROR_DIR, { recursive: true });
  }

  // Validiere Produktdaten
  validateProduct(product) {
    const errors = [];
    
    if (!product.product_id || product.product_id === '') {
      errors.push('Missing product_id');
    }
    
    if (!product.name || product.name.trim() === '') {
      errors.push('Missing or empty product name');
    }
    
    if (!product.price || isNaN(parseFloat(product.price)) || parseFloat(product.price) <= 0) {
      errors.push('Invalid price: must be a positive number');
    }
    
    return errors;
  }

  // Importiere Produkte aus Datei
  async importProductFile(filename) {
    const result = {
      success: false,
      filename: filename,
      imported: 0,
      updated: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      await this.ensureDirectories();
      
      const filepath = path.join(IMPORT_DIR, filename);
      
      // Prüfe ob Datei existiert
      try {
        await fs.access(filepath);
      } catch (err) {
        throw new Error(`File not found: ${filename}`);
      }

      // Datei lesen
      const fileContent = await fs.readFile(filepath, 'utf-8');
      
      // CSV parsen
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });

      if (parsed.errors.length > 0) {
        result.errors.push(`CSV parsing errors: ${JSON.stringify(parsed.errors)}`);
      }

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('No data found in file');
      }

      // Validiere und importiere jedes Produkt
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        
        // Validierung
        const validationErrors = this.validateProduct(row);
        if (validationErrors.length > 0) {
          result.errors.push(`Row ${i + 1}: ${validationErrors.join(', ')}`);
          continue;
        }

        try {
          // Prüfe ob Produkt existiert (nach product_id vom ERP)
          const existing = await pool.query(
            'SELECT id FROM products WHERE id = $1',
            [row.product_id]
          );

          if (existing.rows.length > 0) {
            // Update existierendes Produkt
            await pool.query(
              `UPDATE products 
               SET name = $1, description = $2, price = $3
               WHERE id = $4`,
              [
                row.name.trim(),
                row.description || '',
                parseFloat(row.price),
                row.product_id
              ]
            );
            result.updated++;
          } else {
            // Neues Produkt erstellen
            await pool.query(
              `INSERT INTO products (id, name, description, price, stock)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                row.product_id,
                row.name.trim(),
                row.description || '',
                parseFloat(row.price),
                0 // Stock wird nicht vom ERP übertragen
              ]
            );
            result.imported++;
          }
        } catch (dbError) {
          result.errors.push(`Row ${i + 1} - Database error: ${dbError.message}`);
        }
      }

      result.success = result.errors.length === 0 || (result.imported + result.updated) > 0;

      // Datei verschieben
      if (result.success) {
        // Nach processed/ verschieben
        const processedPath = path.join(PROCESSED_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, processedPath);
      } else {
        // Nach errors/ verschieben
        const errorPath = path.join(ERROR_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, errorPath);
      }

      // Log-Datei erstellen
      const logPath = path.join(
        result.success ? PROCESSED_DIR : ERROR_DIR,
        `${Date.now()}_${filename}.log`
      );
      await fs.writeFile(logPath, JSON.stringify(result, null, 2));

    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${error.message}`);
      
      // Bei fatalen Fehlern auch nach errors/ verschieben
      try {
        const filepath = path.join(IMPORT_DIR, filename);
        const errorPath = path.join(ERROR_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, errorPath);
      } catch (moveError) {
        result.errors.push(`Could not move error file: ${moveError.message}`);
      }
    }

    return result;
  }

  // Liste alle Dateien im Import-Verzeichnis
  async listPendingFiles() {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(IMPORT_DIR);
      
      // Nur CSV-Dateien
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      
      const fileDetails = [];
      for (const file of csvFiles) {
        const filepath = path.join(IMPORT_DIR, file);
        const stats = await fs.stat(filepath);
        fileDetails.push({
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      return fileDetails;
    } catch (error) {
      throw new Error(`Error listing files: ${error.message}`);
    }
  }

  // Automatischer Import aller Dateien
  async importAllPending() {
    const files = await this.listPendingFiles();
    const results = [];
    
    for (const file of files) {
      const result = await this.importProductFile(file.name);
      results.push(result);
    }
    
    return results;
  }
}

module.exports = new ERPImportService();