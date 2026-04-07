const router = require("express").Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [[menu]] = await pool.query("SELECT COUNT(*) as total FROM menu");
    const [[orders]] = await pool.query("SELECT COUNT(*) as total FROM orders");
    const [[items]] = await pool.query("SELECT COUNT(*) as total FROM order_items");
    const [[users]] = await pool.query("SELECT COUNT(*) as total FROM users");
    const [[contacts]] = await pool.query("SELECT COUNT(*) as total FROM contacts");
    const [[revenue]] = await pool.query("SELECT IFNULL(SUM(total),0) as total FROM orders WHERE payment_status='paid'");
    const [[expenses]] = await pool.query("SELECT IFNULL(SUM(amount),0) as total FROM expenses");
    const profit = Number(revenue.total) - Number(expenses.total);

    res.json({
      menu: menu.total,
      orders: orders.total,
      items: items.total,
      users: users.total,
      contacts: contacts.total,
      revenue: revenue.total,
      expenses: expenses.total,
      profit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/sales-chart", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE(created_at) as day,
        IFNULL(SUM(total),0) as total
      FROM orders
      WHERE payment_status='paid'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
      LIMIT 30
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/profit-chart", async (req, res) => {
  try {
    const [incomeRows] = await pool.query(`
      SELECT DATE(created_at) as day, IFNULL(SUM(total),0) as income
      FROM orders
      WHERE payment_status='paid'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
      LIMIT 30
    `);

    const [expenseRows] = await pool.query(`
      SELECT DATE(created_at) as day, IFNULL(SUM(amount),0) as expense
      FROM expenses
      GROUP BY DATE(created_at)
      ORDER BY day ASC
      LIMIT 30
    `);

    res.json({ incomeRows, expenseRows });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;