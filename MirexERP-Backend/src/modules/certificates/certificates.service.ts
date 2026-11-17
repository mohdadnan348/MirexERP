
import { randomBytes } from "crypto";
import { Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import { Student } from "../students/students.model";

import {
  Certificate,
  CertificateStatus,
  CertificateType,
} from "./certificates.model";
import { CertificateSequence, CertificateApprovalHistory } from "./certificate-advanced.model";

interface CertificateActor {
  id: string;
  schoolId: string | null;
  role: string;
}

interface CertificateInput {
  sessionId: string;
  studentId: string;
  certificateType: CertificateType;
  title: string;
  description?: string;
  issueDate?: string | Date;
  validUntil?: string | Date;
  reason?: string;
  remarks?: string;
  templateId?: string;
  pdfUrl?: string;
}

interface CertificateFilters {
  page: number;
  limit: number;
  search?: string;
  studentId?: string;
  certificateType?: string;
  status?: string;
  sessionId?: string;
}

const validateObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const getSchoolId = (schoolId: string | null) => {
  if (!schoolId || !Types.ObjectId.isValid(schoolId)) {
    throw new AppError("Valid school context is required", 400);
  }

  return new Types.ObjectId(schoolId);
};

const generateCertificateNumber = async (schoolId: Types.ObjectId, certificateType: CertificateType): Promise<string> => {
  const year = new Date().getFullYear();
  let sequence;
  try {
    sequence = await CertificateSequence.findOneAndUpdate(
      { schoolId, certificateType, year },
      { $inc: { value: 1 }, $setOnInsert: { schoolId, certificateType, year } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Concurrent first-time upserts can race on the unique compound index; retry as update.
    if ((error as { code?: number })?.code !== 11000) throw error;
    sequence = await CertificateSequence.findOneAndUpdate({ schoolId, certificateType, year }, { $inc: { value: 1 } }, { new: true });
  }
  if (!sequence) throw new AppError("Unable to allocate certificate number", 500);
  const prefix = certificateType === CertificateType.TRANSFER ? "TC" : certificateType === CertificateType.BONAFIDE ? "BON" : certificateType;
  return `${prefix}${year}-${String(sequence.value).padStart(4, "0")}`;
};

const generateVerificationCode = () => {
  return randomBytes(12).toString("hex").toUpperCase();
};

const validateCertificateDates = (
  issueDate: string | Date,
  validUntil?: string | Date
) => {
  const issue = new Date(issueDate);

  if (Number.isNaN(issue.getTime())) {
    throw new AppError("Invalid certificate issue date", 400);
  }

  let validity: Date | undefined;

  if (validUntil) {
    validity = new Date(validUntil);

    if (Number.isNaN(validity.getTime())) {
      throw new AppError("Invalid certificate validity date", 400);
    }

    if (validity < issue) {
      throw new AppError(
        "Validity date cannot be before issue date",
        400
      );
    }
  }

  return { issue, validity };
};

const getSchoolStudent = async (
  schoolId: Types.ObjectId,
  studentId: string
) => {
  validateObjectId(studentId, "student ID");

  const student = await Student.findOne({
    _id: new Types.ObjectId(studentId),
    schoolId,
  });

  if (!student) {
    throw new AppError("Student not found in this school", 404);
  }

  return student;
};

// Create certificate
export const createCertificateService = async (
  actor: CertificateActor,
  input: CertificateInput
) => {
  const schoolId = getSchoolId(actor.schoolId);

  validateObjectId(actor.id, "user ID");
  validateObjectId(input.sessionId, "session ID");

  const student = await getSchoolStudent(
    schoolId,
    input.studentId
  );

  const { issue, validity } = validateCertificateDates(
    input.issueDate ?? new Date(),
    input.validUntil
  );

  if (input.templateId) {
    validateObjectId(input.templateId, "template ID");
  }

  const certificate = await Certificate.create({
    schoolId,
    sessionId: new Types.ObjectId(input.sessionId),
    studentId: student._id,

    certificateNumber: await generateCertificateNumber(schoolId, input.certificateType),
    verificationCode: generateVerificationCode(),

    certificateType: input.certificateType,
    title: input.title,
    description: input.description,

    issueDate: issue,
    validUntil: validity,

    studentName: student.name,
    fatherName: student.fatherName,
    motherName: student.motherName,
    admissionNumber: student.admissionNumber,

    reason: input.reason,
    remarks: input.remarks,

    templateId: input.templateId
      ? new Types.ObjectId(input.templateId)
      : undefined,

    pdfUrl: input.pdfUrl,

    status: CertificateStatus.ACTIVE,
    approvalStatus: "PENDING",
    isVerified: false,

    issuedBy: new Types.ObjectId(actor.id),
  });

  await CertificateApprovalHistory.create({ schoolId, certificateId: certificate._id, action: "SUBMITTED", actorId: new Types.ObjectId(actor.id) });
  return certificate;
};

// Get all certificates
export const getCertificatesService = async (
  schoolId: string,
  filters: CertificateFilters
) => {
  const filter: Record<string, unknown> = {
    schoolId: getSchoolId(schoolId),
  };

  if (filters.studentId) {
    validateObjectId(filters.studentId, "student ID");
    filter.studentId = new Types.ObjectId(filters.studentId);
  }

  if (filters.sessionId) {
    validateObjectId(filters.sessionId, "session ID");
    filter.sessionId = new Types.ObjectId(filters.sessionId);
  }

  if (filters.certificateType) {
    filter.certificateType = filters.certificateType;
  }

  if (filters.status) {
    filter.status = filters.status;
  }

  if (filters.search) {
    filter.$or = [
      {
        certificateNumber: {
          $regex: filters.search,
          $options: "i",
        },
      },
      {
        studentName: {
          $regex: filters.search,
          $options: "i",
        },
      },
      {
        admissionNumber: {
          $regex: filters.search,
          $options: "i",
        },
      },
      {
        title: {
          $regex: filters.search,
          $options: "i",
        },
      },
    ];
  }

  const page = Math.max(1, filters.page);
  const limit = Math.min(100, Math.max(1, filters.limit));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Certificate.find(filter)
      .populate("studentId", "name admissionNumber")
      .populate("sessionId", "sessionName")
      .populate("issuedBy", "name email")
      .sort({ issueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Certificate.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get certificate by ID
export const getCertificateByIdService = async (
  schoolId: string,
  id: string
) => {
  validateObjectId(id, "certificate ID");

  const certificate = await Certificate.findOne({
    _id: new Types.ObjectId(id),
    schoolId: getSchoolId(schoolId),
  })
    .populate("studentId", "name admissionNumber")
    .populate("sessionId", "sessionName")
    .populate("issuedBy", "name email")
    .populate("updatedBy", "name email");

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  return certificate;
};

// Update certificate
export const updateCertificateService = async (
  schoolId: string,
  id: string,
  input: Partial<CertificateInput> & {
    updatedBy?: string;
  }
) => {
  validateObjectId(id, "certificate ID");

  const schoolObjectId = getSchoolId(schoolId);

  const certificate = await Certificate.findOne({
    _id: new Types.ObjectId(id),
    schoolId: schoolObjectId,
  });

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  if (certificate.status === CertificateStatus.REVOKED) {
    throw new AppError("Revoked certificate cannot be updated", 400);
  }

  if (input.studentId) {
    const student = await getSchoolStudent(
      schoolObjectId,
      input.studentId
    );

    certificate.studentId = student._id;
    certificate.studentName = student.name;
    certificate.fatherName = student.fatherName;
    certificate.motherName = student.motherName;
    certificate.admissionNumber = student.admissionNumber;
  }

  if (input.sessionId) {
    validateObjectId(input.sessionId, "session ID");
    certificate.sessionId = new Types.ObjectId(input.sessionId);
  }

  if (input.certificateType !== undefined) {
    certificate.certificateType = input.certificateType;
  }

  if (input.title !== undefined) {
    certificate.title = input.title;
  }

  if (input.description !== undefined) {
    certificate.description = input.description;
  }

  if (input.issueDate !== undefined) {
    certificate.issueDate = new Date(input.issueDate);
  }

  if (input.validUntil !== undefined) {
    certificate.validUntil = input.validUntil
      ? new Date(input.validUntil)
      : undefined;
  }

  if (input.reason !== undefined) {
    certificate.reason = input.reason;
  }

  if (input.remarks !== undefined) {
    certificate.remarks = input.remarks;
  }

  if (input.templateId !== undefined) {
    if (input.templateId) {
      validateObjectId(input.templateId, "template ID");
      certificate.templateId = new Types.ObjectId(
        input.templateId
      );
    } else {
      certificate.templateId = undefined;
    }
  }

  if (input.pdfUrl !== undefined) {
    certificate.pdfUrl = input.pdfUrl;
  }

  if (input.updatedBy) {
    validateObjectId(input.updatedBy, "user ID");
    certificate.updatedBy = new Types.ObjectId(input.updatedBy);
  }

  validateCertificateDates(
    certificate.issueDate,
    certificate.validUntil
  );

  await certificate.save();

  return certificate;
};

// Revoke/delete certificate
export const deleteCertificateService = async (
  schoolId: string,
  id: string
) => {
  validateObjectId(id, "certificate ID");

  const certificate = await Certificate.findOne({
    _id: new Types.ObjectId(id),
    schoolId: getSchoolId(schoolId),
  });

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  // Keep the record for verification and audit history.
  certificate.status = CertificateStatus.REVOKED;
  certificate.isVerified = false;

  await certificate.save();

  return certificate;
};

// Get all certificates of a student
export const getStudentCertificatesService = async (
  schoolId: string,
  studentId: string
) => {
  const schoolObjectId = getSchoolId(schoolId);

  await getSchoolStudent(schoolObjectId, studentId);

  return Certificate.find({
    schoolId: schoolObjectId,
    studentId: new Types.ObjectId(studentId),
  })
    .populate("sessionId", "sessionName")
    .populate("issuedBy", "name email")
    .sort({ issueDate: -1 })
    .lean();
};

