import express from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3Client from '../config/s3.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Hold the file in RAM instead of disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/poster', verifyAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const fileName = `events/posters/${Date.now()}-${req.file.originalname}`;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);
    
    // Construct the public S3 URL
    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.json({ imageUrl: s3Url });
  } catch (error) {
    res.status(500).json({ message: 'S3 Upload failed' });
  }
});

export default router;