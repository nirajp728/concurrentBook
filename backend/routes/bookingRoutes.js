import express from 'express';
// Remove enqueueBooking, add createPaymentIntent
import { createPaymentIntent } from '../controllers/bookingController.js'; 
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Update this route to use the new combined controller function
router.post('/create-payment-intent', verifyToken, createPaymentIntent);

export default router;