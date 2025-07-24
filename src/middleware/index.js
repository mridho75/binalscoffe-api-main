import express from "express";
const appMiddleware = express();
import cors from "cors";
import router from "../routes/index.js";
import "../utils/winston.js";
import fileUpload from "express-fileupload";

// Konfigurasi CORS yang lebih spesifik dan aman
const corsOptions = {
  origin: [
    'https://binalscoffe.fikti.com',
    'http://localhost:3000',
    'http://localhost:5173', // Untuk development Vite
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200 // Untuk legacy browser support
};

// Apply CORS middleware
appMiddleware.use(cors(corsOptions));

// Handle preflight requests explicitly
appMiddleware.options('*', cors(corsOptions));

// Body parsing middleware
appMiddleware.use(express.json({ limit: '10mb' }));
appMiddleware.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload middleware
appMiddleware.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached",
}));

// Static files
appMiddleware.use(express.static("public"));

// Custom middleware untuk debugging CORS (optional - hapus di produksi)
appMiddleware.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// Error handling middleware untuk CORS
appMiddleware.use((err, req, res, next) => {
  if (err.name === 'CORSError') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Cross-origin request blocked'
    });
  }
  next(err);
});

// Routes
appMiddleware.use(router);

// Global error handler
appMiddleware.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Jangan kirim response kosong yang menyebabkan JSON parsing error
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
});

// 404 handler
appMiddleware.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

export default appMiddleware;