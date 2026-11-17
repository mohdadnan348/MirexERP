import { Request, Response } from "express";
import path from "path";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendCreated, sendSuccess, sendPaginatedSuccess } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";
import { getRelativeFilePath, deleteUploadedFile } from "../../utils/fileStorage";
import Admission from "./admissions.model";
import Student from "../students/students.model";
import { Parent } from "../parents/parents.model";
import Enquiry from "./enquiry.model";
import { createAdmissionService } from "./admissions.service";
import * as service from "./admissions-extended.service";
import { USER_ROLES } from "../../config/constants";
import { createAdmissionSchema } from "./admissions.validation";

const actor = (req: Request) => {
  if (!req.user?.schoolId) throw new AppError("School context required", 400);
  return { schoolId: req.user.schoolId, userId: req.user.userId };
};

export const enquiriesList = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listEnquiries(req.query, actor(req));
  return sendPaginatedSuccess(res, "Enquiries fetched", result.items, result.pagination);
});
export const enquiriesCreate = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, "Enquiry created", await service.createEnquiry(req.body, actor(req))));
export const enquiriesUpdate = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Enquiry updated", await service.updateEnquiry(String(req.params.id), req.body, actor(req))));
export const enquiriesDelete = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Enquiry archived", await service.deleteEnquiry(String(req.params.id), actor(req))));
export const followUpCreate = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, "Follow-up scheduled", await service.addEnquiryFollowUp(String(req.params.id), req.body, actor(req))));
export const followUpUpdate = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Follow-up updated", await service.updateFollowUp(String(req.params.id), String(req.params.followUpId), req.body, actor(req))));
export const followUpsList = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Follow-ups fetched", await service.listFollowUps(req.query, actor(req))));
export const reports = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Admission reports fetched", await service.getAdmissionReports(req.query, actor(req))));
export const settingsGet = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Admission settings fetched", await service.getOrCreateAdmissionSettings(actor(req))));
export const settingsPut = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Admission settings updated", await service.updateAdmissionSettings(req.body, actor(req))));

export const uploadAdmissionDocument = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  if (!req.file) throw new AppError("Select a document file", 400);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false });
  if (!admission) {
    await deleteUploadedFile(req.file.path);
    throw new AppError("Application not found", 404);
  }
  const doc: any = {
    documentType: String(req.body.documentType || "OTHER").slice(0, 80),
    documentName: req.file.originalname,
    fileUrl: `/api/v1/admissions/${req.params.id}/documents`,
    uploadedAt: new Date(), uploadedBy: a.userId,
    storagePath: getRelativeFilePath(req.file.path), verified: false, isDeleted: false,
  };
  admission.documents.push(doc);
  await admission.save();
  const created: any = (admission.documents as any)[admission.documents.length - 1];
  return sendCreated(res, "Admission document uploaded", {
    id: created._id, documentType: created.documentType,
    documentName: created.documentName, uploadedAt: created.uploadedAt, verified: false,
  });
});

export const listAdmissionDocuments = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false });
  if (!admission) throw new AppError("Application not found", 404);
  return sendSuccess(res, "Documents fetched", (admission.documents as any[]).filter(d => !d.isDeleted).map(d => ({
    _id: d._id, documentType: d.documentType, documentName: d.documentName,
    uploadedAt: d.uploadedAt, verified: d.verified, remarks: d.remarks,
  })));
});

export const verifyAdmissionDocument = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false });
  if (!admission) throw new AppError("Application not found", 404);
  const doc: any = (admission.documents as any).id(req.params.documentId);
  if (!doc || doc.isDeleted) throw new AppError("Document not found", 404);
  doc.verified = req.body.verified === true;
  doc.remarks = req.body.remarks;
  await admission.save();
  return sendSuccess(res, "Document verification updated", { _id: doc._id, verified: doc.verified, remarks: doc.remarks });
});

export const replaceAdmissionDocument = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  if (!req.file) throw new AppError("Select replacement file", 400);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false }).select("+documents.storagePath");
  if (!admission) {
    await deleteUploadedFile(req.file.path);
    throw new AppError("Application not found", 404);
  }
  const doc: any = (admission.documents as any).id(req.params.documentId);
  if (!doc || doc.isDeleted) {
    await deleteUploadedFile(req.file.path);
    throw new AppError("Document not found", 404);
  }
  if (doc.storagePath) await deleteUploadedFile(path.resolve(process.cwd(), env.UPLOAD_DIR, doc.storagePath));
  doc.storagePath = getRelativeFilePath(req.file.path);
  doc.documentName = req.file.originalname;
  doc.uploadedAt = new Date();
  doc.uploadedBy = a.userId;
  doc.verified = false;
  doc.remarks = undefined;
  await admission.save();
  return sendSuccess(res, "Document replaced; verification reset", { _id: doc._id, documentName: doc.documentName, verified: false });
});

