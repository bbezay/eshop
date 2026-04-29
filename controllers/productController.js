const pool = require('../config/db');

const getAllProducts = async (req, res) => {
  try {
    const { category, gender, brand, search, minPrice, maxPrice, page, limit, sort } = req.query;

    let query = 'SELECT products.*, categories.category_name FROM products JOIN categories ON products.category_id = categories.id WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND categories.id = $${paramIndex++}`;
      params.push(parseInt(category, 10));
    }

    if (gender) {
      query += ` AND products.gender = $${paramIndex++}`;
      params.push(gender);
    }

    if (brand) {
      query += ` AND products.brand ILIKE $${paramIndex++}`;
      params.push(`%${brand}%`);
    }

    if (search) {
      query += ` AND (products.name ILIKE $${paramIndex} OR products.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (minPrice) {
      query += ` AND products.price >= $${paramIndex++}`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ` AND products.price <= $${paramIndex++}`;
      params.push(parseFloat(maxPrice));
    }

    // Save filter params for count query
    const filterParams = [...params];

    if (sort) {
      const sortOptions = {
        'price-asc': 'products.price ASC',
        'price-desc': 'products.price DESC',
        'newest': 'products.created_at DESC',
        'name-asc': 'products.name ASC',
      };
      const orderClause = sortOptions[sort] || 'products.id ASC';
      query += ` ORDER BY ${orderClause}`;
    } else {
      query += ' ORDER BY products.id ASC';
    }

    if (limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 12;
      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limitNum, offset);

      const countQuery = query.replace('SELECT products.*, categories.category_name', 'SELECT COUNT(*)');
      // Remove ORDER BY, LIMIT, OFFSET from count query
      const countQueryClean = countQuery.replace(/\s+ORDER\s+BY\s+.+/, '').replace(/\s+LIMIT\s+\$\d+\s+OFFSET\s+\$\d+/, '');

      const { rows: countRows } = await pool.query(countQueryClean, filterParams);
      const total = parseInt(countRows[0].count, 10);

      const { rows } = await pool.query(query, params);
      return res.json({ products: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getAllProducts error:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getProductById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }

    const { rows } = await pool.query(
      'SELECT products.*, categories.category_name FROM products JOIN categories ON products.category_id = categories.id WHERE products.id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('getProductById error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, brand, sizes, description, price, category_id, stock_quantity, gender } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required.' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'A valid positive price is required.' });
    }

    const parsedCategoryId = parseInt(category_id, 10);
    if (!parsedCategoryId || parsedCategoryId <= 0) {
      return res.status(400).json({ error: 'A valid category_id is required.' });
    }

    const parsedStockQuantity = stock_quantity !== undefined && stock_quantity !== ''
      ? parseInt(stock_quantity, 10)
      : 0;
    if (isNaN(parsedStockQuantity) || parsedStockQuantity < 0) {
      return res.status(400).json({ error: 'Stock quantity must be a non-negative integer.' });
    }

    const image_path = req.file ? req.file.filename : null;
    if (!image_path) {
      return res.status(400).json({ error: 'Product image is required.' });
    }

    const parsedGender = gender?.trim() || 'unisex';
    if (!['men', 'women', 'kids', 'unisex'].includes(parsedGender)) {
      return res.status(400).json({ error: 'Gender must be men, women, kids, or unisex.' });
    }

    const { rows } = await pool.query(
      'INSERT INTO products (name, brand, sizes, description, price, image_path, category_id, stock_quantity, gender) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, brand, sizes, description, price, image_path, category_id, stock_quantity, gender',
      [name.trim(), brand?.trim() || null, sizes?.trim() || null, description || null, parsedPrice, image_path, parsedCategoryId, parsedStockQuantity, parsedGender]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product: rows[0],
    });
  } catch (error) {
    console.error('createProduct error:', error.message);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Category does not exist.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }

    const { name, brand, sizes, description, price, category_id, stock_quantity, gender } = req.body;

    const { rows: existing } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = existing[0];
    const image_path = req.file ? req.file.filename : product.image_path;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (brand !== undefined) {
      updates.push(`brand = $${paramIndex++}`);
      values.push(brand?.trim() || null);
    }
    if (sizes !== undefined) {
      updates.push(`sizes = $${paramIndex++}`);
      values.push(sizes?.trim() || null);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        updates.push(`price = $${paramIndex++}`);
        values.push(parsedPrice);
      }
    }
    if (category_id !== undefined) {
      const parsedCategoryId = parseInt(category_id, 10);
      if (parsedCategoryId && parsedCategoryId > 0) {
        updates.push(`category_id = $${paramIndex++}`);
        values.push(parsedCategoryId);
      }
    }
    if (stock_quantity !== undefined) {
      const parsedStock = parseInt(stock_quantity, 10);
      if (!isNaN(parsedStock) && parsedStock >= 0) {
        updates.push(`stock_quantity = $${paramIndex++}`);
        values.push(parsedStock);
      }
    }
    if (gender !== undefined) {
      const parsedGender = gender?.trim() || 'unisex';
      if (['men', 'women', 'kids', 'unisex'].includes(parsedGender)) {
        updates.push(`gender = $${paramIndex++}`);
        values.push(parsedGender);
      }
    }
    if (req.file) {
      updates.push(`image_path = $${paramIndex++}`);
      values.push(image_path);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const { rows } = await pool.query(query, values);

    res.json({ message: 'Product updated successfully.', product: rows[0] });
  } catch (error) {
    console.error('updateProduct error:', error.message);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Category does not exist.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }

    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('deleteProduct error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
