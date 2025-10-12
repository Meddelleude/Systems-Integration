import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { updateCustomer, getCustomerOrders } from '../services/api';

function Profile() {
  const { user, login } = useContext(AppContext);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: user?.address || ''
  });
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

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
      setLoadingOrders(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await updateCustomer(user.id, formData);
      login(response.data);
      setEditing(false);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to update profile');
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

  return (
    <div style={styles.container}>
      <h2>My Profile</h2>
      
      {message && <div style={styles.message}>{message}</div>}
      
      {/* Profile Information Section */}
      <div style={styles.section}>
        <h3>Personal Information</h3>
        {!editing ? (
          <div style={styles.info}>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Address:</strong> {user.address || 'Not provided'}</p>
            
            <button onClick={() => setEditing(true)} style={styles.button}>
              Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label>Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.field}>
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.field}>
              <label>Address:</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                style={styles.input}
              />
            </div>
            
            <div style={styles.buttons}>
              <button type="submit" style={styles.saveButton}>
                Save Changes
              </button>
              <button 
                type="button" 
                onClick={() => setEditing(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Purchase History Section */}
      <div style={styles.section}>
        <h3>Purchase History</h3>
        
        {loadingOrders ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p style={styles.noOrders}>You haven't placed any orders yet.</p>
        ) : (
          <div style={styles.ordersList}>
            {orders.map(order => (
              <div key={order.id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <div>
                    <h4 style={styles.orderTitle}>Order #{order.id}</h4>
                    <p style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <span 
                    style={{
                      ...styles.status,
                      backgroundColor: getStatusColor(order.status)
                    }}
                  >
                    {order.status.toUpperCase()}
                  </span>
                </div>
                
                {order.items && order.items.length > 0 && (
                  <div style={styles.orderItems}>
                    {order.items.map((item, index) => (
                      <div key={index} style={styles.orderItem}>
                        <span>{item.name} × {item.quantity}</span>
                        <span>€{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={styles.orderTotal}>
                  <strong>Total: €{parseFloat(order.total_price).toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  section: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
  },
  info: {
    marginTop: '1rem',
  },
  form: {
    marginTop: '1rem',
  },
  field: {
    marginBottom: '1rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    fontFamily: 'inherit',
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
  buttons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  message: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  noOrders: {
    color: '#666',
    fontStyle: 'italic',
  },
  ordersList: {
    marginTop: '1rem',
  },
  orderCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1rem',
    backgroundColor: '#fafafa',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #e0e0e0',
  },
  orderTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.1rem',
  },
  orderDate: {
    color: '#666',
    fontSize: '0.9rem',
    margin: 0,
  },
  status: {
    color: 'white',
    padding: '0.4rem 0.8rem',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  orderItems: {
    marginBottom: '1rem',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f0f0f0',
  },
  orderTotal: {
    textAlign: 'right',
    fontSize: '1.1rem',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '2px solid #e0e0e0',
  },
};

export default Profile;