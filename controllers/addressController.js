const pool = require('../config/db');

const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, full_name, phone, street, city, state, zip, country } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!street || !street.trim()) {
      return res.status(400).json({ error: 'Street address is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'City is required.' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ error: 'State is required.' });
    }
    if (!zip || !zip.trim()) {
      return res.status(400).json({ error: 'ZIP code is required.' });
    }

    const addressType = type === 'billing' ? 'billing' : 'shipping';

    const { rows } = await pool.query(
      `INSERT INTO addresses (user_id, type, full_name, phone, street, city, state, zip, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, addressType, full_name.trim(), phone || null, street.trim(), city.trim(), state.trim(), zip.trim(), country || 'United States']
    );

    res.status(201).json({ message: 'Address saved.', address: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (!addressId || addressId <= 0) {
      return res.status(400).json({ error: 'Valid address ID is required.' });
    }

    const { type, full_name, phone, street, city, state, zip, country } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Address not found.' });
    }

    const updatedType = type === 'billing' ? 'billing' : 'shipping';

    const { rows } = await pool.query(
      `UPDATE addresses SET type = $1, full_name = $2, phone = $3, street = $4,
       city = $5, state = $6, zip = $7, country = $8 WHERE id = $9 AND user_id = $10 RETURNING *`,
      [
        updatedType,
        full_name?.trim() || existing[0].full_name,
        phone || existing[0].phone,
        street?.trim() || existing[0].street,
        city?.trim() || existing[0].city,
        state?.trim() || existing[0].state,
        zip?.trim() || existing[0].zip,
        country || existing[0].country,
        addressId,
        userId,
      ]
    );

    res.json({ message: 'Address updated.', address: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (!addressId || addressId <= 0) {
      return res.status(400).json({ error: 'Valid address ID is required.' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Address not found.' });
    }

    res.json({ message: 'Address deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { getAddresses, createAddress, updateAddress, deleteAddress };
