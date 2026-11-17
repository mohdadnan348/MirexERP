
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { env } from "../config/env";
import { AppError } from "./AppError";

/**
 * Upload configuration options.
 */
export interface UploadOptions {
  subfolder?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  maxFiles?: number;
}

/**
 * Resolve the main upload directory.
 */
const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

/**
 * Validate and resolve upload subfolder.
 */
const getUploadDirectory = (subfolder = "general"): string => {
  const safeFolder = subfolder.trim();

  if (
    !safeFolder ||
    safeFolder.split(/[\\/]/).some(
      (segment) =>
        segment === ".." ||
        !/^[a-zA-Z0-9_-]+$/.test(segment)
    )
  ) {
    throw new AppError("Invalid upload directory.", 400);
  }

  const directory = path.resolve(uploadRoot, safeFolder);

  if (!directory.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new AppError("Invalid upload directory.", 400);
  }

  fs.mkdirSync(directory, { recursive: true });

  return directory;
};

/**
 * Generate a unique filename.
 */
const generateFilename = (
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void
): void => {
  const extension = path.extname(file.originalname).toLowerCase();

  const uniqueFilename = `${crypto.randomUUID()}${extension}`;

  callback(null, uniqueFilename);
};

/**
 * Create reusable Multer uploader.
 */
export const createUploader = (
  options: UploadOptions = {}
): multer.Multer => {
  const {
    subfolder = "general",
    maxFileSize = env.MAX_FILE_SIZE,
    allowedMimeTypes = env.ALLOWED_FILE_TYPES,
    maxFiles = 10,
  } = options;

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      try {
        const directory = getUploadDirectory(subfolder);
        callback(null, directory);
      } catch (error) {
        callback(
          error instanceof Error
            ? error
            : new Error("Unable to create upload directory."),
          ""
        );
      }
    },

    filename: generateFilename,
  });

  return multer({
    storage,

    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
      fields: 50,
      parts: maxFiles + 50,
    },

    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        callback(
          new AppError(
            `File type ${file.mimetype} is not allowed.`,
            400
          )
        );
        return;
      }

      callback(null, true);
    },
  });
};

/**
 * Default uploaders for different ERP modules.
 */
export const generalUploader = createUploader();

export const studentPhotoUploader = createUploader({
  subfolder: "students",
  maxFileSize: 5 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  maxFiles: 1,
});

export const employeePhotoUploader = createUploader({
  subfolder: "employee-photos",
  maxFileSize: 5 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  maxFiles: 1,
});

export const employeeDocumentUploader = createUploader({
  subfolder: "employees",
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  maxFiles: 5,
});

export const admissionDocumentUploader = createUploader({
  subfolder: "admissions",
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  maxFiles: 10,
});

export const schoolLogoUploader = createUploader({
  subfolder: "schools",
  maxFileSize: 2 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ],
  maxFiles: 1,
});

/**
 * Delete a previously uploaded file.
 */
export const deleteUploadedFile = async (
  filePath: string
): Promise<void> => {
  const absolutePath = path.resolve(filePath);

  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new AppError("Invalid file path.", 400);
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
};

/**
 * Get a safe relative file path.
 */
export const getRelativeFilePath = (
  absolutePath: string
): string => {
  const resolvedPath = path.resolve(absolutePath);

  if (!resolvedPath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new AppError("Invalid file path.", 400);
  }

  return path.relative(uploadRoot, resolvedPath);
};
export const schoolDocumentUploader = createUploader({
  subfolder: "school-documents",
  maxFileSize: 15 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  maxFiles: 1,
});



export const studentDocumentUploader = createUploader({
  subfolder: "student-documents",
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  maxFiles: 1,
});


export const homeworkUploader = createUploader({
  subfolder: "homework",
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 10,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
});
