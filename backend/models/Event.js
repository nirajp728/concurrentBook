import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Movie', 'Concert'] // Strict validation to prevent bad data
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  venue: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  posterUrl: {
    type: String,
    // Provide a graceful fallback image if the S3 upload is ever skipped
    default: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=400&auto=format&fit=crop'
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

const Event = mongoose.model('Event', eventSchema);

export default Event;