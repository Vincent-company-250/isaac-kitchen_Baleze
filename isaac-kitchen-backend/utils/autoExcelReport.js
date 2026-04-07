const cron = require("node-cron");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const pool = require("../db");

async function generateDailyExcelReport() {
  try {
    const today = new Date();
    const fileDate = today.toISOString().split("T")[0];

    // =========================
    // Folder ya Desktop Reports
    // =========================
    const reportsDir = path.join("C:/Users/lenovo/Desktop/Reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();

    // =========================
    // DASHBOARD SUMMARY
    // =========================
    const summarySheet = workbook.addWorksheet("Dashboard Summary");
    const [[menuCount]] = await pool.query("SELECT COUNT(*) AS total FROM menu");
    const [[ordersCount]] = await pool.query("SELECT COUNT(*) AS total FROM order_details");
    const [[itemsCount]] = await pool.query("SELECT COUNT(*) AS total FROM order_items");
    const [[usersCount]] = await pool.query("SELECT COUNT(*) AS total FROM users");
    const [[contactsCount]] = await pool.query("SELECT COUNT(*) AS total FROM contacts");
    const [[revenueSum]] = await pool.query("SELECT IFNULL(SUM(total),0) AS total FROM order_details");
    const [[expensesSum]] = await pool.query("SELECT IFNULL(SUM(amount),0) AS total FROM expenses");

    const revenue = Number(revenueSum.total || 0);
    const expenses = Number(expensesSum.total || 0);
    const profit = revenue - expenses;

    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 25 }
    ];

    summarySheet.addRows([
      { metric: "Menu Items", value: menuCount.total },
      { metric: "Orders", value: ordersCount.total },
      { metric: "Order Items", value: itemsCount.total },
      { metric: "Users", value: usersCount.total },
      { metric: "Messages", value: contactsCount.total },
      { metric: "Revenue (RWF)", value: revenue },
      { metric: "Expenses (RWF)", value: expenses },
      { metric: "Profit (RWF)", value: profit }
    ]);

    // =========================
    // MENU SHEET
    // =========================
    const menuSheet = workbook.addWorksheet("Menu");
    const [menu] = await pool.query("SELECT * FROM menu");
    menuSheet.columns = Object.keys(menu[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    menu.forEach(m => menuSheet.addRow(m));

    // =========================
    // USERS SHEET
    // =========================
    const usersSheet = workbook.addWorksheet("Users");
    const [users] = await pool.query("SELECT * FROM users ORDER BY id DESC");
    usersSheet.columns = Object.keys(users[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    users.forEach(user => usersSheet.addRow(user));

    // =========================
    // ORDERS SHEET
    // =========================
    const ordersSheet = workbook.addWorksheet("Orders");
    const [orders] = await pool.query("SELECT * FROM order_details ORDER BY id DESC");
    ordersSheet.columns = Object.keys(orders[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    orders.forEach(order => ordersSheet.addRow(order));

    // =========================
    // ORDER ITEMS SHEET
    // =========================
    const orderItemsSheet = workbook.addWorksheet("Order Items");
    const [orderItems] = await pool.query("SELECT * FROM order_items ORDER BY id DESC");
    orderItemsSheet.columns = Object.keys(orderItems[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    orderItems.forEach(item => orderItemsSheet.addRow(item));

    // =========================
    // MESSAGES SHEET
    // =========================
    const messagesSheet = workbook.addWorksheet("Messages");
    const [messages] = await pool.query("SELECT * FROM contacts ORDER BY id DESC");
    messagesSheet.columns = Object.keys(messages[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    messages.forEach(msg => messagesSheet.addRow(msg));

    // =========================
    // EXPENSES SHEET
    // =========================
    const expensesSheet = workbook.addWorksheet("Expenses");
    const [expensesRows] = await pool.query("SELECT * FROM expenses ORDER BY id DESC");
    expensesSheet.columns = Object.keys(expensesRows[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    expensesRows.forEach(exp => expensesSheet.addRow(exp));

    // =========================
    // LOGS SHEET
    // =========================
    const logsSheet = workbook.addWorksheet("Logs");
    const [logs] = await pool.query("SELECT * FROM activity_logs ORDER BY id DESC");
    logsSheet.columns = Object.keys(logs[0] || {}).map(k => ({ header: k, key: k, width: 25 }));
    logs.forEach(log => logsSheet.addRow(log));

    // =========================
    // Style all headers
    // =========================
    workbook.eachSheet(sheet => {
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF7A00" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    });

    // =========================
    // Save & Open Excel
    // =========================
    const filePath = path.join(reportsDir, `report-${fileDate}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Excel report generated: ${filePath}`);
    exec(`start excel "${filePath}"`, (err) => { if (err) console.error("❌ Could not open Excel:", err); });

  } catch (err) {
    console.error("❌ Error generating automatic Excel report:", err);
  }
}

// =========================================
// Cron schedule: run every day at 12 AM
cron.schedule("59 23 * * *", () => {
  console.log("⏰ Running automatic Excel report...");
  generateDailyExcelReport();
});

module.exports = generateDailyExcelReport;