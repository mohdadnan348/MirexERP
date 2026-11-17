
import mongoose, { FilterQuery, Types } from "mongoose";

import Admission, {
  IAdmissionDocumentModel,
} from "./admissions.model";

import Student from "../students/students.model";
import StudentRecord from "../students/student-records.model";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import { Parent } from "../parents/parents.model";
import School from "../schools/schools.model";
import AdmissionCounter from "./admission-counter.model";
import AdmissionSettings from "./admission-settings.model";
import {notifyAdmissionParent} from "./admission-notification.service";

import { AppError } from "../../utils/AppError";
import { createPaginationMeta } from "../../utils/pagination";

import {
  ADMISSION_STATUS,
  STUDENT_STATUS,
} from "../../config/constants";

import {
  CreateAdmissionInput,
  UpdateAdmissionInput,
  AdmissionListQuery,
  ReviewAdmissionInput,
  ApproveAdmissionInput,
  RejectAdmissionInput,
  CancelAdmissionInput,
} from "./admissions.validation";

interface AdmissionActor {
  userId: string;
  schoolId: string;
}

interface AdmissionListResult {
  admissions: IAdmissionDocumentModel[];
  pagination: ReturnType<typeof createPaginationMeta>;
}

const toObjectId = (value: string): Types.ObjectId => {
  return new Types.ObjectId(value);
};

const validateObjectId = (
  value: string,
  fieldName: string
): void => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const ensureActiveSession = async (
  sessionId: string,
  schoolId: string
): Promise<void> => {
  validateObjectId(sessionId, "session ID");

  const session = await Session.findOne({
    _id: toObjectId(sessionId),
    schoolId: toObjectId(schoolId),
    isActive: true,
    isDeleted: false,
    isClosed: { $ne: true },
  }).select("_id");

  if (!session) {
    throw new AppError(
      "Active academic session not found",
      404
    );
  }
};

const ensureAdmissionExists = async (
  admissionId: string,
  schoolId: string
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(admissionId, "admission ID");

  const admission = await Admission.findOne({
    _id: toObjectId(admissionId),
    schoolId: toObjectId(schoolId),
    isDeleted: false,
  });

  if (!admission) {
    throw new AppError(
      "Admission application not found",
      404
    );
  }

  return admission;
};

const ensureNotConverted = (
  admission: IAdmissionDocumentModel
): void => {
  if (
    admission.status === ADMISSION_STATUS.CONVERTED ||
    admission.convertedStudentId
  ) {
    throw new AppError(
      "This admission has already been converted into a student",
      409
    );
  }
};

const handleDuplicateError = (error: unknown): never => {
  if (
    error instanceof mongoose.mongo.MongoServerError &&
    error.code === 11000
  ) {
    throw new AppError(
      "Application number or student admission number already exists",
      409
    );
  }

  throw error;
};

