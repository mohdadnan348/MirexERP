
import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import apiRoutes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { globalRateLimiter } from "./middleware/rateLimiter";
import { isDatabaseConnected } from "./database/connection";

const app: Application = express();

// Trust proxy (Render, VPS, reverse proxy deployments)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:8081"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-School-Id",
    ],
  })
);

// Request parsing
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Compression
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "MirexERP API is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Readiness is separate from liveness: traffic should only be routed here
// after the database connection is established.
app.get("/ready", (_req: Request, res: Response) => {
  const databaseReady = isDatabaseConnected();
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    status: databaseReady ? "ready" : "not_ready",
    checks: { database: databaseReady ? "connected" : "disconnected" },
    timestamp: new Date().toISOString(),
  });
});

// API rate limiter
app.use("/api", globalRateLimiter);

// API routes
app.use("/api/v1", apiRoutes);

// 404 handler
app.use(notFound);

// Global error handler (always last)
app.use(errorHandler);

export default app;
