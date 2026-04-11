require("dotenv").config(); // ✅ import env

const express = require("express");
const session = require("express-session");
const cors = require("cors");

// Pool (ituruka muri db.js)
const pool = require("./db");

// Routes
const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/order");
const logsRoutes = require("./routes/logs");

require("./utils/autoExcelReport");

const app = express();

// ✅ CORS (important for frontend)
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use("/uploads", express.static("uploads"));
app.set("view engine", "ejs");

// ------------------- DASHBOARD -------------------
app.get("/api/dashboard", async (req, res) => {
  try {
    const [menu] = await pool.query("SELECT COUNT(*) as total FROM menu");
    const [orders] = await pool.query("SELECT COUNT(*) as total FROM orders");
    const [items] = await pool.query("SELECT COUNT(*) as total FROM order_items");
    const [users] = await pool.query("SELECT COUNT(*) as total FROM users");
    const [contacts] = await pool.query("SELECT COUNT(*) as total FROM contacts");
    const [expenses] = await pool.query("SELECT IFNULL(SUM(amount),0) as total FROM expenses");
    const [revenue] = await pool.query("SELECT IFNULL(SUM(total),0) as total FROM orders");

    res.json({
      menu: menu[0].total,
      orders: orders[0].total,
      items: items[0].total,
      users: users[0].total,
      contacts: contacts[0].total,
      revenue: revenue[0].total,
      expenses: expenses[0].total,
      profit: revenue[0].total - expenses[0].total
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- ROUTES -------------------
app.use("/api/menu", menuRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/logs", logsRoutes);

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ✅ PORT (for Render)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
