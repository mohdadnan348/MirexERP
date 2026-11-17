
import { Router, Request, Response } from "express";
import mongoose from "mongoose";

const router = Router();

/**
 * GET /api/health
 * Basic server health check
 */
router.get("/", (_req: Request, res: Response) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? "MirexERP API is running successfully"
      : "API is running but database is disconnected",
    data: {
      application: "MirexERP School ERP",
      status: databaseConnected ? "healthy" : "degraded",
      database: {
        status: databaseConnected ? "connected" : "disconnected",
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
  });
});

/**
 * GET /api/health/ping
 * Lightweight ping endpoint
 */
router.get("/ping", (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: "Pong",
    timestamp: new Date().toISOString(),
  });
});

export default router;
