import type { Request, Response, NextFunction, RequestHandler } from "express";
import fs from "fs/promises";
import path from "path";
import { homeworkUploader } from "../../utils/fileStorage";
import { AppError } from "../../utils/AppError";
import { validate, type ValidationSchemas } from "../../middleware/validate";
import type { ZodType } from "zod";

const allowed: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"],
  ".png": ["image/png"], ".webp": ["image/webp"],
  ".txt": ["text/plain"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export const uploadHomeworkFiles: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  homeworkUploader.array("attachments", 10)(req, res, async (error: any) => {
    const files = (req.files || []) as Express.Multer.File[];
    if (error) {
      await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
      return next(error);
    }
    try {
      for (const file of files) {
        const extension = path.extname(file.originalname).toLowerCase();
        const head = await fs.open(file.path, "r");
        const sample = Buffer.alloc(16);
        const read = await head.read(sample, 0, 16, 0);
        await head.close();
        const bytes = sample.subarray(0, read.bytesRead);
        const signatureValid =
          extension === ".pdf" ? bytes.toString("ascii", 0, 4) === "%PDF" :
          [".jpg", ".jpeg"].includes(extension) ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
          extension === ".png" ? bytes.subarray(0, 4).toString("hex") === "89504e47" :
          extension === ".webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" :
          [".doc", ".xls"].includes(extension) ? bytes.subarray(0, 4).toString("hex") === "d0cf11e0" :
          [".docx", ".xlsx"].includes(extension) ? bytes[0] === 0x50 && bytes[1] === 0x4b :
          extension === ".txt" ? !bytes.includes(0) : false;
        if (!allowed[extension]?.includes(file.mimetype) || file.size > 10 * 1024 * 1024 || !signatureValid) {
          await fs.unlink(file.path).catch(() => undefined);
          for (const remaining of files) if (remaining.path !== file.path) await fs.unlink(remaining.path).catch(() => undefined);
          throw new AppError("Unsupported, mismatched or invalid attachment type; each file must be 10 MB or smaller", 400);
        }
      }
      next();
    } catch (validationError) {
      next(validationError);
    }
  });
};

export const normalizeHomeworkMultipart: RequestHandler = (req, _res, next) => {
  try {
    if (typeof req.body.sectionIds === "string") req.body.sectionIds = JSON.parse(req.body.sectionIds);
    if (typeof req.body.totalMarks === "string" && req.body.totalMarks.trim() !== "") req.body.totalMarks = Number(req.body.totalMarks);
    for (const key of ["allowSubmission", "allowLateSubmission", "allowResubmission"] as const) {
      if (req.body[key] === "true") req.body[key] = true;
      if (req.body[key] === "false") req.body[key] = false;
    }
    next();
  } catch {
    const files = (req.files || []) as Express.Multer.File[];
    void Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)))
      .then(() => next(new AppError("Invalid multipart homework fields", 400)));
  }
};

export const validateHomeworkRequest = (schemas: ValidationSchemas | ZodType): RequestHandler => {
  const validateRequest = validate(schemas);
  return (req, res, next) => {
    validateRequest(req, res, async (error?: any) => {
      if (error) {
        const files = (req.files || []) as Express.Multer.File[];
        await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
        return next(error);
      }
      next();
    });
  };
};
