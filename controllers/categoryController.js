const pool = require('../config/db');

const getCategories = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM categories ORDER BY category_name ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('getCategories error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { category_name } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const { rows } = await pool.query(
      'INSERT INTO categories (category_name) VALUES ($1) RETURNING *',
      [category_name.trim()]
    );
    res.status(201).json({ message: 'Category created.', category: rows[0] });
  } catch (error) {
    console.error('createCategory error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid category ID is required.' });
    }

    const { category_name } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const { rows } = await pool.query(
      'UPDATE categories SET category_name = $1 WHERE id = $2 RETURNING *',
      [category_name.trim(), id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category updated.', category: rows[0] });
  } catch (error) {
    console.error('updateCategory error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid category ID is required.' });
    }

    // Check if products exist in this category
    const { rows: products } = await pool.query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1',
      [id]
    );
    if (parseInt(products[0].count, 10) > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing products. Please reassign or delete products first.' });
    }

    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category deleted.' });
  } catch (error) {
    console.error('deleteCategory error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
