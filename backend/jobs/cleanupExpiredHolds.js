import cron from 'node-cron';
import Order from '../models/Order.js';
import Booking from '../models/Booking.js';
import redisClient from '../config/redis.js';
import stripePackage from 'stripe';

const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);

export function startCleanupJob(io) {
  cron.schedule('* * * * *', async () => {
    const staleOrders = await Order.find({ status: 'PENDING', holdExpiry: { $lt: new Date() } });

    for (const order of staleOrders) {
      try {
        await Booking.deleteMany({ eventId: order.eventId, seatNumber: { $in: order.seats }, orderId: order._id, status: 'HELD' });

        const pipeline = redisClient.pipeline();
        order.seats.forEach(seat => pipeline.del(`lock:event:${order.eventId}:seat:${seat}`));
        await pipeline.exec();

        await stripe.paymentIntents.cancel(order.stripePaymentIntentId).catch(() => {});

        order.status = 'FAILED';
        order.failureReason = 'Abandoned — payment never completed within hold window';
        await order.save();

        if (io) io.emit('seatsUnlocked', { eventId: order.eventId, seats: order.seats });
        console.log(`🧹 Released abandoned hold for order ${order._id}`);
      } catch (err) {
        console.error(`Cleanup failed for order ${order._id}:`, err.message);
      }
    }
  });
}