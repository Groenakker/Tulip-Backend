import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

// Load environment variables FIRST before any other imports
dotenv.config();

// Validate environment variables
import { validateEnv } from "./config/env.js";
validateEnv();

import { connectDB } from "./lib/db.js";
import "./lib/redis.js"; // Initialize Redis connection
import authRoutes from "./routes/auth.route.js";
import bPartnerRoutes from "./routes/bPartners.route.js";
import projectRoutes from "./routes/projects.route.js";
import testCodesRoutes from "./routes/testCodes.route.js";
import receivingRoutes from "./routes/receivings.route.js";
import shippingRoutes from "./routes/shipping.route.js";
import samplesRoutes from "./routes/samples.route.js";
import documentsRoutes from "./routes/documents.route.js";
import instanceRoutes from "./routes/instances.route.js";
import instanceMovementsRoutes from "./routes/instanceMovements.route.js";
import companyRoutes from "./routes/companies.route.js";
import warehousesRoutes from "./routes/warehouses.route.js";
import permissionsRoutes from "./routes/permissions.route.js";
import rolesRoutes from "./routes/roles.route.js";
import usersRoutes from "./routes/users.route.js";
import healthRoutes from "./routes/health.route.js";

const app = express();

// Increase JSON body parser limit to handle large base64 images (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

// Configure CORS to allow credentials
const allowedOrigins = [
  'http://localhost:5173',
  'https://groenakker.netlify.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

const corsOptions = {
  origin: (origin, callback) => {
    // In production, reject requests with no origin
    if (process.env.NODE_ENV === 'production' && !origin) {
      return callback(new Error('Not allowed by CORS'));
    }

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use("/health", healthRoutes);
app.use(cors(corsOptions));
app.use("/api/auth", authRoutes);
app.use("/api/bpartners", bPartnerRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/testcodes", testCodesRoutes);
app.use("/api/receivings", receivingRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/samples", samplesRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/instances", instanceRoutes);
app.use("/api/instance-movements", instanceMovementsRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/users", usersRoutes);

app.listen(PORT, () => {
  console.log("server is running on port " + PORT);
  connectDB();
});