import express from 'express';
import multer from 'multer';
import { getUsers, deleteUser, getUserProfile, uploadProfilePicture, getSystemStats } from '../controllers/userController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// MULTER CONFIGURATION (Memory Storage)
// Holds the incoming image in RAM before sending to AWS S3
// ==========================================
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Strict 5MB limit to prevent server memory bloat
});

// ==========================================
// PUBLIC / USER ROUTES
// ==========================================
// CRITICAL: This route MUST come before /:id, otherwise Express 
// will think "profile" is an ID and crash!
router.get('/profile', verifyToken, getUserProfile);

// NEW: The AWS S3 Image Upload Endpoint
// Intercepted by verifyToken (auth) and upload.single (multer)
router.post('/upload-profile-picture', verifyToken, upload.single('profileImage'), uploadProfilePicture);

// ==========================================
// ADMIN ROUTES
// ==========================================
// NEW: Fetch real-time system stats
router.get('/admin/stats', verifyToken, verifyAdmin, getSystemStats);

// Get all users (Admin only)
router.get('/', verifyToken, verifyAdmin, getUsers);
// Delete a user (Admin only)
router.delete('/:id', verifyToken, verifyAdmin, deleteUser);

export default router;