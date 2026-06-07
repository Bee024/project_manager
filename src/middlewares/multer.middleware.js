import fs from "fs";
import multer from "multer";
import path from "path";
import { ApiError } from "../utils/api-error.js";

const uploadDir = path.resolve("public", "images");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const sanitizeFileName = (fileName) => {
  return fileName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${sanitizeFileName(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new ApiError(415, "Unsupported file type"));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1000 * 1000,
    files: 5,
  },
});