// CREATE ADMISSION APPLICATION
export const createAdmissionService = async (
  data: CreateAdmissionInput,
  actor: AdmissionActor
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(actor.schoolId, "school ID");
  validateObjectId(actor.userId, "user ID");

  if (data.parentDeclaration !== true) throw new AppError("Parent declaration is required before application submission", 400);
  await ensureActiveSession(data.sessionId, actor.schoolId);
  const selectedClass = await Class.findOne({ _id: toObjectId(data.appliedClassId), schoolId: toObjectId(actor.schoolId), sessionId: toObjectId(data.sessionId), isDeleted: false, isActive: true }).select("_id");
  if (!selectedClass) throw new AppError("Selected class is not active in this school session", 400);
  if (data.appliedSectionId) {
    const selectedSection = await Section.findOne({ _id: toObjectId(data.appliedSectionId), schoolId: toObjectId(actor.schoolId), sessionId: toObjectId(data.sessionId), classId: selectedClass._id, isDeleted: false, isActive: true }).select("_id");
    if (!selectedSection) throw new AppError("Selected section does not belong to the selected class and session", 400);
  }
  const primaryPhone = data.guardians.find((g:any)=>g.isPrimaryContact)?.phone || data.guardians[0]?.phone;
  const duplicate = await Admission.findOne({
    schoolId: toObjectId(actor.schoolId), isDeleted: false,
    fullName: new RegExp(`^${[data.firstName,data.middleName,data.lastName].filter(Boolean).join(" ").replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")}$`,"i"),
    dateOfBirth: data.dateOfBirth,
    $or: [{ phone: primaryPhone }, { "guardians.phone": primaryPhone }],
  }).select("_id applicationNumber fullName status").lean();
  if (duplicate) throw new AppError(`Possible duplicate application found (${duplicate.applicationNumber}). Review it before creating another record.`, 409);
  const settings:any = await AdmissionSettings.findOne({schoolId:toObjectId(actor.schoolId)}).lean();
  const ageRule = settings?.ageCriteria?.find((rule:any)=>String(rule.classId)===String(data.appliedClassId));
  if (ageRule && data.dateOfBirth) {
    const age=(Date.now()-new Date(data.dateOfBirth).getTime())/(365.2425*24*60*60*1000);
    if ((ageRule.minAge!=null&&age<ageRule.minAge)||(ageRule.maxAge!=null&&age>ageRule.maxAge)) throw new AppError(`Applicant age must be between ${ageRule.minAge??0} and ${ageRule.maxAge??"unlimited"} years for this class.`,400);
  }

  try {
    const admission = await Admission.create({
      ...data,
      schoolId: toObjectId(actor.schoolId),
      sessionId: toObjectId(data.sessionId),
      applicationNumber: data.applicationNumber.toUpperCase(),
      createdBy: toObjectId(actor.userId),
      status: ADMISSION_STATUS.APPLIED,
      statusHistory: [{ newStatus: ADMISSION_STATUS.APPLIED, changedBy: toObjectId(actor.userId), changedAt: new Date(), remarks: "Application created" }],
      applicationDate: new Date(),
      isDeleted: false,
    });
    const contactPhone = admission.guardians.find((g:any)=>g.isPrimaryContact)?.phone || admission.guardians[0]?.phone;
    if(contactPhone) await notifyAdmissionParent({schoolId:admission.schoolId,applicationId:(admission as any)._id,event:"APPLICATION_RECEIVED",phone:contactPhone,childName:admission.fullName,applicationNumber:admission.applicationNumber});
    return admission;
  } catch (error) {
    return handleDuplicateError(error);
  }
};

