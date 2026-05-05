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

// Allow requests from any origin (any IP, port, or URL)
const corsOptions = {
  origin: true,       // mirrors the request origin — works with credentials
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Middleware
app.use(cors(corsOptions));
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
    console.log(`📡 CORS: accepting requests from all origins`);
  });
});