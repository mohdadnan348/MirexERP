
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { env } from "../config/env";
import { USER_ROLES, ACCOUNT_STATUS } from "../config/constants";
import {
  connectDatabase,
  disconnectDatabase,
} from "./connection";
import { logger } from "../utils/logger";

// ==========================================
// SUPER ADMIN SEED CONFIGURATION
// ==========================================

const SEED_ADMIN_NAME =
  process.env.SEED_SUPER_ADMIN_NAME || "MirexERP Super Admin";

const SEED_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();

const SEED_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD;

// ==========================================
// ERROR METADATA
// ==========================================

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

// ==========================================
// SEED SUPER ADMIN
// ==========================================

const seedSuperAdmin = async (): Promise<void> => {
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error(
      "SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required."
    );
  }

  if (SEED_ADMIN_PASSWORD.length < 12) {
    throw new Error(
      "Super Admin password must contain at least 12 characters."
    );
  }

  const usersCollection =
    mongoose.connection.collection("users");

  // Check whether Super Admin already exists.
  const existingAdmin = await usersCollection.findOne({
    email: SEED_ADMIN_EMAIL,
    role: USER_ROLES.SUPER_ADMIN,
  });

  if (existingAdmin) {
    logger.info(
      `Super Admin already exists: ${SEED_ADMIN_EMAIL}`
    );
    return;
  }

  // Prevent duplicate email accounts.
  const existingUser = await usersCollection.findOne({
    email: SEED_ADMIN_EMAIL,
  });

  if (existingUser) {
    throw new Error(
      "This email already belongs to another account. Use a different Super Admin email."
    );
  }

  // Hash password before storing it.
  const hashedPassword = await bcrypt.hash(
    SEED_ADMIN_PASSWORD,
    env.BCRYPT_SALT_ROUNDS
  );

  const now = new Date();

  const adminDocument = {
    name: SEED_ADMIN_NAME,
    email: SEED_ADMIN_EMAIL,
    password: hashedPassword,

    role: USER_ROLES.SUPER_ADMIN,
    schoolId: null,

    status: ACCOUNT_STATUS.ACTIVE,
    isActive: true,
    isEmailVerified: true,

    isDeleted: false,
    deletedAt: null,

    createdAt: now,
    updatedAt: now,
  };

  await usersCollection.insertOne(adminDocument);

  logger.info(
    `Super Admin created successfully: ${SEED_ADMIN_EMAIL}`
  );
};

// ==========================================
// RUN DATABASE SEED
// ==========================================

const runSeed = async (): Promise<void> => {
  try {
    logger.info("Starting MirexERP database seeding...");

    await connectDatabase();

    await seedSuperAdmin();

    logger.info("Database seeding completed successfully.");
  } catch (error: unknown) {
    logger.error(
      "Database seeding failed:",
      getErrorMetadata(error)
    );

    process.exitCode = 1;
  } finally {
    try {
      await disconnectDatabase();
    } catch (disconnectError: unknown) {
      logger.error(
        "Database disconnection after seeding failed:",
        getErrorMetadata(disconnectError)
      );

      process.exitCode = 1;
    }
  }
};

// ==========================================
// EXECUTE
// ==========================================

void runSeed();