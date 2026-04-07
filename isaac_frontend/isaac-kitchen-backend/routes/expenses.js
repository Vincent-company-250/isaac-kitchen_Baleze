const router = require("express").Router();
const pool = require("../db");
const logActivity = require("../utils/logger");
const generateDailyReport = require("../utils/reportGenerator");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM expenses ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/add", async (req, res) => {
  const { title, amount, category, note } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ message: "Title and amount required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO expenses (title, amount, category, note, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [title, amount, category || null, note || null]
    );

    await logActivity({
      action: "ADD_EXPENSE",
      table_name: "expenses",
      record_id: result.insertId,
      description: `Expense added: ${title}`
    }).catch(console.error);

    await generateDailyReport().catch(console.error);

    res.json({ success: true });
  } catch (err) {
    console.error("Add expense error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);

    await logActivity({
      action: "DELETE_EXPENSE",
      table_name: "expenses",
      record_id: req.params.id,
      description: `Deleted expense ID ${req.params.id}`
    }).catch(console.error);

    await generateDailyReport().catch(console.error);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete expense error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;