import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { getElasticClient } from '../config/elastic.js';

import redisClient from '../config/redis.js';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import Booking from '../models/Booking.js';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// ==========================================
// SEARCH / SORT HELPERS
// ==========================================
const ALLOWED_SORT_FIELDS = ['createdAt', 'date', 'price', 'title'];
const DEFAULT_SORT_FIELD = 'createdAt';
const DEFAULT_SORT_ORDER = -1;

function parseSort(sortParam) {
  let field = DEFAULT_SORT_FIELD;
  let order = DEFAULT_SORT_ORDER;

  if (sortParam) {
    const [rawField, rawOrder] = sortParam.split(':');
    if (ALLOWED_SORT_FIELDS.includes(rawField)) {
      field = rawField;
    }
    if (rawOrder === '1' || rawOrder === '-1') {
      order = parseInt(rawOrder, 10);
    }
  }
  return { field, order };
}

// Escapes regex special characters so user search text can never break out
// of the regex or trigger catastrophic backtracking (ReDoS).
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 1. CREATE EVENT (Admin Only)
// ==========================================
export const createEvent = async (req, res) => {
  const { title, type, price, venue, date, posterUrl } = req.body;

  try {
    const newEvent = await Event.create({ title, type, price, venue, date, posterUrl });

    const elasticClient = getElasticClient();
    if (elasticClient) {
      try {
        await elasticClient.index({
          index: 'events',
          id: newEvent._id.toString(),
          document: { title, type, price: parseFloat(price), venue, date, posterUrl }
        });
        await elasticClient.indices.refresh({ index: 'events' });
      } catch (esError) {
        console.warn('Elasticsearch synchronization skipped/failed:', esError.message);
      }
    }

    res.status(201).json({ message: 'Event deployed successfully', event: newEvent });
  } catch (error) {
    res.status(500).json({ message: 'Admin event creation failed', error: error.message });
  }
};

// ==========================================
// 2. GET ALL EVENTS (search + sort, engine picked here)
// ==========================================
export const getEvents = async (req, res) => {
  try {
    const { search, type, sort } = req.query;
    const { field, order } = parseSort(sort);

    const elasticClient = getElasticClient();

    // ---- ENGINE A: ELASTICSEARCH (only if elastic.js has a live client) ----
    if (elasticClient) {
      console.log("🔍 Searching via Elasticsearch");

      const must = [];
      const filter = [];

      if (search) {
        must.push({
          multi_match: {
            query: search,
            fields: ['title^3', 'venue']
          }
        });
      }

      if (type && type !== 'all') {
        filter.push({ term: { type } });
      }

      const esQuery = (must.length === 0 && filter.length === 0)
        ? { match_all: {} }
        : { bool: { must, filter } };

      const result = await elasticClient.search({
        index: 'events',
        body: {
          query: esQuery,
          sort: [{ [field]: { order: order === 1 ? 'asc' : 'desc' } }]
        }
      });

      const hits = result.hits?.hits || result.body?.hits?.hits || [];
      const elasticEvents = hits.map(hit => ({ _id: hit._id, ...hit._source }));
      return res.status(200).json(elasticEvents);
    }

    // ---- ENGINE B: MONGODB (local fallback, aggregation pipeline) ----
    console.log("💾 Searching via MongoDB");

    const pipeline = [];
    const match = {};

    if (type && type !== 'all') {
      match.type = type;
    }

    if (search) {
      const safeSearch = escapeRegex(search.trim());
      if (safeSearch) {
        match.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { venue: { $regex: safeSearch, $options: 'i' } }
        ];
      }
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push({ $sort: { [field]: order } });

    const events = await Event.aggregate(pipeline);
    return res.status(200).json(events);

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events', error: error.message });
  }
};

// ==========================================
// 3. GET SINGLE EVENT DETAILS & SEATS
// ==========================================
export const getEventById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const event = await Event.findById(id).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    let bookedSeats = [];
    let lockedSeats = [];

    try {
      const seatDocs = await Booking.find({ eventId: id }).lean();
      bookedSeats = seatDocs.filter(s => s.status === 'BOOKED').map(s => s.seatNumber);
      lockedSeats = seatDocs.filter(s => s.status === 'HELD').map(s => s.seatNumber);
    } catch (dbError) {
      console.error("🍃 Booking lookup warning:", dbError.message);
    }

    res.status(200).json({ ...event, bookedSeats, lockedSeats });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch event', error: error.message });
  }
};

// ==========================================
// 4. UPDATE EVENT (Admin Only)
// ==========================================
export const updateEvent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const updatedEvent = await Event.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedEvent) return res.status(404).json({ message: 'Event not found' });

    const elasticClient = getElasticClient();
    if (elasticClient) {
      try {
        await elasticClient.update({
          index: 'events',
          id: updatedEvent._id.toString(),
          doc: req.body
        });
      } catch (esError) {
        console.warn('Elastic update skipped/failed');
      }
    }

    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
};

// ==========================================
// 5. DELETE EVENT (Admin Only)
// ==========================================
export const deleteEvent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Event ID format' });
  }

  try {
    const deletedEvent = await Event.findByIdAndDelete(id);
    if (!deletedEvent) return res.status(404).json({ message: 'Event not found' });

    const elasticClient = getElasticClient();
    if (elasticClient) {
      try {
        await elasticClient.delete({ index: 'events', id: id });
      } catch (esError) {
        console.warn('Elastic deletion skipped/failed');
      }
    }

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Deletion failed', error: error.message });
  }
};

// ==========================================
// 6. UPLOAD POSTER TO AWS S3 (Admin Only)
// ==========================================
export const uploadEventPoster = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No poster image provided' });
  }

  try {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const originalNameCleaned = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const fileName = `events/${randomHex}-${originalNameCleaned}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    res.status(200).json({ message: 'Poster uploaded successfully', imageUrl });
  } catch (error) {
    console.error('AWS S3 Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload poster to S3', error: error.message });
  }
};