const pool = require("../db");

async function logActivity({
  user_id = null,
  action,
  table_name = null,
  record_id = null,
  description = null,
  ip_address = null
}) {
  try {
    await pool.query(
      `INSERT INTO activity_logs 
      (user_id, action, table_name, record_id, description, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, action, table_name, record_id, description, ip_address]
    );
  } catch (err) {
    console.error("Log error:", err.message);
  }
}

module.exports = logActivity;