import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import ProductList from './pages/ProductList';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import AddProduct from './pages/AddProduct';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user } = useContext(AppContext);
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function App() {
  return (
    <Router>
      <AppProvider>
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/" element={<ProductList />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cart" element={<Cart />} />
            
            {/* Protected Routes */}
            <Route 
              path="/add-product" 
              element={
                <ProtectedRoute>
                  <AddProduct />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/checkout" 
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </AppProvider>
    </Router>
  );
}

export default App;
