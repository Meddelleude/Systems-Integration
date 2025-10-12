import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

function Cart() {
  const { cart, removeFromCart, updateCartQuantity, getCartTotal, user } = useContext(AppContext);
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!user) {
      alert('Please login to checkout');
      navigate('/login');
      return;
    }
    navigate('/checkout');
  };

  if (cart.length === 0) {
    return (
      <div style={styles.container}>
        <h2>Shopping Cart</h2>
        <p>Your cart is empty</p>
        <button onClick={() => navigate('/')} style={styles.button}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Shopping Cart</h2>
      
      <div style={styles.cartItems}>
        {cart.map(item => (
          <div key={item.id} style={styles.cartItem}>
            <div style={styles.itemInfo}>
              <h3>{item.name}</h3>
              <p style={styles.price}>€{item.price}</p>
            </div>
            
            <div style={styles.itemActions}>
              <div style={styles.quantityControl}>
                <button 
                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                  style={styles.quantityButton}
                >
                  -
                </button>
                <span style={styles.quantity}>{item.quantity}</span>
                <button 
                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                  style={styles.quantityButton}
                >
                  +
                </button>
              </div>
              
              <p style={styles.subtotal}>
                Subtotal: €{(item.price * item.quantity).toFixed(2)}
              </p>
              
              <button 
                onClick={() => removeFromCart(item.id)}
                style={styles.removeButton}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div style={styles.summary}>
        <h3>Total: €{getCartTotal().toFixed(2)}</h3>
        <button onClick={handleCheckout} style={styles.checkoutButton}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  cartItems: {
    marginTop: '2rem',
  },
  cartItem: {
    backgroundColor: 'white',
    padding: '1.5rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  itemInfo: {
    marginBottom: '1rem',
  },
  price: {
    color: '#28a745',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  quantityControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  quantityButton: {
    width: '30px',
    height: '30px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  quantity: {
    padding: '0 1rem',
    fontWeight: 'bold',
  },
  subtotal: {
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  summary: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    marginTop: '2rem',
    textAlign: 'right',
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
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

export default Cart;