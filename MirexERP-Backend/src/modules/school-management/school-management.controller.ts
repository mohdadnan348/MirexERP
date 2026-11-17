import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendCreated, sendDeleted, sendPaginatedSuccess, sendSuccess } from "../../utils/apiResponse";
import { getTenantId } from "../../middleware/tenantContext";
import School from "../schools/schools.model";
import SchoolBranch from "./branch.model";
import Session from "../sessions/sessions.model";
import SchoolDocument from "./document.model";
import { getValidatedData } from "../../middleware/validate";
import { createPaginationMeta, getPagination } from "../../utils/pagination";

const actorId = (req: Request) => {
  const id = req.user?.userId;
  if (!id || !mongoose.isValidObjectId(id)) throw new AppError("Authenticated user is required", 401);
  return new mongoose.Types.ObjectId(id);
};

export const getOwnSchool = asyncHandler(async (_req: Request, res: Response) => {
  const school = await School.findOne({ _id: getTenantId(res), isDeleted: false }).lean();
  if (!school) throw new AppError("School not found", 404);
  return sendSuccess(res, "School profile fetched", school);
});

export const updateOwnSchool = asyncHandler(async (req: Request, res: Response) => {
  const school = await School.findOne({ _id: getTenantId(res), isDeleted: false });
  if (!school) throw new AppError("School not found", 404);
  const allowed = ["name", "phone", "timezone", "currency", "address", "contact", "principal", "affiliation"] as const;
  const body = req.body as Record<string, unknown>;
  if (body.affiliation && typeof body.affiliation === "object") {
    const incomingBoard = (body.affiliation as { board?: string }).board;
    if (incomingBoard && incomingBoard !== school.affiliation?.board) {
      const activeSession = await Session.findOne({ schoolId: school._id, isActive: true, isDeleted: false }).select("_id").lean();
      if (activeSession) throw new AppError("Board changes are blocked during an active academic session. Close the current session first.", 409);
    }
  }
  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (["address", "contact", "principal", "affiliation"].includes(key)) {
        const current = (school as unknown as Record<string, any>)[key] || {};
        (school as unknown as Record<string, any>)[key] = { ...current, ...(body[key] as object) };
      } else (school as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  school.updatedBy = actorId(req);
  await school.save();
  return sendSuccess(res, "School profile updated", school);
});

export const updateOwnBranding = asyncHandler(async (req: Request, res: Response) => {
  const school = await School.findOne({ _id: getTenantId(res), isDeleted: false });
  if (!school) throw new AppError("School not found", 404);
  const body = req.body as { primaryColor?: string; secondaryColor?: string };
  school.branding = { ...(school.branding ?? {}), ...body };
  school.updatedBy = actorId(req);
  await school.save();
  return sendSuccess(res, "School branding updated", school.branding);
});

export const uploadSchoolLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Logo file is required", 400);
  const allowed = ["image/png", "image/jpeg", "image/svg+xml"];
  const extension = req.file.originalname.toLowerCase().split(".").pop();
  if (!allowed.includes(req.file.mimetype) || !["png", "jpg", "jpeg", "svg"].includes(extension || "")) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    throw new AppError("Only PNG, JPG and SVG logos are allowed", 400);
  }
  const school = await School.findOne({ _id: getTenantId(res), isDeleted: false });
  if (!school) throw new AppError("School not found", 404);
  school.branding = { ...(school.branding ?? {}), logo: "/api/v1/school-management/logo" };
  school.updatedBy = actorId(req);
  await school.save();
  await SchoolDocument.create({ schoolId: school._id, title: "School Logo", category: "LOGO", originalName: req.file.originalname, storagePath: req.file.path, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: actorId(req) });
  return sendSuccess(res, "School logo uploaded", { logo: school.branding.logo });
});

