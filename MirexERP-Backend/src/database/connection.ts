
import mongoose from "mongoose";
import {
  databaseConfig,
  configureMongoose,
} from "../config/database";
import { logger } from "../utils/logger";

// ==========================================
// DATABASE CONNECTION
// ==========================================

let isConnecting = false;

const getErrorMetadata = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
};

export const connectDatabase = async (): Promise<void> => {
  // Avoid duplicate connection attempts.
  if (mongoose.connection.readyState === 1) {
    logger.info("MongoDB is already connected.");
    return;
  }

  if (isConnecting) {
    logger.warn("MongoDB connection is already in progress.");
    return;
  }

  isConnecting = true;

  try {
    configureMongoose();

    logger.info("Connecting to MongoDB...");

    await mongoose.connect(
      databaseConfig.uri,
      databaseConfig.options
    );

    logger.info(
      `MongoDB connected successfully: ${mongoose.connection.name}`
    );
  } catch (error: unknown) {
    logger.error(
      "MongoDB connection failed:",
      getErrorMetadata(error)
    );

    throw error;
  } finally {
    isConnecting = false;
  }
};

// ==========================================
// DATABASE CONNECTION EVENTS
// ==========================================

mongoose.connection.on("connected", () => {
  logger.info("MongoDB connection established.");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB connection disconnected.");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB connection restored.");
});

mongoose.connection.on("error", (error: Error) => {
  logger.error(
    "MongoDB connection error:",
    getErrorMetadata(error)
  );
});

// ==========================================
// DATABASE DISCONNECTION
// ==========================================

export const disconnectDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 0) {
      logger.info("MongoDB is already disconnected.");
      return;
    }

    await mongoose.disconnect();

    logger.info("MongoDB disconnected successfully.");
  } catch (error: unknown) {
    logger.error(
      "MongoDB disconnection failed:",
      getErrorMetadata(error)
    );

    throw error;
  }
};

// ==========================================
// DATABASE HEALTH CHECK
// ==========================================

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

// ==========================================
// DATABASE INFORMATION
// ==========================================

export const getDatabaseInfo = () => {
  return {
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    readyState: mongoose.connection.readyState,
    connected: isDatabaseConnected(),
  };
};