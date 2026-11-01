import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config';

const tmpDir = path.join(os.tmpdir(), 'stitcher-uploads');
fs.mkdirSync(tmpDir, { recursive: true });

// Uploads are written to a temp file first, then handed to the storage layer.
// Handlers must delete req.file.path when they are done.
const diskStorage = multer.diskStorage({
  destination: tmpDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage: diskStorage,
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});
