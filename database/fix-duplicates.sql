-- Script zur Behebung von Duplikaten in der products-Tabelle

-- Überprüfe die Duplikate
SELECT name, COUNT(*) as count FROM products GROUP BY name HAVING COUNT(*) > 1;

-- Entferne die älteren Duplikate (behalte die neuesten)
DELETE FROM products p1
WHERE id < (
  SELECT MAX(id) FROM products p2 
  WHERE p2.name = p1.name
)
AND name IN (
  SELECT name FROM products GROUP BY name HAVING COUNT(*) > 1
);

-- Füge ein UNIQUE Constraint hinzu
ALTER TABLE products ADD CONSTRAINT unique_product_name UNIQUE (name);

-- Überprüfe das Ergebnis
SELECT id, name, price, stock FROM products ORDER BY name;
