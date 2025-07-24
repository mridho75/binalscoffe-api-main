const express = require('express');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const result = await cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
      if (error) return res.status(500).json({ error });
      return res.json({ url: result.secure_url });
    });
    result.end(fileBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
