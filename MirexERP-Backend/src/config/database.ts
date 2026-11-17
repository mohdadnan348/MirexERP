
import mongoose, { type ConnectOptions } from "mongoose";
import { env, isProduction } from "./env";

// ==========================================
// MONGODB CONNECTION CONFIGURATION
// ==========================================

export const databaseConfig = {
  uri: env.MONGODB_URI,

  options: {
    maxPoolSize: 20,
    minPoolSize: 2,

    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,

    socketTimeoutMS: 45000,

    bufferCommands: false,

    autoIndex: !isProduction,

    heartbeatFrequencyMS: 10000,
  } satisfies ConnectOptions,
};

// ==========================================
// MONGOOSE GLOBAL CONFIGURATION
// ==========================================

export const configureMongoose = (): void => {
  mongoose.set("strictQuery", true);

  mongoose.set("autoCreate", false);

  // Disable automatic MongoDB query logging.
  mongoose.set("debug", false);
};

// ==========================================
// DATABASE CONNECTION STATE
// ==========================================

export const getDatabaseStatus = () => {
  const states: Record<number, string> = {
    0: "DISCONNECTED",
    1: "CONNECTED",
    2: "CONNECTING",
    3: "DISCONNECTING",
    99: "UNINITIALIZED",
  };

  return {
    connected: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] ?? "UNKNOWN",
    databaseName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
};
