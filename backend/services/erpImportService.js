const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

const IMPORT_DIR = path.join(__dirname, '../../erp_import');
const PROCESSED_DIR = path.join(__dirname, '../../erp_import/processed');
const ERROR_DIR = path.join(__dirname, '../../erp_import/errors');

class ERPImportService {
    async importOrderStatusFile(filename) {
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
      const fileContent = await fs.readFile(filepath, 'utf-8');
      
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('No data found in file');
      }

      console.log(`Processing ${parsed.data.length} order statuses...`);

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        
        if (!row.status || !row.name) {
          continue;
        }

        try {
          const statusCode = parseInt(row.status);
          const statusName = row.name.trim();
          const description = row.descr ? row.descr.trim() : '';

          console.log(`Processing status: ${statusCode} - ${statusName}`);

          // Prüfe ob Status existiert
          const existing = await pool.query(
            'SELECT status_code FROM order_status_mapping WHERE status_code = $1',
            [statusCode]
          );

          if (existing.rows.length > 0) {
            // Update
            await pool.query(
              'UPDATE order_status_mapping SET status_name = $1, description = $2 WHERE status_code = $3',
              [statusName, description, statusCode]
            );
            result.updated++;
            console.log(`  ✅ Updated: ${statusName}`);
          } else {
            // Insert
            await pool.query(
              'INSERT INTO order_status_mapping (status_code, status_name, description) VALUES ($1, $2, $3)',
              [statusCode, statusName, description]
            );
            result.imported++;
            console.log(`  ✅ Imported: ${statusName}`);
          }
        } catch (dbError) {
          const errorMsg = `Row ${i + 2} - Database error: ${dbError.message}`;
          result.errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
        }
      }

      result.success = (result.imported + result.updated) > 0;

      // Datei verschieben
      if (result.success) {
        const processedPath = path.join(PROCESSED_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, processedPath);
        console.log(`✅ File moved to processed/`);
      } else {
        const errorPath = path.join(ERROR_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, errorPath);
        console.log(`❌ File moved to errors/`);
      }

      const logPath = path.join(
        result.success ? PROCESSED_DIR : ERROR_DIR,
        `${Date.now()}_${filename}.log`
      );
      await fs.writeFile(logPath, JSON.stringify(result, null, 2));

    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${error.message}`);
      console.error('❌ Fatal error:', error);
    }

    return result;
  }
  async ensureDirectories() {
    await fs.mkdir(IMPORT_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
    await fs.mkdir(ERROR_DIR, { recursive: true });
  }

  // Validiere Produktdaten
  validateProduct(product) {
    const errors = [];
    
    if (!product.productID || product.productID.trim() === '') {
      errors.push('Missing productID');
    }
    
    if (!product.name || product.name.trim() === '') {
      errors.push('Missing or empty product name');
    }
    
    if (!product.price || product.price === '') {
      errors.push('Missing price');
    }
    
    const price = parseFloat(product.price);
    if (isNaN(price) || price <= 0) {
      errors.push('Invalid price: must be a positive number');
    }
    
    return errors;
  }

  // Validiere Customer Daten
  validateCustomer(customer) {
    const errors = [];
    
    if (!customer.name || customer.name.trim() === '') {
      errors.push('Missing or empty customer name');
    }
    
    if (!customer.email || !customer.email.includes('@')) {
      errors.push('Invalid or missing email');
    }
    
    return errors;
  }

  // Importiere Produkte
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
      const fileContent = await fs.readFile(filepath, 'utf-8');
      
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (parsed.errors.length > 0) {
        console.log('CSV parsing warnings:', parsed.errors);
      }

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('No data found in file');
      }

      console.log(`Processing ${parsed.data.length} products...`);

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        
        // Skip leere Zeilen
        if (!row.productID && !row.name) {
          continue;
        }
        
        const validationErrors = this.validateProduct(row);
        if (validationErrors.length > 0) {
          result.errors.push(`Row ${i + 2}: ${validationErrors.join(', ')}`);
          continue;
        }

        try {
          // ERP Format → Webshop Format
          const productID = row.productID.trim();
          const name = row.name.trim();
          const description = row.description ? row.description.trim() : '';
          const price = parseFloat(row.price);
          const stock = row.stock ? parseInt(row.stock) : 0;

          console.log(`Processing product: ${productID} - ${name} - €${price}`);

          // Prüfe ob Produkt existiert (nach productID)
          const existing = await pool.query(
            'SELECT id FROM products WHERE name = $1',
            [name]
          );

          if (existing.rows.length > 0) {
            // Update existierendes Produkt
            await pool.query(
              `UPDATE products 
               SET description = $1, price = $2, stock = $3
               WHERE name = $4`,
              [description, price, stock, name]
            );
            result.updated++;
            console.log(`  ✅ Updated: ${name}`);
          } else {
            // Neues Produkt erstellen
            await pool.query(
              `INSERT INTO products (name, description, price, stock)
               VALUES ($1, $2, $3, $4)`,
              [name, description, price, stock]
            );
            result.imported++;
            console.log(`  ✅ Imported: ${name}`);
          }
        } catch (dbError) {
          const errorMsg = `Row ${i + 2} - Database error: ${dbError.message}`;
          result.errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
        }
      }

      result.success = (result.imported + result.updated) > 0;

      // Datei verschieben
      if (result.success) {
        const processedPath = path.join(PROCESSED_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, processedPath);
        console.log(`✅ File moved to processed/`);
      } else {
        const errorPath = path.join(ERROR_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, errorPath);
        console.log(`❌ File moved to errors/`);
      }

      // Log-Datei
      const logPath = path.join(
        result.success ? PROCESSED_DIR : ERROR_DIR,
        `${Date.now()}_${filename}.log`
      );
      await fs.writeFile(logPath, JSON.stringify(result, null, 2));

    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${error.message}`);
      console.error('❌ Fatal error:', error);
    }

    return result;
  }

  // Importiere Customers
  async importCustomerFile(filename) {
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
      const fileContent = await fs.readFile(filepath, 'utf-8');
      
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('No data found in file');
      }

      console.log(`Processing ${parsed.data.length} customers...`);

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        
        // Skip leere Zeilen
        if (!row.email && !row.name) {
          continue;
        }
        
        const validationErrors = this.validateCustomer(row);
        if (validationErrors.length > 0) {
          result.errors.push(`Row ${i + 2}: ${validationErrors.join(', ')}`);
          continue;
        }

        try {
          // ERP Format → Webshop Format
          // Adresse zusammensetzen
          const addressParts = [];
          if (row.street) addressParts.push(row.street.trim());
          if (row.houseNumber) addressParts.push(row.houseNumber.trim());
          if (row.postalCode) addressParts.push(row.postalCode.trim());
          if (row.city) addressParts.push(row.city.trim());
          if (row.country_code) addressParts.push(row.country_code.trim());
          
          const address = addressParts.join(', ');
          const name = row.name.trim();
          const email = row.email.trim();

          console.log(`Processing customer: ${name} - ${email}`);

          // Prüfe ob Customer existiert
          const existing = await pool.query(
            'SELECT id FROM customers WHERE email = $1',
            [email]
          );

          if (existing.rows.length > 0) {
            // Update
            await pool.query(
              'UPDATE customers SET name = $1, address = $2 WHERE email = $3',
              [name, address, email]
            );
            result.updated++;
            console.log(`  ✅ Updated: ${name}`);
          } else {
            // Insert mit Standard-Passwort
            await pool.query(
              'INSERT INTO customers (name, email, password, address) VALUES ($1, $2, $3, $4)',
              [name, email, '1234', address]
            );
            result.imported++;
            console.log(`  ✅ Imported: ${name}`);
          }
        } catch (dbError) {
          const errorMsg = `Row ${i + 2} - Database error: ${dbError.message}`;
          result.errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
        }
      }

      result.success = (result.imported + result.updated) > 0;

      // Datei verschieben
      if (result.success) {
        const processedPath = path.join(PROCESSED_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, processedPath);
        console.log(`✅ File moved to processed/`);
      } else {
        const errorPath = path.join(ERROR_DIR, `${Date.now()}_${filename}`);
        await fs.rename(filepath, errorPath);
        console.log(`❌ File moved to errors/`);
      }

      const logPath = path.join(
        result.success ? PROCESSED_DIR : ERROR_DIR,
        `${Date.now()}_${filename}.log`
      );
      await fs.writeFile(logPath, JSON.stringify(result, null, 2));

    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${error.message}`);
      console.error('❌ Fatal error:', error);
    }

    return result;
  }

  // Liste Dateien
async listPendingFiles() {
  try {
    await this.ensureDirectories();
    const files = await fs.readdir(IMPORT_DIR);
    
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    
    const fileDetails = [];
    for (const file of csvFiles) {
      const filepath = path.join(IMPORT_DIR, file);
      const stats = await fs.stat(filepath);
      
      // Erkenne Dateityp (case-insensitive!)
      let type = 'unknown';
      const lowerName = file.toLowerCase();
      
      if (lowerName.includes('product')) {
        type = 'products';
      } else if (lowerName.includes('customer')) {
        type = 'customers';
      } else if (lowerName.includes('orderstatus') || (lowerName.includes('order') && lowerName.includes('status'))) {
        type = 'orderstatus';
      } else if (lowerName.includes('order')) {
        type = 'orders';
      }
      
      fileDetails.push({
        name: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        type: type
      });
    }
    
    return fileDetails;
  } catch (error) {
    throw new Error(`Error listing files: ${error.message}`);
  }
}

  // Import all
async importAllPending() {
  const files = await this.listPendingFiles();
  const results = [];
  
  for (const file of files) {
    let result;
    
    if (file.type === 'products') {
      result = await this.importProductFile(file.name);
    } else if (file.type === 'customers') {
      result = await this.importCustomerFile(file.name);
    } else if (file.type === 'orderstatus') {
      result = await this.importOrderStatusFile(file.name);
    } else {
      result = {
        success: false,
        filename: file.name,
        errors: ['Unknown file type - filename must contain "product", "customer", or "orderstatus"']
      };
    }
    
    results.push(result);
  }
  
  return results;
}
}

module.exports = new ERPImportService();