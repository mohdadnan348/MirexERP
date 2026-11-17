import PDFDocument from "pdfkit";
import type { Request, Response } from "express";

import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { createPaginationMeta } from "../../utils/pagination";

import {
  createCertificateService,
  deleteCertificateService,
  getCertificateByIdService,
  getCertificatesService,
  getStudentCertificatesService,
  updateCertificateService,
} from "./certificates.service";

interface CertificateActor {
  id: string;
  schoolId: string | null;
  role: string;
}

const getActor = (req: Request): CertificateActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return {
    id: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

const getRouteParam = (
  req: Request,
  key: string
): string => {
  const value = req.params[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }

  throw new AppError(`Invalid or missing route parameter: ${key}`, 400);
};

// Create certificate
export const createCertificate = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const certificate = await createCertificateService(
      actor,
      req.body
    );

    return sendCreated(
      res,
      "Certificate request created and submitted for approval",
      certificate
    );
  }
);


export const downloadCertificatePdf = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const certificate = await getCertificateByIdService(
      actor.schoolId!,
      getRouteParam(req, "id")
    );
    if (certificate.status !== "ACTIVE" || certificate.approvalStatus !== "APPROVED" || !certificate.isVerified) {
      throw new AppError("Only approved and issued certificates can be downloaded", 403);
    }
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const safeNumber = certificate.certificateNumber.replace(/[^A-Z0-9_-]/gi, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate-${safeNumber}.pdf"`);
    doc.pipe(res);
    doc.rect(28, 28, 539, 786).lineWidth(2).stroke("#5145cd");
    doc.rect(38, 38, 519, 766).lineWidth(0.7).stroke("#b8b2ef");
    doc.moveDown(2);
    doc.fillColor("#5145cd").fontSize(13).text("MIREXERP SCHOOL MANAGEMENT SYSTEM", { align: "center", characterSpacing: 1.2 });
    doc.moveDown(2);
    doc.fillColor("#18223a").fontSize(26).font("Helvetica-Bold").text(certificate.title.toUpperCase(), { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(11).font("Helvetica").fillColor("#65708a").text(certificate.certificateType.replaceAll("_", " "), { align: "center" });
    doc.moveDown(2.5);
    doc.fillColor("#26324a").fontSize(13).text("This is to certify that", { align: "center" });
    doc.moveDown(0.8);
    doc.fillColor("#18223a").fontSize(22).font("Helvetica-Bold").text(certificate.studentName, { align: "center" });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(12).fillColor("#344054");
    const details = [
      certificate.fatherName ? `Father's name: ${certificate.fatherName}` : "",
      certificate.motherName ? `Mother's name: ${certificate.motherName}` : "",
      certificate.admissionNumber ? `Admission number: ${certificate.admissionNumber}` : "",
      certificate.className ? `Class: ${certificate.className}` : "",
      `Issue date: ${new Date(certificate.issueDate).toLocaleDateString("en-IN")}`,
      certificate.validUntil ? `Valid until: ${new Date(certificate.validUntil).toLocaleDateString("en-IN")}` : "",
    ].filter(Boolean);
    details.forEach((line) => doc.text(line, { align: "center", lineGap: 8 }));
    doc.moveDown(1.5);
    if (certificate.description) doc.text(certificate.description, { align: "justify", lineGap: 5 });
    if (certificate.reason) { doc.moveDown(0.8); doc.text(`Reason: ${certificate.reason}`); }
    if (certificate.remarks) { doc.moveDown(0.5); doc.text(`Remarks: ${certificate.remarks}`); }
    doc.moveDown(3);
    doc.fontSize(9).fillColor("#667085").text(`Certificate No: ${certificate.certificateNumber}`, { align: "left" });
    doc.text(`Verification Code: ${certificate.verificationCode}`, { align: "left" });
    doc.moveDown(2);
    doc.fontSize(11).fillColor("#26324a").text("Authorized Signatory", { align: "right" });
    doc.end();
  }
);

// Get all certificates
export const getCertificates = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const query = req.query;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const result = await getCertificatesService(actor.schoolId!, {
      page,
      limit,
      search:
        typeof query.search === "string"
          ? query.search
          : undefined,
      studentId:
        typeof query.studentId === "string"
          ? query.studentId
          : undefined,
      certificateType:
        typeof query.certificateType === "string"
          ? query.certificateType
          : undefined,
      status:
        typeof query.status === "string"
          ? query.status
          : undefined,
      sessionId:
        typeof query.sessionId === "string"
          ? query.sessionId
          : undefined,
    });

    return sendPaginatedSuccess(
      res,
      "Certificates fetched successfully",
      result.items,
      createPaginationMeta(
        result.page,
        result.limit,
        result.total
      )
    );
  }
);

// Get certificate by ID
export const getCertificateById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const certificate = await getCertificateByIdService(
      actor.schoolId!,
      getRouteParam(req, "id")
    );

    return sendSuccess(
      res,
      "Certificate fetched successfully",
      certificate
    );
  }
);

// Update certificate
export const updateCertificate = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const certificate = await updateCertificateService(
      actor.schoolId!,
      getRouteParam(req, "id"),
      {
        ...req.body,
        updatedBy: actor.id,
      }
    );

    return sendSuccess(
      res,
      "Certificate updated successfully",
      certificate
    );
  }
);

// Delete certificate
export const deleteCertificate = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteCertificateService(
      actor.schoolId!,
      getRouteParam(req, "id")
    );

    return sendDeleted(
      res,
      "Certificate deleted successfully"
    );
  }
);

// Get certificates of a specific student
export const getStudentCertificates = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const certificates = await getStudentCertificatesService(
      actor.schoolId!,
      getRouteParam(req, "studentId")
    );

    return sendSuccess(
      res,
      "Student certificates fetched successfully",
      certificates
    );
  }
);
