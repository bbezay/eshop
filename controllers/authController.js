const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters.' });
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'User with that email or username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
      [username.trim(), email, hashedPassword]
    );

    res.status(201).json({
      message: 'Registration successful.',
      user: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const { rows } = await pool.query(
      'SELECT id, username, email, password, role, is_active FROM users WHERE email = $1 AND is_active = TRUE AND deleted_at IS NULL',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const softDeleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    const { rowCount } = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found or already deleted.' });
    }

    res.json({ message: 'User soft-deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }

    if (req.body.is_active === undefined || typeof req.body.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required in request body.' });
    }

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot toggle your own account status.' });
    }

    const { rowCount } = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 AND deleted_at IS NULL',
      [req.body.is_active, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found or already deleted.' });
    }

    res.json({ message: 'User status updated.', is_active: req.body.is_active });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, current_password, new_password } = req.body;

    const { rows: userRows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    const user = userRows[0];

    if (username && (username.trim().length < 3 || username.trim().length > 50)) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters.' });
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    if (username || email) {
      const { rows: conflict } = await pool.query(
        'SELECT id FROM users WHERE (email = $1 OR username = $2) AND id != $3',
        [email || user.email, (username || user.username).trim(), userId]
      );
      if (conflict.length > 0) {
        return res.status(409).json({ error: 'Email or username already taken.' });
      }
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
      const hashedPassword = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    }

    if (username || email) {
      await pool.query(
        'UPDATE users SET username = $1, email = $2 WHERE id = $3',
        [(username || user.username).trim(), email || user.email, userId]
      );
    }

    const { rows } = await pool.query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Profile updated.', user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { register, login, softDeleteUser, toggleUserStatus, getProfile, updateProfile };
