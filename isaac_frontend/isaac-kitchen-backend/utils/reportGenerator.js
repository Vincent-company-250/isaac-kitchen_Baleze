const pool = require("../db");

async function generateDailyReport() {
  try {
    await pool.query(`
      INSERT INTO daily_reports (report_date, total_income, total_expense, profit)
      SELECT 
        CURDATE(),
        (SELECT IFNULL(SUM(total),0) FROM orders WHERE DATE(created_at)=CURDATE() AND payment_status='paid'),
        (SELECT IFNULL(SUM(amount),0) FROM expenses WHERE DATE(created_at)=CURDATE()),
        (
          (SELECT IFNULL(SUM(total),0) FROM orders WHERE DATE(created_at)=CURDATE() AND payment_status='paid')
          -
          (SELECT IFNULL(SUM(amount),0) FROM expenses WHERE DATE(created_at)=CURDATE())
        )
      ON DUPLICATE KEY UPDATE
        total_income=VALUES(total_income),
        total_expense=VALUES(total_expense),
        profit=VALUES(profit)
    `);
  } catch (err) {
    console.error("Daily report error:", err.message);
  }
}

module.exports = generateDailyReport;