export const deleteAdmissionDocument = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false });
  if (!admission) throw new AppError("Application not found", 404);
  const doc: any = (admission.documents as any).id(req.params.documentId);
  if (!doc || doc.isDeleted) throw new AppError("Document not found", 404);
  doc.isDeleted = true;
  await admission.save();
  return sendSuccess(res, "Document archived", { _id: doc._id });
});

export const downloadAdmissionDocument = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const admission = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false }).select("+documents.storagePath");
  if (!admission) throw new AppError("Application not found", 404);
  const doc: any = (admission.documents as any).id(req.params.documentId);
  if (!doc || doc.isDeleted || !doc.storagePath) throw new AppError("Document not found", 404);
  const absolute = path.resolve(process.cwd(), env.UPLOAD_DIR, doc.storagePath);
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR) + path.sep;
  if (!absolute.startsWith(uploadRoot)) throw new AppError("Invalid document path", 400);
  return res.download(absolute, doc.documentName);
});

export const transitionApplication = asyncHandler(async (req: Request, res: Response) => {
  const status = String(req.body.status);
  if (["APPROVED", "REJECTED", "WAITLISTED"].includes(status) &&
      ![USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN].includes(req.user?.role as any)) {
    throw new AppError("Only an authorized Principal or School Admin can make this decision", 403);
  }
  return sendSuccess(res, "Application status updated",
    await service.transitionApplication(String(req.params.id), status, req.body.remarks, actor(req)));
});

export const applicationHistory = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const item = await Admission.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false }).select("status statusHistory createdAt applicationDate");
  if (!item) throw new AppError("Application not found", 404);
  return sendSuccess(res, "Application history fetched", { status: item.status, history: item.statusHistory || [] });
});

export const convertEnquiryToApplication = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const enquiry = await Enquiry.findOne({ _id: req.params.id, schoolId: a.schoolId, isDeleted: false });
  if (!enquiry) throw new AppError("Enquiry not found", 404);
  if (enquiry.convertedApplicationId) throw new AppError("This enquiry has already been converted", 409);
  const name = String(enquiry.childName).trim().split(/\s+/);
  const payload: any = {
    ...req.body, sessionId: enquiry.sessionId.toString(),
    applicationNumber: req.body.applicationNumber || `APP-${Date.now()}`,
    firstName: req.body.firstName || name[0],
    lastName: req.body.lastName || name.slice(1).join(" ") || name[0],
    guardians: req.body.guardians?.length ? req.body.guardians : [{
      name: enquiry.parentName, relationship: "GUARDIAN", phone: enquiry.parentPhone, isPrimaryContact: true,
    }],
    enquiryId: enquiry._id.toString(), source: enquiry.source,
  };
  const parsed = createAdmissionSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues.map(issue=>issue.message).join(", "),400);
  const application = await createAdmissionService(parsed.data, a);
  enquiry.status = "CONVERTED";
  enquiry.convertedApplicationId = (application as any)._id;
  await enquiry.save();
  return sendCreated(res, "Enquiry converted to application", application);
});

export const registrationDetails = asyncHandler(async (req: Request, res: Response) => {
 const a=actor(req);
 const admission=await Admission.findOne({_id:req.params.id,schoolId:a.schoolId,isDeleted:false}).select("convertedStudentId status applicationNumber");
 if(!admission)throw new AppError("Application not found",404);
 if(!admission.convertedStudentId)throw new AppError("Application has not been registered yet",404);
 const student=await Student.findOne({_id:admission.convertedStudentId,schoolId:a.schoolId}).populate("classId","name code").populate("sectionId","name").populate("sessionId","name code");
 if(!student)throw new AppError("Registered student record not found",404);
 const parent=student.parentId?await Parent.findOne({_id:student.parentId,schoolId:a.schoolId}).select("firstName lastName phone email relation userId"):null;
 return sendSuccess(res,"Registration details fetched",{applicationNumber:admission.applicationNumber,admissionNumber:student.admissionNumber,student,parent});
});
