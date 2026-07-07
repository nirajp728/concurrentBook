import User from '../models/User.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import Event from '../models/Event.js';
import os from 'os';

// ==========================================
// AWS S3 CLIENT INITIALIZATION
// ==========================================
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// ==========================================
// 1. GET LOGGED-IN USER PROFILE
// ==========================================
export const getUserProfile = async (req, res) => {
  try {
    // The .populate() command replaces the raw Event ID in the history 
    // array with the actual Event document so the React frontend can read the title.
    const user = await User.findById(req.user.id || req.user._id)
      .populate('bookingHistory.eventId', 'title date posterUrl') 
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

// ==========================================
// 2. GET ALL USERS (Admin Dashboard)
// ==========================================
export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    // If the admin types in the search box, filter MongoDB by email
    if (search) {
      query = { email: { $regex: search, $options: 'i' } }; // 'i' makes it case-insensitive
    }

    // Fetch users, explicitly EXCLUDING the password hash for security
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    
    // Map the users to include real booking counts and wallet balances!
    const usersWithDetails = users.map(user => {
      // Calculate how many SUCCESSFUL bookings this user has made
      const successfulBookings = user.bookingHistory 
        ? user.bookingHistory.filter(booking => booking.status === 'SUCCESS').length 
        : 0;

      return {
        id: user._id,
        name: user.name, 
        email: user.email,
        role: user.role,
        wallet: user.wallet || 0,     // Expose wallet balance to Admin
        bookings: successfulBookings  // Replaced the placeholder with REAL data!
      };
    });

    res.status(200).json(usersWithDetails);
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// ==========================================
// 3. DELETE USER (Admin Only)
// ==========================================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Safety Check: Prevent admins from accidentally deleting themselves!
    const currentAdminId = req.user.id || req.user._id;
    if (currentAdminId && currentAdminId === id) {
      return res.status(400).json({ message: "Action Denied: You cannot delete your own admin account." });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: `User ${deletedUser.email} deleted successfully` });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};

// ==========================================
// 4. UPLOAD & UPDATE PROFILE PICTURE (S3)
// ==========================================
export const uploadProfilePicture = async (req, res) => {
  // req.file is provided by the Multer middleware in your routes
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  const userId = req.user.id || req.user._id; 

  try {
    // 1. Generate a unique, secure filename
    const randomHex = crypto.randomBytes(8).toString('hex');
    const originalNameCleaned = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const fileName = `profiles/${userId}-${randomHex}-${originalNameCleaned}`;

    // 2. Prepare the AWS Upload Command
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME, // Matches your .env exactly
      Key: fileName,
      Body: req.file.buffer, // Raw image data from RAM
      ContentType: req.file.mimetype, // e.g., 'image/jpeg'
    });

    // 3. Fire it off to AWS
    await s3Client.send(command);

    // 4. Construct the public URL where the image now lives
    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // 5. Update the user's profile in MongoDB
    await User.findByIdAndUpdate(userId, { profilePicture: imageUrl });

    // 6. Send the new URL back to the React app
    res.status(200).json({ 
      message: 'Profile picture updated successfully',
      imageUrl: imageUrl 
    });

  } catch (error) {
    console.error('AWS S3 Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload image to S3', error: error.message });
  }
};



// ==========================================
// 5. GET SYSTEM STATS (Admin Dashboard)
// ==========================================
export const getSystemStats = async (req, res) => {
  try {
    // 1. Count total users
    const totalUsers = await User.countDocuments();

    // 2. Count active events
    const totalEvents = await Event.countDocuments();

    // 3. Count total successful bookings across all users using MongoDB Aggregation
    const bookingStats = await User.aggregate([
      { $unwind: "$bookingHistory" },
      { $match: { "bookingHistory.status": "SUCCESS" } },
      { $count: "totalBookings" }
    ]);
    const totalBookings = bookingStats.length > 0 ? bookingStats[0].totalBookings : 0;

    // 4. Calculate REAL Live Server Load (CPU Usage)
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const coreCount = os.cpus().length;
    // Calculate percentage and cap it at 100%
    const serverLoad = Math.min(100, Math.round((loadAvg / coreCount) * 100));

    res.status(200).json({
      users: totalUsers,
      events: totalEvents,
      bookings: totalBookings,
      load: `${serverLoad}%`
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    res.status(500).json({ message: 'Failed to fetch system statistics' });
  }
};