const pool = require('../config/db');

const TAX_RATE = 0.10;
const FREE_SHIPPING_THRESHOLD = 75;
const STANDARD_SHIPPING = 9.99;

const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shipping_address_id, payment_info, billing_address_id } = req.body;

    if (!shipping_address_id) {
      return res.status(400).json({ error: 'Shipping address is required.' });
    }

    const { rows: addressRows } = await pool.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [parseInt(shipping_address_id, 10), userId]
    );
    if (addressRows.length === 0) {
      return res.status(400).json({ error: 'Invalid shipping address.' });
    }

    let billingId = null;
    if (billing_address_id) {
      const { rows: billing } = await pool.query(
        'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
        [parseInt(billing_address_id, 10), userId]
      );
      if (billing.length > 0) {
        billingId = parseInt(billing_address_id, 10);
      }
    }
    if (!billingId) {
      billingId = parseInt(shipping_address_id, 10);
    }

    const { rows: cartItems } = await pool.query(
      `SELECT cart_items.*, products.name AS product_name, products.price,
              products.image_path, products.stock_quantity
       FROM cart_items
       JOIN products ON cart_items.product_id = products.id
       WHERE cart_items.user_id = $1`,
      [userId]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    for (const item of cartItems) {
      if (item.quantity > item.stock_quantity) {
        return res.status(400).json({
          error: `Not enough stock for ${item.product_name}. Available: ${item.stock_quantity}`,
        });
      }
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
    const total = Math.round((subtotal + tax + shippingCost) * 100) / 100;

    const paymentData = payment_info || {};

    const { rows: orderRows } = await pool.query(
      `INSERT INTO orders (user_id, shipping_address_id, billing_address_id, subtotal, tax, shipping_cost, total, payment_info, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed') RETURNING *`,
      [userId, parseInt(shipping_address_id, 10), billingId, subtotal, tax, shippingCost, total, JSON.stringify(paymentData)]
    );

    const orderId = orderRows[0].id;

    for (const item of cartItems) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_time, size, image_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.product_id, item.product_name, item.quantity, item.price, item.size, item.image_path]
      );

      await pool.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    const { rows: fullOrder } = await pool.query(
      `SELECT o.*, a.full_name AS shipping_name, a.street AS shipping_street,
              a.city AS shipping_city, a.state AS shipping_state, a.zip AS shipping_zip,
              a.country AS shipping_country, a.phone AS shipping_phone
       FROM orders o
       JOIN addresses a ON o.shipping_address_id = a.id
       WHERE o.id = $1`,
      [orderId]
    );

    const { rows: orderItems } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );

    res.status(201).json({
      message: 'Order placed successfully.',
      order: { ...fullOrder[0], items: orderItems },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT o.*, a.full_name AS shipping_name, a.city AS shipping_city, a.state AS shipping_state
       FROM orders o
       LEFT JOIN addresses a ON o.shipping_address_id = a.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = parseInt(req.params.id, 10);

    if (!orderId || orderId <= 0) {
      return res.status(400).json({ error: 'Valid order ID is required.' });
    }

    const { rows: orderRows } = await pool.query(
      `SELECT o.*, sa.full_name AS shipping_name, sa.street AS shipping_street,
              sa.city AS shipping_city, sa.state AS shipping_state, sa.zip AS shipping_zip,
              sa.country AS shipping_country, sa.phone AS shipping_phone,
              ba.full_name AS billing_name, ba.street AS billing_street,
              ba.city AS billing_city, ba.state AS billing_state, ba.zip AS billing_zip,
              ba.country AS billing_country
       FROM orders o
       LEFT JOIN addresses sa ON o.shipping_address_id = sa.id
       LEFT JOIN addresses ba ON o.billing_address_id = ba.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );

    res.json({ ...orderRows[0], items });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.username, u.email, a.full_name AS shipping_name, a.city AS shipping_city, a.state AS shipping_state
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN addresses a ON o.shipping_address_id = a.id
       ORDER BY o.created_at DESC`
    );

    for (const order of rows) {
      const { rows: items } = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = items;
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!orderId || orderId <= 0) {
      return res.status(400).json({ error: 'Valid order ID is required.' });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const { rows } = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ message: 'Order status updated.', order: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { placeOrder, getOrders, getOrderById, getAllOrders, updateOrderStatus };
