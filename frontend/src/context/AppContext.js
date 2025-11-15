import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [erpReachable, setErpReachable] = useState(true);

  // User aus localStorage laden
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
    // Check ERP status on startup
    const checkErp = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
        const resp = await fetch(`${apiBase}/api/erp/status`, { cache: 'no-store' });
        const j = await resp.json();
        setErpReachable(!!j.reachable);
      } catch (err) {
        console.warn('ERP status check failed:', err);
        setErpReachable(false);
      }
    };
    checkErp();
    // Poll every 30s
    const interval = setInterval(checkErp, 30000);
    return () => clearInterval(interval);
  }, []);

  // User login
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // User logout
  const logout = () => {
    setUser(null);
    setCart([]);
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
  };

  // Cart Funktionen
  const addToCart = (product, quantity = 1) => {
    const existingItem = cart.find(item => item.id === product.id);
    let newCart;
    
    if (existingItem) {
      newCart = cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      newCart = [...cart, { ...product, quantity }];
    }
    
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const removeFromCart = (productId) => {
    const newCart = cart.filter(item => item.id !== productId);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const newCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <AppContext.Provider value={{
      user,
      login,
      logout,
      cart,
      erpReachable,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      getCartTotal
    }}>
      {children}
    </AppContext.Provider>
  );
};