export const getSchoolLogo = asyncHandler(async (_req: Request, res: Response) => {
  const schoolId = getTenantId(res);
  const logo = await SchoolDocument.findOne({ schoolId, category: "LOGO", isDeleted: false }).sort({ createdAt: -1 }).select("+storagePath");
  const logoPath = logo?.storagePath;
  if (!logoPath || !fs.existsSync(logoPath)) throw new AppError("School logo not found", 404);
  return res.sendFile(logoPath);
});

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = getTenantId(res);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { schoolId, isDeleted: false };
  if (typeof req.query.search === "string" && req.query.search.trim()) filter.$or = [
    { name: { $regex: req.query.search.trim(), $options: "i" } }, { code: { $regex: req.query.search.trim(), $options: "i" } },
  ];
  const [items, total] = await Promise.all([SchoolBranch.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), SchoolBranch.countDocuments(filter)]);
  return sendPaginatedSuccess(res, "Branches fetched", items, createPaginationMeta(page, limit, total));
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = getTenantId(res);
  const data = getValidatedData<Record<string, any>>(res, "body");
  const branch = await SchoolBranch.create({ ...data, schoolId, code: data.code.toUpperCase(), createdBy: actorId(req) });
  return sendCreated(res, "Branch created", branch);
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const branch = await SchoolBranch.findOne({ _id: id, schoolId: getTenantId(res), isDeleted: false });
  if (!branch) throw new AppError("Branch not found", 404);
  const data = getValidatedData<Record<string, any>>(res, "body");
  if (data.code) data.code = data.code.toUpperCase();
  Object.assign(branch, data, { updatedBy: actorId(req) });
  await branch.save();
  return sendSuccess(res, "Branch updated", branch);
});

export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await SchoolBranch.findOne({ _id: req.params.id, schoolId: getTenantId(res), isDeleted: false });
  if (!branch) throw new AppError("Branch not found", 404);
  // Branches are retained; linked academic/business records are never cascaded.
  branch.isDeleted = true; branch.deletedAt = new Date(); branch.status = "INACTIVE"; branch.updatedBy = actorId(req);
  await branch.save();
  return sendDeleted(res, "Branch archived successfully");
});

export const uploadSchoolDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Document file is required", 400);
  const extension = path.extname(req.file.originalname).toLowerCase();
  const extensionByMime: Record<string, string[]> = {
    "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  };
  if (!extensionByMime[req.file.mimetype]?.includes(extension)) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    throw new AppError("Document extension does not match its file type", 400);
  }
  const meta = getValidatedData<{ title: string; category: string }>(res, "body");
  const doc = await SchoolDocument.create({ schoolId: getTenantId(res), ...meta, originalName: req.file.originalname, storagePath: req.file.path, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: actorId(req) });
  return sendCreated(res, "School document uploaded", { _id: doc._id, title: doc.title, category: doc.category, originalName: doc.originalName, mimeType: doc.mimeType, size: doc.size, createdAt: doc.createdAt });
});

export const replaceSchoolDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Replacement document file is required", 400);
  const doc = await SchoolDocument.findOne({ _id: req.params.id, schoolId: getTenantId(res), isDeleted: false }).select("+storagePath");
  if (!doc) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    throw new AppError("Document not found", 404);
  }
  const extension = path.extname(req.file.originalname).toLowerCase();
  const validExtensions: Record<string, string[]> = {
    "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  };
  if (!validExtensions[req.file.mimetype]?.includes(extension)) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    throw new AppError("Replacement file extension does not match its file type", 400);
  }
  const oldPath = doc.storagePath;
  doc.storagePath = req.file.path;
  doc.originalName = req.file.originalname;
  doc.mimeType = req.file.mimetype;
  doc.size = req.file.size;
  await doc.save();
  if (oldPath && oldPath !== req.file.path) await fs.promises.unlink(oldPath).catch(() => undefined);
  return sendSuccess(res, "School document replaced", { _id: doc._id, title: doc.title, category: doc.category, originalName: doc.originalName, mimeType: doc.mimeType, size: doc.size });
});

export const listSchoolDocuments = asyncHandler(async (_req: Request, res: Response) => {
  const docs = await SchoolDocument.find({ schoolId: getTenantId(res), isDeleted: false }).select("-storagePath").sort({ createdAt: -1 }).lean();
  return sendSuccess(res, "School documents fetched", docs);
});

export const downloadSchoolDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await SchoolDocument.findOne({ _id: req.params.id, schoolId: getTenantId(res), isDeleted: false }).select("+storagePath");
  if (!doc) throw new AppError("Document not found", 404);
  if (!fs.existsSync(doc.storagePath)) throw new AppError("Stored document is unavailable", 404);
  return res.download(doc.storagePath, doc.originalName);
});

export const deleteSchoolDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await SchoolDocument.findOne({ _id: req.params.id, schoolId: getTenantId(res), isDeleted: false });
  if (!doc) throw new AppError("Document not found", 404);
  doc.isDeleted = true; doc.deletedAt = new Date(); await doc.save();
  return sendDeleted(res, "Document archived");
});
