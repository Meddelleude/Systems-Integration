import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { getCustomerOrders } from '../services/api';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AppContext);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    try {
      const response = await getCustomerOrders(user.id);
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'shipped': return '#17a2b8';
      case 'completed': return '#28a745';
      default: return '#6c757d';
    }
  };

  if (loading) return <div style={styles.container}>Loading...</div>;

  if (orders.length === 0) {
    return (
      <div style={styles.container}>
        <h2>My Orders</h2>
        <p>You haven't placed any orders yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>My Orders</h2>
      
      {orders.map(order => (
        <div key={order.id} style={styles.orderCard}>
          <div style={styles.orderHeader}>
            <div>
              <h3>Order #{order.id}</h3>
              <p style={styles.date}>
                {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span 
                style={{
                  ...styles.status,
                  backgroundColor: getStatusColor(order.status)
                }}
              >
                {order.status.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div style={styles.orderItems}>
            <h4>Items:</h4>
            {order.items && order.items.map((item, index) => (
              <div key={index} style={styles.item}>
                <span>{item.name} x {item.quantity}</span>
                <span>€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div style={styles.orderTotal}>
            <strong>Total: €{parseFloat(order.total_price).toFixed(2)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  orderCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #eee',
  },
  date: {
    color: '#666',
    fontSize: '0.9rem',
  },
  status: {
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  orderItems: {
    marginBottom: '1rem',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f0f0f0',
  },
  orderTotal: {
    textAlign: 'right',
    fontSize: '1.2rem',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '2px solid #eee',
  },
};

export default Orders;