import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  seatNumber: { type: String, required: true },
  status: { type: String, enum: ['HELD', 'BOOKED'], required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // wired up when we build bookingController
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  holdExpiry: { type: Date } // only meaningful while status is 'HELD'
}, { timestamps: true });

// THE hard guarantee: one seat, one document, ever.
// This is the unique index we designed — no double-booking is possible past this line.
bookingSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model('Booking', bookingSchema);