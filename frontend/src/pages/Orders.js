import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { getCustomerOrders } from '../services/api';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erpUnavailable, setErpUnavailable] = useState(false);
  const { user } = useContext(AppContext);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
    // optional: poll every 20s to keep statuses up-to-date
    const pollInterval = setInterval(() => {
      if (user) loadOrders();
    }, 20000);
    return () => clearInterval(pollInterval);
  }, [user]);

  const loadOrders = async () => {
    try {
      const response = await getCustomerOrders(user.id);
      console.debug('GET /api/orders/customer response:', response);
      const data = response.data;
      console.debug('Parsed orders payload:', data);

      // Backend may return either an array (ERP reachable) or an object when ERP is unreachable
      // { erp_unreachable: true, orders: [...] }
      if (Array.isArray(data)) {
        setOrders(data);
        setErpUnavailable(false);
      } else if (data && data.erp_unreachable) {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setErpUnavailable(true);
      } else if (data && Array.isArray(data.orders)) {
        setOrders(data.orders);
        setErpUnavailable(false);
      } else {
        setOrders([]);
        setErpUnavailable(false);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    console.debug('Manual refresh triggered');
    await loadOrders();
    setLoading(false);
  };

  const getStatusColor = (status) => {
    // status may already be normalized strings (pending,picked,shipped,completed,canceled)
    // or numeric codes as strings/nums. Normalize first.
    const s = String(status).toLowerCase();
    switch (s) {
      case '-10':
      case 'canceled':
      case 'cancelled':
        return '#6c757d'; // gray
      case '10':
      case 'new':
      case 'pending':
        return '#ffc107'; // yellow
      case '20':
      case 'picked':
        return '#17a2b8'; // teal
      case '30':
      case 'shipped':
        return '#007bff'; // blue
      case '40':
      case 'completed':
        return '#28a745'; // green
      default:
        return '#6c757d';
    }
  };

  const getStatusLabel = (status) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case '-10':
      case 'canceled':
      case 'cancelled':
        return 'Canceled';
      case '10':
      case 'new':
      case 'pending':
        return 'New';
      case '20':
      case 'picked':
        return 'Picked';
      case '30':
      case 'shipped':
        return 'Shipped';
      case '40':
      case 'completed':
        return 'Completed';
      default:
        // capitalize word if possible
        return String(status).charAt(0).toUpperCase() + String(status).slice(1);
    }
  };

  if (loading) return <div style={styles.container}>Loading...</div>;

  if (orders.length === 0) {
    return (
      <div style={styles.container}>
        <h2>My Orders</h2>
        <p>{!loading && !orders.length ? 'You have no orders yet.' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>My Orders</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={handleRefresh} style={styles.refreshButton}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        {erpUnavailable && <span style={styles.erpBanner}>ERP unavailable — showing local orders</span>}
      </div>
      
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
                {getStatusLabel(order.status)}
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
  refreshButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  erpBanner: {
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: '0.4rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.9rem'
  }
};

export default Orders;