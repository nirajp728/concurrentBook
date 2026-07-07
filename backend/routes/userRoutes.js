import express from 'express';
import multer from 'multer';
import { getUsers, deleteUser, getUserProfile, uploadProfilePicture, getSystemStats, adjustUserWallet } from '../controllers/userController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/profile', verifyToken, getUserProfile);
router.post('/upload-profile-picture', verifyToken, upload.single('profileImage'), uploadProfilePicture);

router.get('/admin/stats', verifyToken, verifyAdmin, getSystemStats);
router.get('/', verifyToken, verifyAdmin, getUsers);
router.delete('/:id', verifyToken, verifyAdmin, deleteUser);
router.patch('/:id/wallet', verifyToken, verifyAdmin, adjustUserWallet);

export default router;