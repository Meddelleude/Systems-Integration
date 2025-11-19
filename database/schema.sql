
```sql
-- Erstelle die Datenbank
CREATE DATABASE webshop_db;

-- Verbinde dich mit der Datenbank und führe folgendes aus:
-- create order_status

CREATE TABLE order_status_mapping (
  status_code INTEGER PRIMARY KEY,
  status_name VARCHAR(50) NOT NULL,
  description TEXT
);

-- Customers Tabelle
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Tabelle
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Tabelle
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  total_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Tabelle
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);

-- Test-Daten einfügen
INSERT INTO products (name, description, price, stock) VALUES
('Laptop', 'High-performance laptop', 999.99, 10),
('Mouse', 'Wireless mouse', 29.99, 50),
('Keyboard', 'Mechanical keyboard', 79.99, 30);
ALTER TABLE products ADD CONSTRAINT unique_product_name UNIQUE (name);