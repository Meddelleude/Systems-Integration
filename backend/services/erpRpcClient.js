const axios = require('axios');

const ERP_BASE_URL = process.env.ERP_BASE_URL || process.env.ERP_URL || 'http://localhost:4004';
// Optional basic auth credentials for the ERP dev server (e.g. alice:alice)
const ERP_USER = process.env.ERP_USER || process.env.ERP_USERNAME || 'alice';
const ERP_PASS = process.env.ERP_PASS || process.env.ERP_PASSWORD || 'alice';

console.log(`🔧 ERP Client initialized: ${ERP_BASE_URL} (auth: ${ERP_USER})`);

// Create an axios instance with baseURL and optional basic auth
const axiosInstance = axios.create({
  baseURL: ERP_BASE_URL.replace(/\/$/, ''),
  auth: ERP_USER && ERP_PASS ? { username: ERP_USER, password: ERP_PASS } : undefined,
  timeout: 8000
});

async function retryRequest(fn, attempts = 3, baseDelay = 200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelay * Math.pow(2, i);
      // simple backoff
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = {
  // productIdentifier can be a name or id depending on ERP API; here we use productName
  async getStock(productName) {
    if (!productName) throw new Error('productName required');

    return retryRequest(async () => {
      const path = `/api/stock`;
      const resp = await axiosInstance.get(path, { params: { productName } });
      // Expecting { productName, stock }
      return resp.data;
    });
  },

  // orderPayload: { customer: { name, email, ... } , items: [{ productName, quantity, price }], total }
  async createPurchaseOrder(orderPayload) {
    if (!orderPayload) throw new Error('orderPayload required');

    return retryRequest(async () => {
      const path = `/api/purchase-orders`;
      const resp = await axiosInstance.post(path, orderPayload, { timeout: 8000 });
      // Expecting ERP to return something like { success: true, orderId, status }
      return resp.data;
    });
  },

  // Get all products from ERP (used for sync)
  async getProducts() {
    return retryRequest(async () => {
      const path = `/odata/v4/simple-erp/Products`;
      try {
        console.log(`Trying OData endpoint: ${axiosInstance.defaults.baseURL}${path}`);
        const resp = await axiosInstance.get(path);
        const products = resp.data.value || resp.data;
        console.log(`✅ OData success: received ${Array.isArray(products) ? products.length : 0} products`);
        return products;
      } catch (oDataErr) {
        console.error(`❌ OData failed (${oDataErr.response?.status || oDataErr.code}), aborting`);
        throw oDataErr;
      }
    });
  }
,

  // Fetch orders for a customer by their email from the ERP OData service
  async getOrdersByCustomerEmail(email) {
    if (!email) throw new Error('email required');

    return retryRequest(async () => {
      const path = `/odata/v4/simple-erp/Orders`;
      // Expand customer and items (and product inside items) so we get full info
      const safeEmail = String(email).replace(/'/g, "''");
      const filter = `customer/email eq '${safeEmail}'`;
      // Use nested $expand syntax (items($expand=product)) because
      // navigation paths with slashes (items/product) are not supported by CDS OData parser
      const expand = 'customer,items($expand=product)';

      // Build query string using encodeURIComponent to ensure spaces become %20 (not '+')
      const qs = `$filter=${encodeURIComponent(filter)}&$expand=${encodeURIComponent(expand)}`;
      const url = `${path}?${qs}`;

      const resp = await axiosInstance.get(url, { headers: { Accept: 'application/json' } });
      // OData responses usually return { value: [...] }
      const orders = resp.data.value || resp.data;
      return orders;
    });
  }
,

  // Lightweight ping to check ERP availability
  async ping() {
    try {
      return await retryRequest(async () => {
        // Request a tiny OData payload to verify service is up
        const path = `/odata/v4/simple-erp/Products?$top=1`;
        await axiosInstance.get(path, { headers: { Accept: 'application/json' }, timeout: 3000 });
        return true;
      }, 2, 100);
    } catch (err) {
      return false;
    }
  },

  // Batch fetch stock for multiple products by name (single RPC call)
  async getStocks(productNames) {
    if (!Array.isArray(productNames) || productNames.length === 0) {
      throw new Error('productNames must be a non-empty array');
    }

    return retryRequest(async () => {
      const path = `/api/stock-batch`;
      const resp = await axiosInstance.post(path, { productNames });
      // Expecting { productName: stock, productName2: stock, ... }
      return resp.data;
    });
  }
};
