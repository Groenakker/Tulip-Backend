import multer from 'multer';

// Configure multer to handle file uploads in memory
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Error handler for multer
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware for single file upload (profile picture)
export const uploadProfilePicture = upload.single('profilePicture');

// Middleware for single file upload (project image)
export const uploadProjectImage = upload.single('image');

// Document file filter (PDF, DOC, DOCX)
const documentFileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC and DOCX files are allowed'), false);
  }
};

// Multer for document uploads (larger limit: 10MB)
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Max files per create request
const MAX_DOCUMENT_FILES = 20;

// Middleware for single or multiple document file upload
export const uploadDocumentFile = uploadDocument.array('file', MAX_DOCUMENT_FILES);

