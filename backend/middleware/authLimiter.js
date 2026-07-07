import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.LOAD_TEST_MODE === 'true' ? 5000 : 10, // TEMP: raised for load testing // 10 login/register attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  store: redisClient && redisClient.isReady
    ? new RedisStore({ sendCommand: (...args) => redisClient.call(...args) })
    : undefined
});

export default authLimiter;