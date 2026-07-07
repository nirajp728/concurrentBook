import mongoose from 'mongoose';

const processedWebhookEventSchema = new mongoose.Schema({
  stripeEventId: { type: String, required: true, unique: true },
  type: { type: String }
}, { timestamps: true });

export default mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);