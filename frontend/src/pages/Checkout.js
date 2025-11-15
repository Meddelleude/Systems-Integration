import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { createOrder } from '../services/api';

function Checkout() {
  const { cart, user, getCartTotal, clearCart } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePlaceOrder = async () => {
    setLoading(true);

    try {
      const orderData = {
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          address: user.address
        },
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };

      const resp = await createOrder(orderData);

      // Backend will return ERP confirmation; show message accordingly
      if (resp && resp.data && resp.data.success) {
        // continue
      } else if (resp && resp.data && resp.data.erp) {
        // accept other ERP-style responses
      }
      clearCart();
      alert('Order placed successfully!');
      navigate('/orders');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div style={styles.container}>
        <h2>Checkout</h2>
        <p>Your cart is empty</p>
        <button onClick={() => navigate('/')} style={styles.button}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Checkout</h2>
      
      <div style={styles.section}>
        <h3>Shipping Information</h3>
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Address:</strong> {user.address || 'No address provided'}</p>
      </div>
      
      <div style={styles.section}>
        <h3>Order Summary</h3>
        {cart.map(item => (
          <div key={item.id} style={styles.orderItem}>
            <span>{item.name} x {item.quantity}</span>
            <span>€{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        
        <div style={styles.total}>
          <strong>Total:</strong>
          <strong>€{getCartTotal().toFixed(2)}</strong>
        </div>
      </div>
      
      <button 
        onClick={handlePlaceOrder} 
        disabled={loading}
        style={styles.placeOrderButton}
      >
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  section: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid #eee',
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1rem 0',
    fontSize: '1.2rem',
    marginTop: '1rem',
  },
  placeOrderButton: {
    width: '100%',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
};

export default Checkout;