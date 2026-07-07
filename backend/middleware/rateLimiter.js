import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.LOAD_TEST_MODE === 'true' ? 5000 : 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this device. Please try again later.' },
  store: redisClient && redisClient.isReady 
    ? new RedisStore({ sendCommand: (...args) => redisClient.call(...args) })
    : undefined
});

export default limiter;