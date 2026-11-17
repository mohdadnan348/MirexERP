import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { getValidatedData } from "../../utils/validate";
import { saveExamMarksService, getExamMarksService, getExamResultsService } from "./exam-mark.service";
import { SaveExamMarksInput } from "./exam-mark.validation";
import { getExamDashboardService, transitionExamWorkflowService } from "./exam-workflow.service";

const actor = (req: Request) => {
  if (!req.user?.userId || !req.user.schoolId) throw new AppError("Authenticated school user is required", 401);
  return { userId: req.user.userId, schoolId: req.user.schoolId, role: req.user.role };
};

export const saveExamMarks = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  const { examId } = getValidatedData<{ examId: string }>(res, "params");
  const body = getValidatedData<SaveExamMarksInput>(res, "body");
  const data = await saveExamMarksService(examId, body, current);
  return sendSuccess(res, "Examination marks saved successfully", data);
});

export const getExamMarks = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  const { examId } = getValidatedData<{ examId: string }>(res, "params");
  const query = getValidatedData<{ page: number; limit: number; subjectId?: string; studentId?: string }>(res, "query");
  const data = await getExamMarksService(examId, query, current);
  return sendSuccess(res, "Examination marks fetched successfully", data);
});

export const getExamResults = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  const { examId } = getValidatedData<{ examId: string }>(res, "params");
  const data = await getExamResultsService(examId, current.schoolId);
  return sendSuccess(res, "Published examination results fetched successfully", data);
});

export const getExamDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await getExamDashboardService(actor(req));
  return sendSuccess(res, "Examination dashboard fetched successfully", data);
});

export const transitionExamWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  const { examId } = getValidatedData<{ examId: string }>(res, "params");
  const action = req.params.action as "submit" | "verify" | "approve" | "publish";
  const data = await transitionExamWorkflowService(examId, action, current);
  return sendSuccess(res, `Exam results ${action} action completed`, data);
});
