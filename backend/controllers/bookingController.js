import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent.js';
import User from '../models/User.js';
import redisClient from '../config/redis.js';
import stripePackage from 'stripe';

const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);
const HOLD_DURATION_SECONDS = 600;
const HOLD_DURATION_MS = HOLD_DURATION_SECONDS * 1000;

const isValidSeatMatrix = (seat) => /^[A-F]([1-9]|10)$/.test(seat);

// ==========================================
// 1. LOCK SEATS & CREATE PAYMENT INTENT (authorize only, not captured)
// ==========================================
export const createPaymentIntent = async (req, res) => {
  const { eventId, seats, idempotencyKey } = req.body;
  const userId = req.user?._id || req.user?.id;

  if (!userId) return res.status(401).json({ message: "Authentication missing. Please log in again." });
  if (!Array.isArray(seats) || seats.length === 0) return res.status(400).json({ message: "No seats selected." });
  for (const seat of seats) {
    if (!isValidSeatMatrix(seat)) return res.status(400).json({ message: `Invalid seat: ${seat}` });
  }

  try {
    // Double-click / retry protection: same idempotencyKey → return the existing attempt, don't create a second one
    const existingOrder = await Order.findOne({ idempotencyKey });
    if (existingOrder) {
      if (existingOrder.status === 'FAILED') {
        return res.status(409).json({ message: 'This booking attempt already failed. Please start over.' });
      }
      const existingIntent = await stripe.paymentIntents.retrieve(existingOrder.stripePaymentIntentId);
      return res.status(200).json({ clientSecret: existingIntent.client_secret });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    const totalAmount = (event.price || 500) * seats.length;

    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    // Fast UX gate only — the atomic, real check happens at capture time in the webhook
    if (currentUser.wallet < totalAmount) {
      return res.status(400).json({ message: `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${currentUser.wallet}` });
    }

    // ---- Redis: fast doorman — now ATOMIC (SET NX), not check-then-write ----
    const acquiredByMe = [];
    for (const seat of seats) {
      const key = `lock:event:${eventId}:seat:${seat}`;
      const result = await redisClient.set(key, userId.toString(), 'EX', HOLD_DURATION_SECONDS, 'NX');
      if (result !== 'OK') {
        for (const s of acquiredByMe) await redisClient.del(`lock:event:${eventId}:seat:${s}`);
        return res.status(409).json({ message: `Seat ${seat} was just taken. Please select another.` });
      }
      acquiredByMe.push(seat);
    }

    // ---- Mongo: the law. Unique index is the real guarantee, not the Redis lock above ----
    const holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
    try {
      await Booking.insertMany(
        seats.map(seat => ({ eventId, seatNumber: seat, status: 'HELD', userId, holdExpiry })),
        { ordered: true }
      );
    } catch (dbError) {
      for (const seat of seats) await redisClient.del(`lock:event:${eventId}:seat:${seat}`);
      await Booking.deleteMany({ eventId, seatNumber: { $in: seats }, status: 'HELD', userId });
      return res.status(409).json({ message: `One of the selected seats was just taken. Please select another.` });
    }

    // ---- Stripe: authorize only. Nothing is charged yet. ----
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100,
      currency: 'inr',
      capture_method: 'manual',
      metadata: { eventId, userId: userId.toString(), seats: JSON.stringify(seats) },
    }, { idempotencyKey });

    const order = await Order.create({
      userId, eventId, seats, amount: totalAmount,
      status: 'PENDING',
      stripePaymentIntentId: paymentIntent.id,
      idempotencyKey,
      holdExpiry
    });

    await Booking.updateMany(
      { eventId, seatNumber: { $in: seats }, status: 'HELD', userId },
      { $set: { orderId: order._id } }
    );

    const io = req.app.get('io');
    if (io) io.emit('seatsLocked', { eventId, seats });

    res.status(200).json({ clientSecret: paymentIntent.client_secret, holdExpiry: order.holdExpiry });
  } catch (error) {
    console.error("Payment Intent Error:", error);
    for (const seat of seats || []) await redisClient.del(`lock:event:${eventId}:seat:${seat}`).catch(() => {});
    await Booking.deleteMany({ eventId, seatNumber: { $in: seats || [] }, status: 'HELD', userId }).catch(() => {});
    res.status(500).json({ message: "Failed to initialize payment." });
  }
};

