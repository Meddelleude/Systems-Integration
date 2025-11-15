import React, { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { getProducts, deleteProduct, getProduct, syncProductsFromERP, getProductStocks } from '../services/api';
import { AppContext } from '../context/AppContext';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, user } = useContext(AppContext);
  const location = useLocation();

  useEffect(() => {
    loadProducts();
  }, [location]);

  const loadProducts = async () => {
    try {
      // Step 1: Sync products from ERP (new products added, existing updated with stock/price)
      try {
        console.log('Syncing products from ERP...');
        await syncProductsFromERP();
        console.log('Product sync completed');
      } catch (syncErr) {
        console.warn('ERP sync failed (non-blocking):', syncErr.message);
        // Don't fail completely, continue loading local products
      }

      // Step 2: Load products from local DB (now includes new ERP products)
      const response = await getProducts();
      let productsFromDb = response.data;

      // Step 3: Batch fetch live ERP stock for all products in one RPC call
      try {
        const productNames = productsFromDb.map(p => p.name);
        const stockResp = await getProductStocks(productNames);
        const stockMap = stockResp.data; // { productName: stock, ... }

        // Enrich products with batch stock data
        const productsWithLiveStock = productsFromDb.map(product => {
          const erpStock = stockMap[product.name];
          const stock = typeof erpStock === 'number' ? erpStock : product.stock;
          return {
            ...product,
            stock,
            erpAvailability: { stock },
            inStock: stock > 0
          };
        });

        // Filter out products with 0 stock (ERP source of truth)
        const validProducts = productsWithLiveStock.filter(p => p.stock > 0);
        setProducts(validProducts);
      } catch (batchErr) {
        console.warn('Batch stock fetch failed:', batchErr.message);
        // Fallback: fetch individual stocks if batch fails
        const productsWithLiveStock = await Promise.all(
          productsFromDb.map(async (product) => {
            try {
              const liveResp = await getProduct(product.id);
              const liveData = liveResp.data;
              return {
                ...product,
                stock: typeof liveData.stock === 'number' ? liveData.stock : product.stock,
                erpAvailability: liveData.erpAvailability,
                inStock: liveData.inStock
              };
            } catch (err) {
              console.warn(`Product ${product.id} (${product.name}) error:`, err.message);
              return null;
            }
          })
        );

        const validProducts = productsWithLiveStock.filter(p => p !== null);
        setProducts(validProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleAddToCart = async (product) => {
    try {
      // Fetch real-time stock from backend/ERP before adding
      const resp = await getProduct(product.id);
      const live = resp.data;
      // if erpAvailability could not be determined, be conservative and allow add
      if (live.inStock === false) {
        alert('Product is out of stock (live).');
        return;
      }
      // attach latest stock to product we add
      const toAdd = { ...product, stock: typeof live.stock === 'number' ? live.stock : product.stock };
      addToCart(toAdd);
      alert('Product added to cart!');
    } catch (err) {
      console.error('Error checking live stock:', err);
      alert('Could not verify stock. Please try again.');
    }
  };

  if (loading) return <div style={styles.container}>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1>Products</h1>
      
      <div style={styles.grid}>
        {products.map(product => (
          <div key={product.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{product.name}</h3>
              {product.stock > 0 && (
                <span style={styles.inStockBadge}>IN STOCK</span>
              )}
            </div>
            <p style={styles.description}>{product.description}</p>
            <p style={styles.price}>€{product.price}</p>
            <p style={styles.stock}>Stock: {product.stock}</p>
            
            <div style={styles.buttons}>
              <button 
                onClick={() => handleAddToCart(product)}
                style={styles.addButton}
                disabled={product.stock === 0}
              >
                {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
              </button>
              
              {user && (
                <button 
                  onClick={() => handleDelete(product.id)}
                  style={styles.deleteButton}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginTop: '2rem',
  },
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1.5rem',
    backgroundColor: 'white',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  cardTitle: {
    margin: 0,
    flex: 1,
  },
  inStockBadge: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '0.5rem',
  },
  description: {
    color: '#666',
    margin: '0.5rem 0',
  },
  price: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#28a745',
  },
  stock: {
    color: '#666',
    fontSize: '0.9rem',
  },
  buttons: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    cursor: 'pointer',
    borderRadius: '4px',
  },
};

export default ProductList;
