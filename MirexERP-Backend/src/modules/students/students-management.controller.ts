import { Request, Response } from "express";
import path from "path";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";
import * as service from "./students-management.service";
import { generateAndSendPdf } from "../../utils/pdf";
import { getStudentByIdService } from "./students.service";
import School from "../schools/schools.model";

const actor = (req: Request) => {
  if (!req.user?.schoolId) throw new AppError("School context required", 400);
  return { userId: req.user.userId, schoolId: req.user.schoolId, role: req.user.role };
};
export const records = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student records fetched", await service.listStudentRecords(String(req.params.id), typeof req.query.type === "string" ? req.query.type : undefined, actor(req))));
export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Select a student photo", 400);
  try { return sendSuccess(res, "Student photo updated", await service.setStudentPhoto(String(req.params.id), req.file, actor(req))); }
  catch (error) { const fs = await import("fs/promises"); await fs.unlink(req.file.path).catch(() => undefined); throw error; }
});
export const getPhoto = asyncHandler(async (req: Request, res: Response) => {
  const photo = await service.getStudentPhoto(String(req.params.id), actor(req));
  const absolute = path.resolve(photo.storagePath!);
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR) + path.sep;
  if (!absolute.startsWith(uploadRoot)) throw new AppError("Invalid photo path", 400);
  res.type(photo.mimeType || "image/jpeg");
  return res.sendFile(absolute);
});
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Select a student document", 400);
  try { return sendCreated(res, "Student document uploaded", await service.addStudentDocument(String(req.params.id), req.file, req.body, actor(req))); }
  catch (error) { const fs = await import("fs/promises"); await fs.unlink(req.file.path).catch(() => undefined); throw error; }
});
export const replaceDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Select a replacement document", 400);
  try { return sendSuccess(res, "Student document replaced", await service.replaceStudentDocument(String(req.params.id), String(req.params.documentId), req.file, actor(req))); }
  catch (error) { const fs = await import("fs/promises"); await fs.unlink(req.file.path).catch(() => undefined); throw error; }
});
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await service.getStudentDocument(String(req.params.id), String(req.params.documentId), actor(req));
  const absolute = path.resolve(doc.storagePath!);
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR) + path.sep;
  if (!absolute.startsWith(uploadRoot)) throw new AppError("Invalid document path", 400);
  return res.download(absolute, doc.fileName || doc.title);
});
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Document verification updated", await service.updateStudentDocument(String(req.params.id), String(req.params.documentId), req.body, actor(req))));
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student document archived", await service.softDeleteStudentDocument(String(req.params.id), String(req.params.documentId), actor(req))));
export const previousSchoolPut = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Previous school details updated", await service.updatePreviousSchoolDetails(String(req.params.id), req.body, actor(req))));
export const medicalGet = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, "Medical information fetched", await service.getMedicalInformation(String(req.params.id), actor(req)));
});
export const medicalPut = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Medical information updated", await service.updateMedicalInformation(String(req.params.id), req.body, actor(req))));
export const transfer = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student transferred", await service.transferStudent(String(req.params.id), req.body, actor(req))));
export const withdraw = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student withdrawn", await service.withdrawStudent(String(req.params.id), req.body, actor(req))));
export const issueTc = asyncHandler(async (req: Request, res: Response) => sendCreated(res, "Transfer certificate issued", await service.issueTransferCertificate(String(req.params.id), req.body, actor(req))));
export const promote = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student promoted", await service.promoteStudent(String(req.params.id), req.body, actor(req))));
export const reports = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student reports fetched", await service.studentReports(req.query, actor(req))));

export const downloadTc = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  const student: any = await getStudentByIdService(String(req.params.id), a);
  if (!student.tcLocked || !student.tcNumber) throw new AppError("Transfer Certificate has not been issued", 404);
  const school: any = await School.findOne({ _id: a.schoolId }).select("name code address logo").lean();
  const tcHistory = await service.listStudentRecords(String(req.params.id), "TC", a);
  const tcDetails: any = tcHistory[0]?.details || {};
  const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  return generateAndSendPdf(res, (doc) => {
    doc.font("Helvetica-Bold").fontSize(18).text(school?.name || "School", { align: "center" });
    doc.font("Helvetica").fontSize(10).text([school?.address?.street, school?.address?.city, school?.address?.state, school?.address?.postalCode].filter(Boolean).join(", "), { align: "center" });
    doc.moveDown(1); doc.font("Helvetica-Bold").fontSize(16).text("TRANSFER CERTIFICATE", { align: "center" });
    doc.moveDown(1); doc.font("Helvetica").fontSize(11);
    const rows: Array<[string, string]> = [
      ["TC Number", student.tcNumber], ["Student Name", name], ["Admission Number", student.admissionNumber],
      ["Date of Birth", new Date(student.dateOfBirth).toLocaleDateString("en-IN")], ["Gender", student.gender],
      ["Class", student.classId?.name || "—"], ["Section", student.sectionId?.name || "—"],
      ["Parent / Guardian", student.parentId ? `${student.parentId.firstName} ${student.parentId.lastName}` : "—"],
      ["Admission Date", student.admissionDate ? new Date(student.admissionDate).toLocaleDateString("en-IN") : "—"],
      ["Issue Date", student.tcIssuedAt ? new Date(student.tcIssuedAt).toLocaleDateString("en-IN") : "—"],
    ];
    rows.forEach(([label, value]) => { doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }); doc.font("Helvetica").text(String(value || "—")); });
    doc.moveDown(1); doc.font("Helvetica-Bold").text("Reason for Leaving"); doc.font("Helvetica").text(String(tcDetails.reason || "—"));
    if (tcDetails.conduct) { doc.moveDown(0.5); doc.font("Helvetica-Bold").text("Conduct / Remarks"); doc.font("Helvetica").text(String(tcDetails.conduct)); }
    if (tcDetails.remarks) { doc.moveDown(0.5); doc.font("Helvetica-Bold").text("Additional Remarks"); doc.font("Helvetica").text(String(tcDetails.remarks)); }
    doc.moveDown(3); doc.text("Principal / Authorized Signatory", { align: "right" });
  }, `tc-${student.tcNumber}.pdf`, { title: `Transfer Certificate ${student.tcNumber}`, subject: "Student Transfer Certificate", pageSize: "A4" });
});

export const myChildren = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Linked children fetched", await service.getParentLinkedChildren(actor(req))));

export const markAlumni = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, "Student marked as Alumni", await service.markStudentAlumni(String(req.params.id), req.body, actor(req))));
