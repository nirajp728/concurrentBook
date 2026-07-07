import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  wallet: { 
    type: Number, 
    default: 1000 
  },
  // NEW: Store the AWS S3 URL here
  profilePicture: {
    type: String,
    default: '' // You can leave this blank, the frontend already handles the fallback UI!
  },
  // HISTORY 1: The Transaction Ledger (Pure Money)
  walletHistory: [{
    transactionType: { type: String, enum: ['CREDIT', 'DEBIT', 'REFUND'] },
    amount: Number,
    description: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // HISTORY 2: The Ticket Ledger (Event & Seat Details)
  bookingHistory: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    seats: [String],
    amountPaid: Number,
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'REFUNDED'] },
    transactionId: String, 
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);