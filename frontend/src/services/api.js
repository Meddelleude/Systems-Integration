import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Products
export const getProducts = () => axios.get(`${API_URL}/products`);
export const getProduct = (id) => axios.get(`${API_URL}/products/${id}`);
export const getProductStocks = (names) => {
  // Batch fetch stock for multiple products
  const namesParam = names.join(',');
  return axios.get(`${API_URL}/products/stocks?names=${encodeURIComponent(namesParam)}`);
};
export const createProduct = (data) => axios.post(`${API_URL}/products`, data);
export const deleteProduct = (id) => axios.delete(`${API_URL}/products/${id}`);
export const syncProductsFromERP = () => axios.post(`${API_URL}/products/sync`);

// Customers
export const registerCustomer = (data) => axios.post(`${API_URL}/customers/register`, data);
export const loginCustomer = (data) => axios.post(`${API_URL}/customers/login`, data);
export const getCustomer = (id) => axios.get(`${API_URL}/customers/${id}`);
export const updateCustomer = (id, data) => axios.put(`${API_URL}/customers/${id}`, data);

// Orders
export const createOrder = (data) => axios.post(`${API_URL}/orders`, data);
export const getCustomerOrders = (customerId) => axios.get(`${API_URL}/orders/customer/${customerId}`);
export const updateOrderStatus = (id, status) => axios.put(`${API_URL}/orders/${id}/status`, { status });