// GET ALL ADMISSION APPLICATIONS
export const getAllAdmissionsService = async (
  query: AdmissionListQuery,
  schoolId: string
): Promise<AdmissionListResult> => {
  validateObjectId(schoolId, "school ID");

  const page = Math.max(
    1,
    Number(query.page) || 1
  );

  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit) || 10)
  );

  const skip = (page - 1) * limit;

  const filters: FilterQuery<IAdmissionDocumentModel> = {
    schoolId: toObjectId(schoolId),
    isDeleted: false,
  };

  if (query.sessionId) {
    filters.sessionId = toObjectId(query.sessionId);
  }

  if (query.appliedClassId) {
    filters.appliedClassId = toObjectId(
      query.appliedClassId
    );
  }

  if (query.status) {
    filters.status = query.status;
  }

  if (query.search) {
    const escapedSearch = query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const searchRegex = new RegExp(escapedSearch, "i");

    filters.$or = [
      { fullName: searchRegex },
      { applicationNumber: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const [admissions, total] = await Promise.all([
    Admission.find(filters)
      .sort({ [query.sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate("appliedClassId", "name code")
      .populate("appliedSectionId", "name")
      .populate("sessionId", "name code")
      .populate("reviewedBy", "name email")
      .exec(),

    Admission.countDocuments(filters),
  ]);

  return {
    admissions,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// GET ADMISSION BY ID
export const getAdmissionByIdService = async (
  admissionId: string,
  schoolId: string
): Promise<IAdmissionDocumentModel> => {
  const admission = await ensureAdmissionExists(
    admissionId,
    schoolId
  );

  await admission.populate([
    { path: "appliedClassId", select: "name code" },
    { path: "appliedSectionId", select: "name" },
    { path: "sessionId", select: "name code" },
    { path: "reviewedBy", select: "name email" },
    {
      path: "convertedStudentId",
      select: "admissionNumber fullName",
    },
  ]);

  return admission;
};

// UPDATE ADMISSION APPLICATION
export const updateAdmissionService = async (
  admissionId: string,
  data: UpdateAdmissionInput,
  actor: AdmissionActor
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(actor.userId, "user ID");

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);
  if (data.appliedClassId) {
    const cls = await Class.findOne({ _id: toObjectId(data.appliedClassId), schoolId: toObjectId(actor.schoolId), sessionId: admission.sessionId, isDeleted: false, isActive: true }).select("_id");
    if (!cls) throw new AppError("Selected class does not belong to this school's active session", 400);
  }
  if (data.dateOfBirth || data.appliedClassId) {
    const targetClassId = data.appliedClassId || admission.appliedClassId.toString();
    const settings:any = await AdmissionSettings.findOne({schoolId:toObjectId(actor.schoolId)}).lean();
    const ageRule = settings?.ageCriteria?.find((rule:any)=>String(rule.classId)===String(targetClassId));
    const dob = data.dateOfBirth || admission.dateOfBirth;
    if (ageRule && dob) {
      const age=(Date.now()-new Date(dob).getTime())/(365.2425*24*60*60*1000);
      if ((ageRule.minAge!=null&&age<ageRule.minAge)||(ageRule.maxAge!=null&&age>ageRule.maxAge)) throw new AppError(`Applicant age must be between ${ageRule.minAge??0} and ${ageRule.maxAge??"unlimited"} years for this class.`,400);
    }
  }
  if (data.appliedSectionId) {
    const clsId = data.appliedClassId || admission.appliedClassId.toString();
    const section = await Section.findOne({ _id: toObjectId(data.appliedSectionId), schoolId: toObjectId(actor.schoolId), sessionId: admission.sessionId, classId: toObjectId(clsId), isDeleted: false, isActive: true }).select("_id");
    if (!section) throw new AppError("Selected section does not belong to the selected class and session", 400);
  }

  if (
    admission.status === ADMISSION_STATUS.APPROVED ||
    admission.status === ADMISSION_STATUS.REJECTED ||
    admission.status === ADMISSION_STATUS.CANCELLED
  ) {
    throw new AppError(
      "This admission application can no longer be edited",
      400
    );
  }

  try {
    admission.set({
      ...data,
      updatedBy: toObjectId(actor.userId),
    });

    await admission.save();

    return admission;
  } catch (error) {
    return handleDuplicateError(error);
  }
};

// REVIEW ADMISSION APPLICATION
export const reviewAdmissionService = async (
  admissionId: string,
  data: ReviewAdmissionInput,
  actor: AdmissionActor
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(actor.userId, "user ID");

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);

  if (
    admission.status === ADMISSION_STATUS.REJECTED ||
    admission.status === ADMISSION_STATUS.CANCELLED ||
    admission.status === ADMISSION_STATUS.APPROVED
  ) {
    throw new AppError(
      "This application cannot be reviewed in its current status",
      400
    );
  }

  if (data.documentsVerified) {
    const settings:any = await AdmissionSettings.findOne({schoolId:toObjectId(actor.schoolId)}).lean();
    const required = settings?.requiredDocuments?.find((item:any)=>String(item.classId)===String(admission.appliedClassId))?.documentTypes || [];
    const missing = required.filter((type:string)=>!(admission.documents||[]).some((document:any)=>document.documentType===type && document.verified && !document.isDeleted));
    if (missing.length) throw new AppError(`Required documents are missing or unverified: ${missing.join(", ")}`,400);
    if ((admission.documents||[]).some((document:any)=>!document.verified&&!document.isDeleted)) throw new AppError("Every uploaded document must be verified individually before marking the application verified",400);
  }

  admission.statusHistory ||= [];
  const reviewStatus = data.documentsVerified ? ADMISSION_STATUS.VERIFIED : ADMISSION_STATUS.UNDER_REVIEW;
  admission.statusHistory.push({ previousStatus: admission.status, newStatus: reviewStatus, changedBy: toObjectId(actor.userId), changedAt: new Date(), remarks: data.reviewRemarks } as any);
  admission.status = reviewStatus;
  admission.reviewedBy = toObjectId(actor.userId);
  admission.reviewedAt = new Date();
  admission.reviewRemarks = data.reviewRemarks;
  admission.updatedBy = toObjectId(actor.userId);

  await admission.save();

  return admission;
};

// APPROVE ADMISSION AND CREATE STUDENT
export const approveAdmissionService = async (
 admissionId:string,
 data:{remarks?:string},
 actor:AdmissionActor
):Promise<IAdmissionDocumentModel>=>{
 validateObjectId(actor.userId,"user ID");
 const admission=await ensureAdmissionExists(admissionId,actor.schoolId);
 ensureNotConverted(admission);
 if(admission.status!=="VERIFIED") throw new AppError("Application must be verified before approval",400);
 const settings:any=await AdmissionSettings.findOne({schoolId:toObjectId(actor.schoolId)}).lean();
 const required=settings?.requiredDocuments?.find((x:any)=>String(x.classId)===String(admission.appliedClassId))?.documentTypes||[];
 const missing=required.filter((type:string)=>!(admission.documents||[]).some((d:any)=>d.documentType===type&&d.verified&&!d.isDeleted));
 if(missing.length) throw new AppError(`Required documents missing or unverified: ${missing.join(", ")}`,400);
 const old=admission.status; admission.status=ADMISSION_STATUS.APPROVED;
 admission.statusHistory ||= []; admission.statusHistory.push({previousStatus:old,newStatus:ADMISSION_STATUS.APPROVED,changedBy:toObjectId(actor.userId),changedAt:new Date(),remarks:data.remarks || "Approved by authorized reviewer"} as any);
 admission.reviewedBy=toObjectId(actor.userId); admission.reviewedAt=new Date(); admission.updatedBy=toObjectId(actor.userId);
 await admission.save();
 const phone=admission.guardians.find((g:any)=>g.isPrimaryContact)?.phone||admission.guardians[0]?.phone;
 if(phone) await notifyAdmissionParent({schoolId:admission.schoolId,applicationId:(admission as any)._id,event:"APPLICATION_APPROVED",phone,childName:admission.fullName,applicationNumber:admission.applicationNumber});
 return admission;
};

export const registerApprovedAdmissionService = async (
  admissionId: string,
  data: ApproveAdmissionInput,
  actor: AdmissionActor
): Promise<{
  admission: IAdmissionDocumentModel;
  studentId: Types.ObjectId;
}> => {
  validateObjectId(actor.schoolId, "school ID");
  validateObjectId(actor.userId, "user ID");
  validateObjectId(data.appliedClassId, "class ID");

  if (data.appliedSectionId) {
    validateObjectId(data.appliedSectionId, "section ID");
  }

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);
  if (admission.status !== ADMISSION_STATUS.APPROVED) {
    throw new AppError("Application must be approved before student registration", 400);
  }

  const admissionSettings:any = await AdmissionSettings.findOne({schoolId:toObjectId(actor.schoolId)}).lean();
  const required = admissionSettings?.requiredDocuments?.find((item:any)=>String(item.classId)===String(data.appliedClassId))?.documentTypes || [];
  const missing = required.filter((type:string)=>!(admission.documents||[]).some((doc:any)=>doc.documentType===type && doc.verified && !doc.isDeleted));
  if (missing.length) throw new AppError(`Required documents are missing or unverified: ${missing.join(", ")}`,400);

  await ensureActiveSession(
    admission.sessionId.toString(),
    actor.schoolId
  );

  const selectedSectionId = data.appliedSectionId || admission.appliedSectionId?.toString();
  if (!selectedSectionId) {
    throw new AppError("Select a section before approving this admission", 400);
  }
  validateObjectId(selectedSectionId, "section ID");
  const [classRecord, sectionRecord] = await Promise.all([
    Class.findOne({ _id: toObjectId(data.appliedClassId), schoolId: toObjectId(actor.schoolId), sessionId: admission.sessionId, isDeleted: false, isActive: true }).select("_id").lean(),
    Section.findOne({ _id: toObjectId(selectedSectionId), schoolId: toObjectId(actor.schoolId), sessionId: admission.sessionId, classId: toObjectId(data.appliedClassId), isDeleted: false, isActive: true }).select("_id").lean(),
  ]);
  if (!classRecord) throw new AppError("Selected class is not active in this school session", 400);
  if (!sectionRecord) throw new AppError("Selected section does not belong to the selected class and session", 400);

  const admissionYear = new Date(data.admissionDate).getFullYear();
  try {
    await AdmissionCounter.updateOne(
      { schoolId: toObjectId(actor.schoolId), year: admissionYear },
      { $setOnInsert: { sequence: 0 } },
      { upsert: true }
    );
  } catch (error: any) {
    // Concurrent first registration may win the unique school/year insert.
    if (error?.code !== 11000) throw error;
  }

  const mongoSession = await mongoose.startSession();

  try {
    let createdStudentId: Types.ObjectId | null = null;

    await mongoSession.withTransaction(async () => {
      const currentAdmission = await Admission.findOne({
        _id: admission._id,
        schoolId: toObjectId(actor.schoolId),
        isDeleted: false,
      }).session(mongoSession);

      if (!currentAdmission) {
        throw new AppError(
          "Admission application not found",
          404
        );
      }

      ensureNotConverted(currentAdmission);
      if (currentAdmission.status !== ADMISSION_STATUS.APPROVED) throw new AppError("Application is not approved for registration", 409);

      if (
        currentAdmission.status === ADMISSION_STATUS.REJECTED ||
        currentAdmission.status === ADMISSION_STATUS.CANCELLED
      ) {
        throw new AppError(
          "This application cannot be approved",
          400
        );
      }

      const school = await School.findById(currentAdmission.schoolId).select("code").session(mongoSession).lean();
      if (!school?.code) throw new AppError("School code is required to generate admission number", 400);
      const counter = await AdmissionCounter.findOneAndUpdate(
        { schoolId: currentAdmission.schoolId, year: admissionYear },
        { $inc: { sequence: 1 } },
        { new: true, session: mongoSession }
      );
      if (!counter) throw new AppError("Admission number counter could not be allocated", 500);
      const studentAdmissionNumber = `${String(school.code).toUpperCase()}${admissionYear}${String(counter.sequence).padStart(6, "0")}`;

      const primaryGuardian = currentAdmission.guardians.find((guardian) => guardian.isPrimaryContact) || currentAdmission.guardians[0];
      const [student] = await Student.create(
        [
          {
            schoolId: currentAdmission.schoolId,
            sessionId: currentAdmission.sessionId,
            admissionNumber: studentAdmissionNumber,
            firstName: currentAdmission.firstName,
            middleName: currentAdmission.middleName,
            lastName: currentAdmission.lastName,
            dateOfBirth: currentAdmission.dateOfBirth,
            gender: currentAdmission.gender,
            bloodGroup: currentAdmission.bloodGroup,
            email: currentAdmission.email,
            phone: currentAdmission.phone || primaryGuardian?.phone,
            address: {
              street: [currentAdmission.address.addressLine1, currentAdmission.address.addressLine2].filter(Boolean).join(", "),
              city: currentAdmission.address.city,
              state: currentAdmission.address.state,
              country: currentAdmission.address.country,
              postalCode: currentAdmission.address.postalCode,
            },
            emergencyContact: primaryGuardian ? {
              name: primaryGuardian.name,
              relationship: primaryGuardian.relationship,
              phone: primaryGuardian.phone,
            } : undefined,
            classId: toObjectId(data.appliedClassId),
            sectionId: toObjectId(selectedSectionId),
            admissionDate: data.admissionDate,
            previousSchool: currentAdmission.previousSchool,
            previousSchoolDetails: currentAdmission.previousSchool ? { name: currentAdmission.previousSchool } : undefined,
            status: STUDENT_STATUS.ACTIVE,
            isActive: true,
            createdBy: toObjectId(actor.userId),
          },
        ],
        { session: mongoSession }
      );

      await StudentRecord.create([{
        schoolId: currentAdmission.schoolId, sessionId: currentAdmission.sessionId, studentId: student._id,
        recordType: "STATUS", title: "Student registered from admission",
        details: { previousStatus: null, newStatus: STUDENT_STATUS.ACTIVE, reason: "Admission application registered", changedBy: actor.userId, changedAt: new Date() },
        uploadedBy: toObjectId(actor.userId),
      }], { session: mongoSession });

      // Reuse the primary parent identity by school + phone; otherwise create one.
      if (primaryGuardian) {
        let parent = await Parent.findOne({
          schoolId: currentAdmission.schoolId,
          phone: primaryGuardian.phone,
          isActive: true,
        }).session(mongoSession);
        if (!parent) {
          const [createdParent] = await Parent.create([{
            schoolId: currentAdmission.schoolId,
            firstName: primaryGuardian.name.trim().split(/\s+/)[0] || primaryGuardian.name,
            lastName: primaryGuardian.name.trim().split(/\s+/).slice(1).join(" ") || "Guardian",
            email: primaryGuardian.email || undefined,
            phone: primaryGuardian.phone,
            alternatePhone: primaryGuardian.alternatePhone,
            relation: primaryGuardian.relationship,
            occupation: primaryGuardian.occupation,
            studentIds: [student._id],
            isActive: true,
            createdBy: toObjectId(actor.userId),
          }], { session: mongoSession });
          parent = createdParent;
        } else {
          await Parent.updateOne(
            { _id: parent._id, schoolId: currentAdmission.schoolId },
            { $addToSet: { studentIds: student._id } },
            { session: mongoSession }
          );
        }
        student.parentId = parent._id;
        await student.save({ session: mongoSession });
      }

      currentAdmission.statusHistory ||= [];
      currentAdmission.statusHistory.push({ previousStatus: currentAdmission.status, newStatus: ADMISSION_STATUS.CONVERTED, changedBy: toObjectId(actor.userId), changedAt: new Date(), remarks: "Student registered" } as any);
      currentAdmission.status = ADMISSION_STATUS.CONVERTED;
      currentAdmission.admissionDate = data.admissionDate;
      currentAdmission.appliedClassId = toObjectId(
        data.appliedClassId
      );

      currentAdmission.appliedSectionId = toObjectId(selectedSectionId);

      currentAdmission.reviewedBy = toObjectId(actor.userId);
      currentAdmission.reviewedAt = new Date();
      currentAdmission.reviewRemarks = data.reviewRemarks;
      currentAdmission.convertedStudentId = student._id;
      currentAdmission.convertedAt = new Date();
      currentAdmission.updatedBy = toObjectId(actor.userId);

      await currentAdmission.save({
        session: mongoSession,
      });

      createdStudentId = student._id;
    });

    if (!createdStudentId) {
      throw new AppError(
        "Student conversion failed",
        500
      );
    }

    const updatedAdmission = await ensureAdmissionExists(
      admissionId,
      actor.schoolId
    );

    const contactPhone=updatedAdmission.guardians.find((g:any)=>g.isPrimaryContact)?.phone||updatedAdmission.guardians[0]?.phone;
    if(contactPhone) await notifyAdmissionParent({schoolId:updatedAdmission.schoolId,applicationId:(updatedAdmission as any)._id,event:"STUDENT_REGISTERED",phone:contactPhone,childName:updatedAdmission.fullName,applicationNumber:updatedAdmission.applicationNumber});
    return {
      admission: updatedAdmission,
      studentId: createdStudentId,
    };
  } catch (error) {
    return handleDuplicateError(error);
  } finally {
    await mongoSession.endSession();
  }
};

// REJECT ADMISSION APPLICATION
export const rejectAdmissionService = async (
  admissionId: string,
  data: RejectAdmissionInput,
  actor: AdmissionActor
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(actor.userId, "user ID");

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);

  if (admission.status === ADMISSION_STATUS.CANCELLED || admission.status === ADMISSION_STATUS.APPROVED) {
    throw new AppError(
      "Cancelled or approved applications cannot be rejected",
      400
    );
  }

  admission.statusHistory ||= [];
  admission.statusHistory.push({ previousStatus: admission.status, newStatus: ADMISSION_STATUS.REJECTED, changedBy: toObjectId(actor.userId), changedAt: new Date(), remarks: data.rejectionReason } as any);
  admission.status = ADMISSION_STATUS.REJECTED;
  admission.rejectionReason = data.rejectionReason;
  admission.reviewedBy = toObjectId(actor.userId);
  admission.reviewedAt = new Date();
  admission.updatedBy = toObjectId(actor.userId);

  await admission.save();

  return admission;
};

// CANCEL ADMISSION APPLICATION
export const cancelAdmissionService = async (
  admissionId: string,
  data: CancelAdmissionInput,
  actor: AdmissionActor
): Promise<IAdmissionDocumentModel> => {
  validateObjectId(actor.userId, "user ID");

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);

  if (
    admission.status === ADMISSION_STATUS.REJECTED ||
    admission.status === ADMISSION_STATUS.CANCELLED
  ) {
    throw new AppError(
      "This application cannot be cancelled",
      400
    );
  }

  admission.statusHistory ||= [];
  admission.statusHistory.push({ previousStatus: admission.status, newStatus: ADMISSION_STATUS.CANCELLED, changedBy: toObjectId(actor.userId), changedAt: new Date(), remarks: data.reason } as any);
  admission.status = ADMISSION_STATUS.CANCELLED;
  admission.reviewRemarks = data.reason;
  admission.updatedBy = toObjectId(actor.userId);

  await admission.save();

  return admission;
};

// DELETE ADMISSION APPLICATION (SOFT DELETE)
export const deleteAdmissionService = async (
  admissionId: string,
  actor: AdmissionActor
): Promise<{ message: string }> => {
  validateObjectId(actor.userId, "user ID");

  const admission = await ensureAdmissionExists(
    admissionId,
    actor.schoolId
  );

  ensureNotConverted(admission);

  admission.isDeleted = true;
  admission.deletedAt = new Date();
  admission.updatedBy = toObjectId(actor.userId);

  await admission.save();

  return {
    message: "Admission application deleted successfully",
  };
};

// GET ADMISSION SUMMARY
export const getAdmissionSummaryService = async (
  schoolId: string,
  sessionId?: string
): Promise<{
  total: number;
  applied: number;
  underReview: number;
  documentsPending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  converted: number;
}> => {
  validateObjectId(schoolId, "school ID");

  const filters: FilterQuery<IAdmissionDocumentModel> = {
    schoolId: toObjectId(schoolId),
    isDeleted: false,
  };

  if (sessionId) {
    validateObjectId(sessionId, "session ID");
    filters.sessionId = toObjectId(sessionId);
  }

  const statuses = [
    ADMISSION_STATUS.APPLIED,
    ADMISSION_STATUS.UNDER_REVIEW,
    ADMISSION_STATUS.DOCUMENTS_PENDING,
    ADMISSION_STATUS.APPROVED,
    ADMISSION_STATUS.REJECTED,
    ADMISSION_STATUS.CANCELLED,
    ADMISSION_STATUS.CONVERTED,
  ];

  const counts = await Promise.all(
    statuses.map((status) =>
      Admission.countDocuments({
        ...filters,
        status,
      })
    )
  );

  return {
    total: counts.reduce((sum, count) => sum + count, 0),
    applied: counts[0],
    underReview: counts[1],
    documentsPending: counts[2],
    approved: counts[3],
    rejected: counts[4],
    cancelled: counts[5],
    converted: counts[6],
  };
};

export const addAdmissionFollowUpService = async (
  admissionId: string,
  data: { note: string; outcome?: string; followUpDate?: Date; nextFollowUpDate?: Date },
  actor: AdmissionActor
) => {
  validateObjectId(actor.schoolId, "school ID");
  validateObjectId(actor.userId, "user ID");
  const admission = await ensureAdmissionExists(admissionId, actor.schoolId);
  if (([ADMISSION_STATUS.CONVERTED, ADMISSION_STATUS.CANCELLED, ADMISSION_STATUS.REJECTED] as string[]).includes(admission.status)) {
    throw new AppError("Follow-ups cannot be added to a closed admission", 400);
  }
  admission.followUps ||= [];
  admission.followUps.push({
    note: data.note,
    outcome: data.outcome,
    followUpDate: data.followUpDate || new Date(),
    nextFollowUpDate: data.nextFollowUpDate,
    createdBy: toObjectId(actor.userId),
    createdAt: new Date(),
  });
  admission.updatedBy = toObjectId(actor.userId);
  await admission.save();
  return admission;
};
