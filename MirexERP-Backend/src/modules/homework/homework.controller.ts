import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess, sendCreated, sendPaginatedSuccess, sendDeleted } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { deleteUploadedFile } from "../../utils/fileStorage";
import {
  createHomeworkService, getHomeworksService, getHomeworkByIdService, updateHomeworkService,
  deleteHomeworkService, submitHomeworkService, getHomeworkSubmissionsService,
  reviewHomeworkSubmissionService, publishHomeworkService, archiveHomeworkService,
  getPendingHomeworkService, getHomeworkSummaryService, getHomeworkReportService,
  getLateSubmissionsService, getMySubmissionsService, sendPendingHomeworkRemindersService,
  getHomeworkFileService, getSubmissionHistoryService, getEvaluationReportService,
} from "./homework.service";

const getActor = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  if (!req.user.schoolId) throw new AppError("School context is required", 400);
  return { userId: req.user.userId, schoolId: req.user.schoolId, role: req.user.role, email: req.user.email };
};
const id = (req: Request) => {
  const value = req.params.id;
  if (typeof value !== "string" || !value.trim()) throw new AppError("Valid homework ID is required", 400);
  return value;
};
const files = (req: Request) => (req.files || []) as Express.Multer.File[];
const cleanupUploadedFiles = async (req: Request) => {
  await Promise.all(files(req).map((file) => deleteUploadedFile(file.path).catch(() => undefined)));
};

export const createHomework = asyncHandler(async (req: Request, res: Response) => {
  try {
    const item = await createHomeworkService(req.body, getActor(req), files(req));
    return sendCreated(res, "Homework saved successfully", item);
  } catch (error) {
    await cleanupUploadedFiles(req);
    throw error;
  }
});
export const getHomeworks = asyncHandler(async (req: Request, res: Response) => {
  const result = await getHomeworksService(getActor(req), req.query);
  return sendPaginatedSuccess(res, "Homework records fetched successfully", result.items, result.pagination);
});
export const getHomeworkById = asyncHandler(async (req: Request, res: Response) => {
  const item = await getHomeworkByIdService(id(req), getActor(req), typeof req.query.studentId === "string" ? req.query.studentId : undefined);
  return sendSuccess(res, "Homework details fetched successfully", item);
});
export const updateHomework = asyncHandler(async (req: Request, res: Response) => {
  try {
    const item = await updateHomeworkService(id(req), req.body, getActor(req), files(req));
    return sendSuccess(res, "Homework updated successfully", item);
  } catch (error) {
    await cleanupUploadedFiles(req);
    throw error;
  }
});
export const deleteHomework = asyncHandler(async (req: Request, res: Response) => {
  await deleteHomeworkService(id(req), getActor(req));
  return sendDeleted(res, "Homework archived successfully");
});
export const archiveHomework = asyncHandler(async (req: Request, res: Response) => {
  const item = await archiveHomeworkService(id(req), getActor(req));
  return sendSuccess(res, "Homework archived successfully", item);
});
export const publishHomework = asyncHandler(async (req: Request, res: Response) => {
  const item = await publishHomeworkService(id(req), getActor(req));
  return sendSuccess(res, "Homework published successfully", item);
});
export const submitHomework = asyncHandler(async (req: Request, res: Response) => {
  try {
    const item = await submitHomeworkService(id(req), req.body, getActor(req), files(req), typeof req.body.studentId === "string" ? req.body.studentId : undefined);
    return sendCreated(res, "Homework submitted successfully", item);
  } catch (error) {
    await cleanupUploadedFiles(req);
    throw error;
  }
});
export const getHomeworkSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const result = await getHomeworkSubmissionsService(id(req), getActor(req), req.query);
  return sendPaginatedSuccess(res, "Homework submissions fetched successfully", result.items, result.pagination);
});
export const reviewHomeworkSubmission = asyncHandler(async (req: Request, res: Response) => {
  const submissionId = req.params.submissionId;
  if (typeof submissionId !== "string") throw new AppError("Valid submission ID is required", 400);
  const item = await reviewHomeworkSubmissionService(id(req), submissionId, req.body, getActor(req));
  return sendSuccess(res, "Homework evaluation saved successfully", item);
});
export const getPendingHomework = asyncHandler(async (req: Request, res: Response) => {
  const result = await getPendingHomeworkService(id(req), getActor(req), req.query);
  return sendSuccess(res, "Pending homework report fetched successfully", result);
});
export const getHomeworkSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await getHomeworkSummaryService(getActor(req), req.query);
  return sendSuccess(res, "Homework summary fetched successfully", result);
});
export const getClassWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await getHomeworkReportService(getActor(req), "classId", req.query);
  return sendSuccess(res, "Class-wise homework report fetched successfully", result);
});
export const getSubjectWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await getHomeworkReportService(getActor(req), "subjectId", req.query);
  return sendSuccess(res, "Subject-wise homework report fetched successfully", result);
});
export const getLateSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const result = await getLateSubmissionsService(getActor(req), req.query);
  return sendSuccess(res, "Late submissions fetched successfully", result);
});
export const getMySubmissions = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMySubmissionsService(getActor(req), req.query);
  return sendPaginatedSuccess(res, "Your submission history fetched successfully", result.items, result.pagination);
});
export const getEvaluationReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await getEvaluationReportService(getActor(req), req.query);
  return sendPaginatedSuccess(res, "Homework evaluation report fetched successfully", result.items, result.pagination);
});
export const sendPendingReminders = asyncHandler(async (req: Request, res: Response) => {
  const result = await sendPendingHomeworkRemindersService(getActor(req), typeof req.body.homeworkId === "string" ? req.body.homeworkId : undefined);
  return sendSuccess(res, "Reminder records processed", result);
});
export const getSubmissionHistory = asyncHandler(async (req: Request, res: Response) => {
  const submissionId = req.params.submissionId;
  if (typeof submissionId !== "string") throw new AppError("Valid submission ID is required", 400);
  const result = await getSubmissionHistoryService(submissionId, getActor(req));
  return sendSuccess(res, "Submission history fetched successfully", result);
});
export const downloadHomeworkFile = asyncHandler(async (req: Request, res: Response) => {
  const filename = req.params.filename;
  if (typeof filename !== "string") throw new AppError("Invalid attachment key", 400);
  const file = await getHomeworkFileService(filename, getActor(req));
  res.setHeader("Content-Type", file.type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.download(file.path, file.name, (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});