// ==========================================
// 2. STRIPE WEBHOOK — event-id dedup, then route by type
// ==========================================
export const stripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`🚨 Webhook signature failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: unique index on stripeEventId rejects any event we've already handled
  try {
    await ProcessedWebhookEvent.create({ stripeEventId: event.id, type: event.type });
  } catch {
    console.log(`↩️ Duplicate webhook ${event.id} ignored.`);
    return res.status(200).json({ received: true });
  }

  const paymentData = event.data.object;
  const io = req.app.get('io');

  try {
    if (event.type === 'payment_intent.amount_capturable_updated') {
      await handleAuthorizationSucceeded(paymentData, io);
    } else if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      await handleAuthorizationFailed(paymentData, io);
    }
  } catch (err) {
    console.error('🚨 Webhook processing error:', err);
  }

  res.status(200).json({ received: true });
};

// Authorization succeeded → commit seats + wallet atomically, then capture. Or void, if either fails.
async function handleAuthorizationSucceeded(paymentData, io) {
  const order = await Order.findOne({ stripePaymentIntentId: paymentData.id });
  if (!order || order.status !== 'PENDING') return; // already handled, or stale

  order.status = 'PROCESSING';
  await order.save();

  const { eventId, seats: seatArray, userId, amount } = order;
  const committed = [];
  let conflict = false;

  for (const seat of seatArray) {
    const updated = await Booking.findOneAndUpdate(
      { eventId, seatNumber: seat, status: 'HELD', orderId: order._id },
      { $set: { status: 'BOOKED' } },
      { new: true }
    );
    if (!updated) { conflict = true; break; }
    committed.push(seat);
  }

  if (conflict) {
    await Booking.deleteMany({ eventId, seatNumber: { $in: seatArray }, orderId: order._id });
    return voidOrder(order, 'Seat no longer available at capture time', io);
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, wallet: { $gte: amount } },
    {
      $inc: { wallet: -amount },
      $push: {
        bookingHistory: { eventId, seats: seatArray, amountPaid: amount, status: 'SUCCESS', transactionId: paymentData.id },
        walletHistory: { transactionType: 'DEBIT', amount, description: `Booked seats ${seatArray.join(', ')}` }
      }
    },
    { new: true }
  );

  if (!updatedUser) {
    await Booking.deleteMany({ eventId, seatNumber: { $in: seatArray }, orderId: order._id });
    return voidOrder(order, 'Insufficient wallet balance at capture time', io);
  }

  await stripe.paymentIntents.capture(paymentData.id);

  const pipeline = redisClient.pipeline();
  seatArray.forEach(seat => pipeline.del(`lock:event:${eventId}:seat:${seat}`));
  await pipeline.exec();

  order.status = 'COMPLETED';
  await order.save();

  if (io) io.emit('seatsBooked', { eventId, seats: seatArray });
}

// Shared failure path: void the Stripe authorization, free everything, notify the user — no refund needed, nothing was ever taken
async function voidOrder(order, reason, io) {
  await stripe.paymentIntents.cancel(order.stripePaymentIntentId)
    .catch(e => console.warn('Void skipped (already canceled?):', e.message));

  const pipeline = redisClient.pipeline();
  order.seats.forEach(seat => pipeline.del(`lock:event:${order.eventId}:seat:${seat}`));
  await pipeline.exec();

  order.status = 'FAILED';
  order.failureReason = reason;
  await order.save();

  await User.findByIdAndUpdate(order.userId, {
    $push: { bookingHistory: { eventId: order.eventId, seats: order.seats, amountPaid: 0, status: 'FAILED', transactionId: order.stripePaymentIntentId } }
  });

  if (io) {
    io.emit(`refundAlert_${order.userId}`, { message: `Booking failed: ${reason}. You were not charged.`, seats: order.seats });
    io.emit('seatsUnlocked', { eventId: order.eventId, seats: order.seats });
  }
}

// Card declined / user canceled at Stripe's side
async function handleAuthorizationFailed(paymentData, io) {
  const order = await Order.findOne({ stripePaymentIntentId: paymentData.id });
  if (!order || ['COMPLETED', 'FAILED'].includes(order.status)) return;

  await Booking.deleteMany({ eventId: order.eventId, seatNumber: { $in: order.seats }, orderId: order._id, status: 'HELD' });

  const pipeline = redisClient.pipeline();
  order.seats.forEach(seat => pipeline.del(`lock:event:${order.eventId}:seat:${seat}`));
  await pipeline.exec();

  order.status = 'FAILED';
  order.failureReason = 'Payment authorization failed or canceled';
  await order.save();

  await User.findByIdAndUpdate(order.userId, {
    $push: { bookingHistory: { eventId: order.eventId, seats: order.seats, amountPaid: 0, status: 'FAILED', transactionId: paymentData.id } }
  });

  if (io) io.emit('seatsUnlocked', { eventId: order.eventId, seats: order.seats });
}