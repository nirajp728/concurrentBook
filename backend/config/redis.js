import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient;

try {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('⚠️ Redis connection failed. Proceeding with local memory fallback.');
        return null; 
      }
      return Math.min(times * 50, 2000);
    }
  });

  redisClient.on('error', (err) => {
    redisClient.isReady = false;
    // Log the actual error message so you know WHY it failed
    console.error('🔴 Redis Client Error:', err.message);
  });

  // Changed to an async callback to support the PING
  redisClient.on('connect', async () => {
    redisClient.isReady = true;
    console.log('🟢 Redis connected successfully for distributed caching/locking');
    
    // --- The Active PING Verification ---
    try {
      const response = await redisClient.ping();
      if (response === 'PONG') {
        console.log('✅ Redis is actively responding to PING commands!');
      }
    } catch (pingError) {
      console.error('❌ Redis connected but failed to respond to PING:', pingError.message);
    }
  });

} catch (error) {
  console.warn('Redis initialization error. Fallback activated.');
  redisClient = { isReady: false };
}

export default redisClient;