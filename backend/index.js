import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import http from 'http'; 
import { Server } from 'socket.io'; 

// Database Connections
import connectMongo from './config/mongo.js';
import mongoose from 'mongoose';
import redisClient from './config/redis.js';
import { startCleanupJob } from './jobs/cleanupExpiredHolds.js';

dotenv.config();
connectMongo();
// 🛑 REMOVED pool() - It runs automatically now!

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { stripeWebhook } from './controllers/bookingController.js';
import rateLimiter from './middleware/rateLimiter.js';

const app = express();
app.set('trust proxy', 1);

// ==========================================
// ALLOWED ORIGINS (Used for both Express and WebSockets)
// ==========================================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  "http://127.0.0.1:5173",
  "http://192.168.0.104:5173", 
  "http://10.88.124.189:5173", 
  "http://localhost:5173"
];

// ==========================================
// WEBSOCKET SERVER INITIALIZATION
// ==========================================
const server = http.createServer(app); 

export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ CRITICAL: Attach 'io' to the Express app so controllers can use it!
app.set('io', io); 
startCleanupJob(io);
io.on('connection', (socket) => {
  console.log(`📡 Live UI Sync Active - User Connected: ${socket.id}`);
});

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================
// ✅ CRITICAL: Fixed Express CORS to use the same array as Socket.io
app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
})); 

app.use(cookieParser());

// STRIPE WEBHOOK MUST BYPASS EXPRESS.JSON()
app.post('/api/bookings/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Standard Middleware
app.use(express.json());
app.use(rateLimiter);

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const redisPing = await redisClient.ping();
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';

    res.status(200).json({
      status: 'Healthy',
      redis: redisPing === 'PONG' ? 'Connected' : 'Degraded',
      mongoDB: mongoStatus
    });
  } catch (error) {
    res.status(503).json({ status: 'Degraded', error: error.message });
  }
});

// ==========================================
// SERVER BOOT 
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ConcurrentTix Enterprise Backend initialized on port ${PORT}`);
});