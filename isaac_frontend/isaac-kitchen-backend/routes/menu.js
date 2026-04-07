const router = require("express").Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Multer upload config
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============================
// Helper function for full image URL
// ============================
const fullImageUrl = (req, filename) => {
  const host = req.protocol + "://" + req.get("host");
  return filename ? `${host}/uploads/${filename}` : `${host}/uploads/default.jpg`;
};

// ============================
// GET all menu
// ============================
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, price, img, description, created_at
      FROM menu
      ORDER BY id DESC
    `);

    const data = rows.map(item => ({
      ...item,
      image: fullImageUrl(req, item.img)
    }));

    res.json(data);
  } catch (err) {
    console.error("GET MENU ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// GET one menu item
// ============================
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM menu WHERE id=?", [req.params.id]);

    if (!rows.length) return res.json(null);

    const item = rows[0];
    item.image = fullImageUrl(req, item.img);

    res.json(item);
  } catch (err) {
    console.error("GET ONE MENU ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// ADD menu
// ============================
router.post("/add", upload.single("image"), async (req, res) => {
  const { name, price, description } = req.body;
  const img = req.file ? req.file.filename : "default.jpg";

  try {
    await pool.query(
      "INSERT INTO menu(name, price, img, description, created_at) VALUES(?,?,?,?,NOW())",
      [name, price, img, description]
    );

    res.json({ success: true, message: "Menu added successfully" });
  } catch (err) {
    console.error("ADD MENU ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// EDIT menu
// ============================
router.put("/update/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, price, description } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM menu WHERE id=?", [id]);
    if (!rows.length) return res.status(404).json({ message: "Menu item not found" });

    const oldImage = rows[0].img;
    const img = req.file ? req.file.filename : oldImage;

    await pool.query(
      "UPDATE menu SET name=?, price=?, description=?, img=? WHERE id=?",
      [name, price, description, img, id]
    );

    res.json({ success: true, message: "Menu updated successfully" });
  } catch (err) {
    console.error("UPDATE MENU ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// DELETE menu
// ============================
router.delete("/delete/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM menu WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Menu item not found" });

    const imageName = rows[0].img;
    await pool.query("DELETE FROM menu WHERE id=?", [req.params.id]);

    if (imageName && imageName !== "default.jpg") {
      const imagePath = path.join(uploadsDir, imageName);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    res.json({ success: true, message: "Menu deleted successfully" });
  } catch (err) {
    console.error("DELETE MENU ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;