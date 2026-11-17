
import { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { env } from "../config/env";

/**
 * General API rate limiter.
 *
 * Default configuration:
 * 100 requests per 15 minutes per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    statusCode: 429,
  },

  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
      statusCode: 429,
    });
  },

  /**
   * Do not count successful requests separately.
   * Every request is counted by default.
   */
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Strict rate limiter for authentication routes.
 *
 * Allows 5 requests per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many authentication attempts. Please try again after 15 minutes.",
    statusCode: 429,
  },

  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message:
        "Too many authentication attempts. Please try again after 15 minutes.",
      statusCode: 429,
    });
  },

  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Rate limiter for sensitive operations.
 *
 * Allows 20 requests per 15 minutes per IP.
 */
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests for this operation. Please try again later.",
    statusCode: 429,
  },

  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message:
        "Too many requests for this operation. Please try again later.",
      statusCode: 429,
    });
  },

  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});


/**
 * Rate limiter for Super Admin account creation.
 * Allows 20 requests per 15 minutes per IP.
 * Kept separate from login to avoid blocking legitimate school-user setup.
 */
export const adminAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many account creation attempts. Please try again later.",
    statusCode: 429,
  },

  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: "Too many account creation attempts. Please try again later.",
      statusCode: 429,
    });
  },

  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});
