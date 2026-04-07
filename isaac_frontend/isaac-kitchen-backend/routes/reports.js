const router = require("express").Router();
const pool = require("../db");
const generateDailyReport = require("../utils/reportGenerator");
router.get("/summary", async (req, res) => {
  try {
    const [[todayIncome]] = await pool.query(`
      SELECT IFNULL(SUM(total),0) as total
      FROM orders
      WHERE DATE(created_at)=CURDATE() AND payment_status='paid'
    `);

    const [[todayExpense]] = await pool.query(`
      SELECT IFNULL(SUM(amount),0) as total
      FROM expenses
      WHERE DATE(created_at)=CURDATE()
    `);

    const [[monthIncome]] = await pool.query(`
      SELECT IFNULL(SUM(total),0) as total
      FROM orders
      WHERE YEAR(created_at)=YEAR(CURDATE())
      AND MONTH(created_at)=MONTH(CURDATE())
      AND payment_status='paid'
    `);

    const [[monthExpense]] = await pool.query(`
      SELECT IFNULL(SUM(amount),0) as total
      FROM expenses
      WHERE YEAR(created_at)=YEAR(CURDATE())
      AND MONTH(created_at)=MONTH(CURDATE())
    `);

    res.json({
      today_income: todayIncome.total,
      today_expense: todayExpense.total,
      today_profit: Number(todayIncome.total) - Number(todayExpense.total),
      month_income: monthIncome.total,
      month_expense: monthExpense.total,
      month_profit: Number(monthIncome.total) - Number(monthExpense.total)
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/daily", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        d.report_date,
        d.total_income,
        d.total_expense,
        d.profit
      FROM daily_reports d
      ORDER BY d.report_date DESC
      LIMIT 30
    `);

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;