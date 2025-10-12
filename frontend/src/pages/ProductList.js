import React, { useState, useEffect, useContext } from 'react';
import { getProducts, deleteProduct } from '../services/api';
import { AppContext } from '../context/AppContext';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, user } = useContext(AppContext);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await getProducts();
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
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

  const handleAddToCart = (product) => {
    addToCart(product);
    alert('Product added to cart!');
  };

  if (loading) return <div style={styles.container}>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1>Products</h1>
      
      <div style={styles.grid}>
        {products.map(product => (
          <div key={product.id} style={styles.card}>
            <h3>{product.name}</h3>
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