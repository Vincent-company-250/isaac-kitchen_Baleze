const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "vincent",
  password: "StrongPass123", // shaka neza password yawe
  database: "isaac_blaze_kitchen",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();