import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import * as service from "./class-section.service";

const actor = (req: Request) => {
  if (!req.user?.schoolId || !req.user.userId) throw new AppError("Authenticated school context is required", 401);
  return { userId: req.user.userId, schoolId: req.user.schoolId, role: req.user.role };
};
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const allocationSchema = z.object({
  sessionId: objectId, classId: objectId, sectionId: objectId,
  studentIds: z.array(objectId).min(1).max(100),
  confirmOverCapacity: z.boolean().optional(),
}).strict();
const transferSchema = z.object({
  sessionId: objectId, classId: objectId, sectionId: objectId,
  reason: z.string().trim().min(3).max(1000), confirmOverCapacity: z.boolean().optional(),
}).strict();
const promotionSchema = z.object({
  fromSessionId: objectId, toSessionId: objectId,
  promotions: z.array(z.object({ studentId: objectId, classId: objectId.optional(), sectionId: objectId.optional(), status: z.enum(["PROMOTED", "DETAINED"]).optional() }).strict()).min(1).max(100),
  confirmOverCapacity: z.boolean().optional(),
}).strict();
const subjectTeacherSchema = z.object({
  sessionId: objectId, classId: objectId, sectionId: objectId.optional(), subjectId: objectId, teacherId: objectId,
}).strict();

export const reports = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Class and section reports fetched", await service.classSectionReports(req.query, actor(req))));
export const allocate = asyncHandler(async (req: Request, res: Response) => {
  const data = allocationSchema.parse(req.body);
  return sendCreated(res, "Students allocated successfully", await service.allocateStudents(data, actor(req)));
});
export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const data = transferSchema.parse(req.body);
  return sendSuccess(res, "Student allocation transferred successfully", await service.transferStudentAllocation(String(req.params.studentId), data, actor(req)));
});
export const promote = asyncHandler(async (req: Request, res: Response) => {
  const data = promotionSchema.parse(req.body);
  return sendSuccess(res, "Student promotion batch processed", await service.promoteStudents(data, actor(req)));
});
export const assignSubjectTeacher = asyncHandler(async (req: Request, res: Response) => {
  const data = subjectTeacherSchema.parse(req.body);
  return sendCreated(res, "Subject teacher assigned successfully", await service.assignSubjectTeacher(data, actor(req)));
});
export const classStudents = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Class students fetched", await service.listStudentsForPlacement("class", String(req.params.classId), req.query, actor(req))));
export const sectionStudents = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Section students fetched", await service.listStudentsForPlacement("section", String(req.params.sectionId), req.query, actor(req))));
export const history = asyncHandler(async (req: Request, res: Response) => {
  const { default: History } = await import("./class-section-history.model");
  const a = actor(req);
  const query: any = { schoolId: a.schoolId };
  if (req.query.studentId) query.studentId = req.query.studentId;
  if (req.query.sessionId) query.sessionId = req.query.sessionId;
  const items = await History.find(query).sort({ createdAt: -1 }).limit(200).populate("studentId", "admissionNumber firstName lastName").populate("classId", "name").populate("sectionId", "name").lean();
  return sendSuccess(res, "Class/section history fetched", items);
});

export const eligibleStudents = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Eligible students fetched", await service.eligibleStudentsForSession(req.query, actor(req))));

export const myAssignments = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Teacher assignments fetched", await service.myTeachingAssignments(actor(req))));
