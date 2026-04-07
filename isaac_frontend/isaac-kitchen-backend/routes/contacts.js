const router = require("express").Router();
const pool = require("../db");

router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields required" });
    }

    await pool.query(
      "INSERT INTO contacts (name,email,message) VALUES (?,?,?)",
      [name, email, message]
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM contacts ORDER BY id DESC");
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;