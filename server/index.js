require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const socketHandler = require('./lib/socketHandler');

const app = express();
const server = http.createServer(app);

// Use environment variable for production (Vercel URL) or local dev port 5174
// Tip: In Render, set CLIENT_URL to your Vercel address (e.g., https://ops-center.vercel.app)
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5174';

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Health check - Important for Render uptime monitoring
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Socket handler
socketHandler(io);

// Error handler (must be last)
app.use(errorHandler);

// Start Logic
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Use '0.0.0.0' for deployment so Render's network can route traffic to your app
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ops-Center server running on port ${PORT}`);
    console.log(`📡 Accepting connections from: ${CLIENT_URL}`);
  });
});