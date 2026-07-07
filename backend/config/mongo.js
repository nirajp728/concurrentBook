import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectMongo = async () => {
  try {
    // 1. Enforce strict queries (Security best practice & suppresses Mongoose warnings)
    mongoose.set('strictQuery', true);

    // 2. Connect with a 5-second timeout so it fails fast if your IP isn't whitelisted
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, 
    });

    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // 3. Provide a smart hint to immediately diagnose the most common Atlas errors
    if (error.message.includes('bad auth') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 HINT: Check your password for typos, and ensure your IP is whitelisted (0.0.0.0/0) in Atlas Network Access!');
    }
    
    process.exit(1); // Exit process with failure to prevent half-booted servers
  }
};

// 4. Live Monitoring: Listen for connection drops AFTER the initial bootup
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB cluster disconnected! Mongoose will attempt to reconnect in the background...');
});

export default connectMongo;