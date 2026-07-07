import express from 'express';
import { 
  getEvents,      // Fixed: matches the exact name in eventController.js
  getEventById, 
  createEvent, 
  updateEvent, 
  deleteEvent 
} from '../controllers/eventController.js';
import { uploadEventPoster } from '../controllers/eventController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import multer from 'multer';

const router = express.Router();
// Configure Multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for high-res posters
});

// ==========================================
// PUBLIC ROUTES (High Traffic Search & Discovery)
// ==========================================
// Handles all OpenSearch / MongoDB queries
router.get('/', getEvents); 

// Handles single event details pages
router.get('/:id', getEventById);

// ==========================================
// ADMIN ROUTES (Strictly Protected)
// ==========================================
// Notice we chain verifyToken FIRST to ensure they are logged in, 
// then verifyAdmin SECOND to ensure they have the correct permissions.
// Add this route ABOVE your generic /:id routes
// Note: Frontend looks for 'posterImage', so upload.single must match!
router.post('/upload-poster', verifyToken, verifyAdmin, upload.single('posterImage'), uploadEventPoster);

router.post('/admin/events', verifyToken, verifyAdmin, createEvent);
router.put('/admin/events/:id', verifyToken, verifyAdmin, updateEvent);
router.delete('/admin/events/:id', verifyToken, verifyAdmin, deleteEvent);



export default router;