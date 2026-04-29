ALTER TABLE products ADD COLUMN gender VARCHAR(10) DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'kids', 'unisex'));
