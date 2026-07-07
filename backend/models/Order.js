import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  seats: [{ type: String, required: true }],
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  stripePaymentIntentId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, unique: true },
  holdExpiry: { type: Date, required: true },
  failureReason: { type: String }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);