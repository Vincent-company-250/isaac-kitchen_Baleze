const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logActivity = require("../utils/logger");

const SECRET = process.env.JWT_SECRET || "secretkey";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/signup", async (req, res) => {
  const { fullname, email, password, phone } = req.body;
  if (!fullname || !email || !password || !phone) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const [existing] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
    if (existing.length > 0) return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (fullname,email,password,phone,role,is_verified,created_at)
       VALUES (?,?,?,?,?,0,NOW())`,
      [fullname, email, hashed, phone, "user"]
    );

    const userId = result.insertId;
    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query("INSERT INTO otps (user_id, otp_code, expires_at) VALUES (?,?,?)", [userId, otp, expires]);

    await logActivity({
      user_id: userId,
      action: "SIGNUP",
      table_name: "users",
      record_id: userId,
      description: `New account created for ${email}`
    });

    console.log("OTP:", otp);
    res.json({ message: "Account created. Verify OTP", userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM otps WHERE user_id=? AND otp_code=? AND expires_at > NOW()",
      [userId, otp]
    );
    if (rows.length === 0) return res.status(400).json({ error: "Invalid or expired OTP" });

    await pool.query("UPDATE users SET is_verified=1 WHERE id=?", [userId]);
    await logActivity({
      user_id: userId,
      action: "VERIFY_OTP",
      table_name: "users",
      record_id: userId,
      description: "User verified account"
    });

    res.json({ message: "Account verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "All fields required" });

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
    if (rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Wrong password" });
    if (user.is_verified === 0) return res.status(403).json({ error: "Please verify OTP first" });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "1d" });
    await logActivity({
      user_id: user.id,
      action: "LOGIN",
      table_name: "users",
      record_id: user.id,
      description: `User logged in: ${email}`
    });

    res.json({
      token,
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token.split(" ")[1], SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(403).json({ error: "Invalid token" });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// 🚀 Users route ready for testing dashboard
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, fullname, email, phone, role, is_verified, created_at 
       FROM users ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete user (admin only)
router.delete("/delete/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
    await logActivity({
      user_id: req.user.id,
      action: "DELETE_USER",
      table_name: "users",
      record_id: req.params.id,
      description: `Admin deleted user ID ${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;