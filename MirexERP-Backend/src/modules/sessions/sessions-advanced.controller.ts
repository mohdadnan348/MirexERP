import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendCreated, sendSuccess } from "../../utils/apiResponse";
import {
  createAcademicSession, updateAcademicSession, activateAcademicSession, closeAcademicSession,
  getSessionDashboard, getSessionDetails, getSessionReports, prepareSessionClasses,
  cloneSessionFeeStructures, getPreparationStatus, sessionPromotionEligible, executeSessionPromotion, activatePreparedFeeStructure,
  getPreviousSessions, getSessionHistory, getDetainedStudents, previewSessionPromotion,
} from "./sessions-advanced.service";

const actor = (req: Request) => {
  if (!req.user?.userId || !req.user.schoolId) throw new AppError("Authenticated school user is required", 401);
  return { userId: req.user.userId, schoolId: req.user.schoolId, role: String(req.user.role || "").toUpperCase().replaceAll(" ", "_") };
};
const body = (req: Request) => req.body as Record<string, any>;
const query = (req: Request) => req.query as Record<string, any>;

export const dashboard = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session dashboard fetched", await getSessionDashboard(actor(req))));
export const create = asyncHandler(async (req: Request, res: Response) => sendCreated(res, "Academic session created", await createAcademicSession(body(req) as any, actor(req))));
export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session updated", await updateAcademicSession(req.params.id, body(req) as any, actor(req))));
export const activate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session activated", await activateAcademicSession(req.params.id, body(req).confirmation, actor(req))));
export const close = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session closed permanently", await closeAcademicSession(req.params.id, body(req).confirmation, actor(req))));
export const details = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session details fetched", await getSessionDetails(req.params.id, actor(req))));
export const reports = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session reports fetched", await getSessionReports(actor(req), query(req).sessionId)));
export const prepareClasses = asyncHandler(async (req: Request, res: Response) => sendCreated(res, "Destination classes and sections prepared", await prepareSessionClasses(body(req).sourceSessionId, body(req).destinationSessionId, actor(req))));
export const cloneFees = asyncHandler(async (req: Request, res: Response) => sendCreated(res, "Fee structures cloned as inactive drafts", await cloneSessionFeeStructures(body(req).sourceSessionId, body(req).destinationSessionId, actor(req))));
export const preparationStatus = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Session preparation status fetched", await getPreparationStatus(req.params.id, actor(req))));
export const eligibleStudents = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Eligible students fetched", await sessionPromotionEligible(query(req), actor(req))));
export const promote = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Session promotion processed", await executeSessionPromotion(body(req), actor(req))));

export const activateFeeStructure = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Prepared fee structure activated", await activatePreparedFeeStructure(req.params.feeStructureId, body(req).confirmation, actor(req))));

export const previous = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Previous academic sessions fetched", await getPreviousSessions(actor(req))));
export const history = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Academic session history fetched", await getSessionHistory(actor(req), query(req).sessionId)));
export const detained = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Detained students fetched", await getDetainedStudents(actor(req), req.params.id)));
export const promotionPreview = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Promotion preview generated", await previewSessionPromotion(query(req).sourceSessionId, query(req).destinationSessionId, actor(req), Number(query(req).page || 1), Number(query(req).limit || 100))));
