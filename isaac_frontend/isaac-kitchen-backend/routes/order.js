const router = require("express").Router();
const pool = require("../db");
const logActivity = require("../utils/logger");
const generateDailyReport = require("../utils/reportGenerator");

////////////////////////////////////////////////////
// GET ALL ORDERS
////////////////////////////////////////////////////
router.get("/details", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.user_id,
        COALESCE(u.fullname, o.customer_name) AS fullname,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.address,
        o.total,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.tx_ref,
        o.created_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /details error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// GET SINGLE ORDER
////////////////////////////////////////////////////
router.get("/details/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.user_id,
        COALESCE(u.fullname, o.customer_name) AS fullname,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.address,
        o.total,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.tx_ref,
        o.created_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ message: "Order not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("GET /details/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// GET ALL ORDER ITEMS
////////////////////////////////////////////////////
router.get("/items", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        oi.id,
        oi.order_id,
        oi.menu_id,
        m.name,
        oi.price,
        oi.quantity,
        (oi.price * oi.quantity) AS subtotal,
        oi.created_at
      FROM order_items oi
      LEFT JOIN menu m ON oi.menu_id = m.id
      ORDER BY oi.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /items error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// GET ITEMS FOR SINGLE ORDER
////////////////////////////////////////////////////
router.get("/items/:orderId", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        oi.id,
        oi.order_id,
        oi.menu_id,
        m.name,
        oi.price,
        oi.quantity,
        (oi.price * oi.quantity) AS subtotal,
        oi.created_at
      FROM order_items oi
      LEFT JOIN menu m ON oi.menu_id = m.id
      WHERE oi.order_id = ?
      ORDER BY oi.id DESC
    `, [req.params.orderId]);
    res.json(rows);
  } catch (err) {
    console.error("GET /items/:orderId error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// ADD NEW ORDER
////////////////////////////////////////////////////
router.post("/add", async (req, res) => {
  const { user_id, customer_name, customer_email, customer_phone, address, payment_method, payment_status, order_status, tx_ref, items } = req.body;

  if (!items?.length) return res.status(400).json({ message: "Order items required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    for (const item of items) {
      if (!item.menu_id || !item.price || !item.quantity) throw new Error("Invalid item data");
      total += Number(item.price) * Number(item.quantity);
    }

    const orderNumber = "ORD-" + Date.now();
    const [orderResult] = await conn.query(`
      INSERT INTO orders (user_id, order_number, customer_name, customer_email, customer_phone, address, payment_method, payment_status, order_status, tx_ref, total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [user_id || null, orderNumber, customer_name || null, customer_email || null, customer_phone || null, address || null, payment_method || "cash", payment_status || "pending", order_status || "Pending", tx_ref || null, total]);

    const orderId = orderResult.insertId;

    for (const item of items) {
      await conn.query(`
        INSERT INTO order_items (order_id, menu_id, price, quantity, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [orderId, item.menu_id, item.price, item.quantity]);
    }

    await conn.commit();

    await logActivity({ user_id: user_id || null, action: "CREATE_ORDER", table_name: "orders", record_id: orderId, description: `Created order ${orderNumber}` }).catch(console.error);
    await generateDailyReport().catch(console.error);

    res.status(201).json({ success: true, orderId, orderNumber, total });
  } catch (err) {
    await conn.rollback();
    console.error("POST /add error:", err);
    res.status(500).json({ message: "Failed to save order", error: err.message });
  } finally {
    conn.release();
  }
});

////////////////////////////////////////////////////
// UPDATE PAYMENT STATUS
////////////////////////////////////////////////////
router.put("/payment/:id", async (req, res) => {
  const { id } = req.params;
  const { payment_status, order_status, tx_ref, payment_method } = req.body;

  try {
    await pool.query(`
      UPDATE orders
      SET payment_status=?, order_status=?, tx_ref=?, payment_method=COALESCE(?, payment_method)
      WHERE id=?
    `, [payment_status || "pending", order_status || "Pending", tx_ref || null, payment_method || null, id]);

    await logActivity({ action: "UPDATE_PAYMENT", table_name: "orders", record_id: id, description: `Updated payment for order ID ${id}` }).catch(console.error);
    await generateDailyReport().catch(console.error);

    res.json({ success: true, message: "Payment updated successfully" });
  } catch (err) {
    console.error("PUT /payment/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// UPDATE ORDER STATUS ONLY
////////////////////////////////////////////////////
router.put("/status/:id", async (req, res) => {
  const { id } = req.params;
  const { order_status } = req.body;

  try {
    await pool.query("UPDATE orders SET order_status=? WHERE id=?", [order_status || "Pending", id]);
    await logActivity({ action: "UPDATE_ORDER_STATUS", table_name: "orders", record_id: id, description: `Updated order status for order ID ${id}` }).catch(console.error);
    await generateDailyReport().catch(console.error);

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (err) {
    console.error("PUT /status/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

////////////////////////////////////////////////////
// DELETE ORDER
////////////////////////////////////////////////////
router.delete("/details/delete/:id", async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM order_items WHERE order_id=?", [id]);
    await conn.query("DELETE FROM orders WHERE id=?", [id]);
    await conn.commit();

    await logActivity({ action: "DELETE_ORDER", table_name: "orders", record_id: id, description: `Deleted order ID ${id}` }).catch(console.error);
    await generateDailyReport().catch(console.error);

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("DELETE order error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
});

////////////////////////////////////////////////////
// DELETE ORDER ITEM
////////////////////////////////////////////////////
router.delete("/items/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM order_items WHERE id=?", [req.params.id]);
    await logActivity({ action: "DELETE_ORDER_ITEM", table_name: "order_items", record_id: req.params.id, description: `Deleted order item ID ${req.params.id}` }).catch(console.error);
    await generateDailyReport().catch(console.error);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE item error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;