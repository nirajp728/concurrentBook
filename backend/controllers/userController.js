import User from '../models/User.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import Event from '../models/Event.js';
import os from 'os';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

export const getUserProfile = async (req, res) => {
  try {
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

export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = { email: { $regex: search, $options: 'i' } };
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    const usersWithDetails = users.map(user => {
      const successfulBookings = user.bookingHistory
        ? user.bookingHistory.filter(booking => booking.status === 'SUCCESS').length
        : 0;

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallet: user.wallet || 0,
        bookings: successfulBookings
      };
    });

    res.status(200).json(usersWithDetails);
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

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

export const uploadProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  const userId = req.user.id || req.user._id;

  try {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const originalNameCleaned = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const fileName = `profiles/${userId}-${randomHex}-${originalNameCleaned}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    await User.findByIdAndUpdate(userId, { profilePicture: imageUrl });

    res.status(200).json({
      message: 'Profile picture updated successfully',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('AWS S3 Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload image to S3', error: error.message });
  }
};

export const getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();

    const bookingStats = await User.aggregate([
      { $unwind: "$bookingHistory" },
      { $match: { "bookingHistory.status": "SUCCESS" } },
      { $count: "totalBookings" }
    ]);
    const totalBookings = bookingStats.length > 0 ? bookingStats[0].totalBookings : 0;

    const loadAvg = os.loadavg()[0];
    const coreCount = os.cpus().length;
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

// ==========================================
// 6. ADJUST USER WALLET (Admin Only)
// Credits or debits any user's wallet. Positive amount = credit, negative = debit.
// ==========================================
export const adjustUserWallet = async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount === 0) {
    return res.status(400).json({ message: 'Amount must be a non-zero number' });
  }

  try {
    if (parsedAmount < 0) {
      const updated = await User.findOneAndUpdate(
        { _id: id, wallet: { $gte: Math.abs(parsedAmount) } },
        {
          $inc: { wallet: parsedAmount },
          $push: {
            walletHistory: {
              transactionType: 'DEBIT',
              amount: Math.abs(parsedAmount),
              description: description || 'Admin wallet deduction'
            }
          }
        },
        { new: true }
      ).select('-password');

      if (!updated) {
        return res.status(400).json({ message: 'Insufficient balance for this deduction' });
      }
      return res.status(200).json(updated);
    } else {
      const updated = await User.findByIdAndUpdate(
        id,
        {
          $inc: { wallet: parsedAmount },
          $push: {
            walletHistory: {
              transactionType: 'CREDIT',
              amount: parsedAmount,
              description: description || 'Admin wallet credit'
            }
          }
        },
        { new: true }
      ).select('-password');

      if (!updated) return res.status(404).json({ message: 'User not found' });
      return res.status(200).json(updated);
    }
  } catch (error) {
    console.error('Error adjusting wallet:', error);
    res.status(500).json({ message: 'Failed to adjust wallet', error: error.message });
  }
};