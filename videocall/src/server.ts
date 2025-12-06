import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { initSfuNodesFromEnv } from './services/sfuService.js';

// Load environment variables FIRST, before importing any modules that use process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the videocall directory
const envResult = dotenv.config({ path: path.join(__dirname, '../.env') });

if (envResult.error) {
  console.warn('Warning: Could not load .env file:', envResult.error.message);
  console.warn('Make sure you have a .env file in the videocall folder');
} else {
  console.log('Environment variables loaded successfully');
}

// Verify required environment variables
const requiredVars = ['INTERNAL_SECRET', 'VIDEO_JWT_SECRET', 'MONGO_URI'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please create a .env file in the videocall folder with these variables');
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Initialize SFU nodes
initSfuNodesFromEnv();

// Connect to database
connectDatabase();

// Public routes (must be before API routes)
// Serve frontend for /join/:sessionId - this is a public route for users to join video calls
app.get('/join/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Video service is running' });
});

// Debug endpoint to check secret configuration (remove in production)
app.get('/debug/secret', (req, res) => {
  const secret = process.env.INTERNAL_SECRET;
  if (secret) {
    res.json({
      configured: true,
      length: secret.length,
      firstChars: secret.substring(0, 10),
      lastChars: secret.substring(Math.max(0, secret.length - 10)),
      note: 'This endpoint should be removed in production'
    });
  } else {
    res.json({
      configured: false,
      message: 'INTERNAL_SECRET is not set in environment variables'
    });
  }
});

// API routes (require X-Internal-Secret header)
app.use('/', sessionRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Video Call Service running on port ${PORT}`);
  console.log(`Client base URL: ${process.env.CLIENT_BASE_URL || 'http://localhost:4000'}`);
});
