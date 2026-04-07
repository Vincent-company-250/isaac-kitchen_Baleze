const router = require("express").Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM activity_logs
      ORDER BY id DESC
      LIMIT 100
    `);

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;