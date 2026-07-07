import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import {
  getEventBookings,
  getEventLocks,
  forceReleaseLock,
  cancelBooking
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/events/:eventId/bookings', verifyToken, verifyAdmin, getEventBookings);
router.get('/events/:eventId/locks', verifyToken, verifyAdmin, getEventLocks);
router.delete('/events/:eventId/locks/:seatNumber', verifyToken, verifyAdmin, forceReleaseLock);
router.post('/events/:eventId/bookings/:seatNumber/cancel', verifyToken, verifyAdmin, cancelBooking);

export default router;