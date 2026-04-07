const router = require("express").Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        user_id,
        otp_code AS otp,
        status,
        expires_at,
        created_at
      FROM otps
      ORDER BY id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Get OTPs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM otps WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;