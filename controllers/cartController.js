const pool = require('../config/db');

const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT cart_items.*, products.name, products.price, products.image_path, products.brand,
              products.stock_quantity, categories.category_name
       FROM cart_items
       JOIN products ON cart_items.product_id = products.id
       JOIN categories ON products.category_id = categories.id
       WHERE cart_items.user_id = $1
       ORDER BY cart_items.created_at DESC`,
      [userId]
    );

    const total = rows.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

    res.json({ items: rows, total: Math.round(total * 100) / 100, count: rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity, size } = req.body;

    const parsedProductId = parseInt(product_id, 10);
    if (!parsedProductId || parsedProductId <= 0) {
      return res.status(400).json({ error: 'Valid product_id is required.' });
    }

    const parsedQuantity = parseInt(quantity, 10) || 1;
    if (parsedQuantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1.' });
    }

    const { rows: productRows } = await pool.query(
      'SELECT id, stock_quantity FROM products WHERE id = $1',
      [parsedProductId]
    );
    if (productRows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const existing = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND COALESCE(size, \'\') = COALESCE($3, \'\')',
      [userId, parsedProductId, size || null]
    );

    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + parsedQuantity;
      if (newQty > productRows[0].stock_quantity) {
        return res.status(400).json({ error: 'Not enough stock available.' });
      }
      const { rows } = await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
        [newQty, existing.rows[0].id]
      );
      return res.json({ message: 'Cart updated.', item: rows[0] });
    }

    const { rows } = await pool.query(
      'INSERT INTO cart_items (user_id, product_id, quantity, size) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, parsedProductId, parsedQuantity, size || null]
    );

    res.status(201).json({ message: 'Added to cart.', item: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id, 10);
    const { quantity } = req.body;

    if (!itemId || itemId <= 0) {
      return res.status(400).json({ error: 'Valid cart item ID is required.' });
    }

    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
    }

    if (parsedQuantity === 0) {
      const { rowCount } = await pool.query(
        'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
        [itemId, userId]
      );
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Cart item not found.' });
      }
      return res.json({ message: 'Item removed from cart.' });
    }

    const { rows: itemRows } = await pool.query(
      'SELECT * FROM cart_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );
    if (itemRows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const { rows: productRows } = await pool.query(
      'SELECT stock_quantity FROM products WHERE id = $1',
      [itemRows[0].product_id]
    );
    if (parsedQuantity > productRows[0].stock_quantity) {
      return res.status(400).json({ error: 'Not enough stock available.' });
    }

    const { rows } = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [parsedQuantity, itemId, userId]
    );

    res.json({ message: 'Cart updated.', item: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id, 10);

    if (!itemId || itemId <= 0) {
      return res.status(400).json({ error: 'Valid cart item ID is required.' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    res.json({ message: 'Item removed from cart.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    res.json({ message: 'Cart cleared.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
