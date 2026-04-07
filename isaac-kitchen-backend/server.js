const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const cors = require("cors");





// Pool ya database
const pool = require("./db");

// Routes
const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/order");
const logsRoutes = require("./routes/logs");
  require("./utils/autoExcelReport");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "supersecret", resave: false, saveUninitialized: false }));
app.use("/uploads", express.static("uploads"));
app.set("view engine", "ejs");

// ------------------- DASHBOARD ROUTES -------------------

// Dashboard summary
app.get("/api/dashboard", async (req, res) => {
  try {
    const [menu] = await pool.query("SELECT COUNT(*) as total FROM menu");
    const [orders] = await pool.query("SELECT COUNT(*) as total FROM orders");
    const [items] = await pool.query("SELECT COUNT(*) as total FROM order_items");
    const [users] = await pool.query("SELECT COUNT(*) as total FROM users");
    const [contacts] = await pool.query("SELECT COUNT(*) as total FROM contacts");
    const [expenses] = await pool.query("SELECT IFNULL(SUM(amount),0) as total FROM expenses");
    const [revenue] = await pool.query("SELECT IFNULL(SUM(total),0) as total FROM orders");

    const totalProfit = revenue[0].total - expenses[0].total;

    res.json({
      menu: menu[0].total,
      orders: orders[0].total,
      items: items[0].total,
      users: users[0].total,
      contacts: contacts[0].total,
      revenue: revenue[0].total,
      expenses: expenses[0].total,
      profit: totalProfit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Sales chart data
app.get("/api/dashboard/sales-chart", async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT DATE(created_at) as day, SUM(total) as total 
      FROM orders 
      GROUP BY DATE(created_at) 
      ORDER BY DATE(created_at) ASC
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- REPORTS -------------------
app.get("/api/reports/daily", async (req, res) => {
  try {
    const [reports] = await pool.query(`
      SELECT DATE(created_at) as report_date,
             SUM(total) as total_income,
             (SELECT IFNULL(SUM(amount),0) FROM expenses WHERE DATE(created_at) = DATE(o.created_at)) as total_expense,
             SUM(total) - (SELECT IFNULL(SUM(amount),0) FROM expenses WHERE DATE(created_at) = DATE(o.created_at)) as profit
      FROM orders o
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- EXPENSES -------------------
app.get("/api/expenses", async (req, res) => {
  try {
    const [expenses] = await pool.query("SELECT * FROM expenses ORDER BY id DESC");
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/expenses/add", async (req, res) => {
  try {
    const { title, amount, category, note } = req.body;
    await pool.query("INSERT INTO expenses (title, amount, category, note) VALUES (?,?,?,?)", [title, amount, category, note]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/expenses/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- CONTACTS / MESSAGES -------------------
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ message: "All fields required" });
    await pool.query("INSERT INTO contacts (name,email,message) VALUES (?,?,?)", [name, email, message]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/contacts", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM contacts ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/contacts/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- REGISTER ROUTES -------------------
app.use("/api/menu", menuRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/logs", logsRoutes);
// ... hejuru y'indi routes


// ------------------- START SERVER -------------------
app.listen(5000, () => console.log("Server running on port 5000"));