import mongoose from "mongoose";
import redis from "../lib/redis.js";

export const healthCheck = async (req, res) => {
  try {
    const healthStatus = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        server: "ok",
        database: "unknown",
        redis: "unknown",
      },
    };

    // Check MongoDB connection
    try {
      if (mongoose.connection.readyState === 1) {
        healthStatus.services.database = "ok";
      } else {
        healthStatus.services.database = "disconnected";
        healthStatus.status = "degraded";
      }
    } catch (error) {
      healthStatus.services.database = "error";
      healthStatus.status = "degraded";
    }

    // Check Redis connection
    try {
      const redisStatus = redis.status;
      if (redisStatus === "ready" || redisStatus === "connect") {
        healthStatus.services.redis = "ok";
      } else {
        healthStatus.services.redis = "disconnected";
        healthStatus.status = "degraded";
      }
    } catch (error) {
      healthStatus.services.redis = "error";
      healthStatus.status = "degraded";
    }

    // Return appropriate status code
    const statusCode = healthStatus.status === "ok" ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
      error: error.message,
    });
  }
};

