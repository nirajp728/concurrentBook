import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import redisClient from '../config/redis.js';
import stripePackage from 'stripe';

const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);

// ==========================================
// 1. GET ALL BOOKED SEATS FOR AN EVENT
// ==========================================
export const getEventBookings = async (req, res) => {
  const { eventId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const bookings = await Booking.find({ eventId, status: 'BOOKED' })
      .populate('userId', 'name email')
      .sort({ seatNumber: 1 })
      .lean();

    const orderIds = bookings.map(b => b.orderId).filter(Boolean);
    const orders = await Order.find({ _id: { $in: orderIds } }).lean();
    const orderMap = new Map(orders.map(o => [o._id.toString(), o]));

    const enriched = bookings.map(b => {
      const order = b.orderId ? orderMap.get(b.orderId.toString()) : null;
      return {
        seatNumber: b.seatNumber,
        bookedAt: b.updatedAt,
        user: b.userId ? { id: b.userId._id, name: b.userId.name, email: b.userId.email } : null,
        amount: order?.amount || null,
        stripePaymentIntentId: order?.stripePaymentIntentId || null,
        orderId: order?._id || null
      };
    });

    res.status(200).json({
      event: { id: event._id, title: event.title },
      totalBooked: enriched.length,
      bookings: enriched
    });
  } catch (error) {
    console.error('Error fetching event bookings:', error);
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
};

// ==========================================
// 2. GET ALL LOCKED (HELD) SEATS FOR AN EVENT
// Cross-checks Mongo HELD docs against live Redis keys
// ==========================================
export const getEventLocks = async (req, res) => {
  const { eventId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const heldBookings = await Booking.find({ eventId, status: 'HELD' })
      .populate('userId', 'name email')
      .sort({ holdExpiry: 1 })
      .lean();

    const orderIds = heldBookings.map(b => b.orderId).filter(Boolean);
    const orders = await Order.find({ _id: { $in: orderIds } }).lean();
    const orderMap = new Map(orders.map(o => [o._id.toString(), o]));

    const redisKeys = await redisClient.keys(`lock:event:${eventId}:seat:*`);
    const redisLockedSeats = new Set(redisKeys.map(k => k.split(':').pop()));

    const now = new Date();
    const enriched = heldBookings.map(b => {
      const order = b.orderId ? orderMap.get(b.orderId.toString()) : null;
      return {
        seatNumber: b.seatNumber,
        heldSince: b.createdAt,
        holdExpiry: b.holdExpiry,
        isExpired: b.holdExpiry ? new Date(b.holdExpiry) < now : null,
        orderStatus: order?.status || null,
        inRedis: redisLockedSeats.has(b.seatNumber),
        user: b.userId ? { id: b.userId._id, name: b.userId.name, email: b.userId.email } : null
      };
    });

    const mongoSeats = new Set(heldBookings.map(b => b.seatNumber));
    const redisOnlyOrphans = [...redisLockedSeats].filter(s => !mongoSeats.has(s));

    res.status(200).json({
      event: { id: event._id, title: event.title },
      totalHeld: enriched.length,
      locks: enriched,
      redisOnlyOrphans
    });
  } catch (error) {
    console.error('Error fetching event locks:', error);
    res.status(500).json({ message: 'Failed to fetch locks', error: error.message });
  }
};

// ==========================================
// 3. FORCE-RELEASE A STUCK LOCK (manual ops tool)
// ==========================================
export const forceReleaseLock = async (req, res) => {
  const { eventId, seatNumber } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const booking = await Booking.findOne({ eventId, seatNumber, status: 'HELD' });
    if (!booking) {
      return res.status(404).json({ message: 'No active hold found for this seat' });
    }

    await Booking.deleteOne({ _id: booking._id });
    await redisClient.del(`lock:event:${eventId}:seat:${seatNumber}`);

    if (booking.orderId) {
      const order = await Order.findById(booking.orderId);
      if (order && order.status !== 'COMPLETED') {
        order.status = 'FAILED';
        order.failureReason = 'Manually released by admin';
        await order.save();

        if (order.stripePaymentIntentId) {
          await stripe.paymentIntents.cancel(order.stripePaymentIntentId).catch(() => {});
        }
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('seatsUnlocked', { eventId, seats: [seatNumber] });

    res.status(200).json({ message: `Seat ${seatNumber} manually released` });
  } catch (error) {
    console.error('Error force-releasing lock:', error);
    res.status(500).json({ message: 'Failed to release lock', error: error.message });
  }
};

// ==========================================
// 4. ADMIN-CANCEL A CONFIRMED BOOKING (real refund)
// ==========================================
export const cancelBooking = async (req, res) => {
  const { eventId, seatNumber } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const booking = await Booking.findOne({ eventId, seatNumber, status: 'BOOKED' });
    if (!booking) {
      return res.status(404).json({ message: 'No confirmed booking found for this seat' });
    }

    const order = booking.orderId ? await Order.findById(booking.orderId) : null;
    if (!order || order.status !== 'COMPLETED') {
      return res.status(409).json({ message: 'Booking has no completed order to refund' });
    }

    await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });

    await User.findByIdAndUpdate(order.userId, {
      $inc: { wallet: order.amount },
      $push: {
        walletHistory: {
          transactionType: 'REFUND',
          amount: order.amount,
          description: `Admin-cancelled booking, seat ${seatNumber}`
        }
      }
    });

    await User.updateOne(
      { _id: order.userId, 'bookingHistory.transactionId': order.stripePaymentIntentId },
      { $set: { 'bookingHistory.$.status': 'REFUNDED' } }
    );

    await Booking.deleteOne({ _id: booking._id });
    order.status = 'REFUNDED';
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('seatsUnlocked', { eventId, seats: [seatNumber] });
      io.emit(`refundAlert_${order.userId}`, {
        message: `Your booking for seat ${seatNumber} was cancelled by an admin and refunded.`,
        seats: [seatNumber]
      });
    }

    res.status(200).json({ message: `Seat ${seatNumber} cancelled and refunded successfully` });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Failed to cancel booking', error: error.message });
  }
};