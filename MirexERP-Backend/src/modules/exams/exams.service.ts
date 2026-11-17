
import { Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import { Exam, ExamStatus } from "./exams.model";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import ClassSubjectMapping from "../subjects/class-subject-mapping.model";
import Subject from "../subjects/subjects.model";
import { ExamMark } from "./exam-mark.model";

interface ExamActor {
  id: string;
  schoolId: string | null;
  role: string;
}

interface ExamSubjectInput {
  subjectId: string;
  examDate: string | Date;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passingMarks: number;
  roomNumber?: string;
}

interface CreateExamInput {
  sessionId: string;
  classId: string;
  examName: string;
  examCode?: string;
  examType: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  subjects: ExamSubjectInput[];
  status?: ExamStatus;
}

interface ExamFilters {
  page: number;
  limit: number;
  search?: string;
  classId?: string;
  sessionId?: string;
  status?: string;
}

const validateObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const getSchoolId = (schoolId: string | null): Types.ObjectId => {
  if (!schoolId || !Types.ObjectId.isValid(schoolId)) {
    throw new AppError("Valid school context is required", 400);
  }

  return new Types.ObjectId(schoolId);
};

const normalizeSubjects = (subjects: ExamSubjectInput[]) => {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new AppError("At least one exam subject is required", 400);
  }

  const seenSubjects = new Set<string>();

  return subjects.map((subject) => {
    validateObjectId(subject.subjectId, "subject ID");

    const subjectId = subject.subjectId.toString();

    if (seenSubjects.has(subjectId)) {
      throw new AppError("Duplicate subject in exam schedule", 400);
    }

    seenSubjects.add(subjectId);

    if (subject.passingMarks > subject.maxMarks) {
      throw new AppError(
        "Passing marks cannot exceed maximum marks",
        400
      );
    }

    if (subject.startTime >= subject.endTime) {
      throw new AppError(
        "Subject start time must be before end time",
        400
      );
    }

    return {
      subjectId: new Types.ObjectId(subjectId),
      examDate: new Date(subject.examDate),
      startTime: subject.startTime,
      endTime: subject.endTime,
      maxMarks: subject.maxMarks,
      passingMarks: subject.passingMarks,
      roomNumber: subject.roomNumber,
    };
  });
};

const validateExamDates = (
  startDate: string | Date,
  endDate: string | Date
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid exam date", 400);
  }

  if (start > end) {
    throw new AppError(
      "Exam end date cannot be before start date",
      400
    );
  }

  return { start, end };
};

export const createExamService = async (
  actor: ExamActor,
  input: CreateExamInput
) => {
  const schoolId = getSchoolId(actor.schoolId);

  validateObjectId(input.sessionId, "session ID");
  validateObjectId(input.classId, "class ID");
  const session = await Session.findOne({ _id: input.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Academic session is closed or unavailable", 409);
  const classRecord = await Class.findOne({ _id: input.classId, schoolId, sessionId: input.sessionId, isDeleted: false }).select("_id");
  if (!classRecord) throw new AppError("Class does not belong to the selected school and academic session", 400);

  const { start, end } = validateExamDates(
    input.startDate,
    input.endDate
  );

  const duplicateName = await Exam.findOne({ schoolId, sessionId: new Types.ObjectId(input.sessionId), examName: input.examName.trim() }).collation({ locale: "en", strength: 2 }).select("_id");
  if (duplicateName) throw new AppError("Exam name already exists in this school and academic session", 409);

  const subjects = normalizeSubjects(input.subjects);
  const mappedSubjects = await ClassSubjectMapping.find({
    schoolId, sessionId: input.sessionId, classId: input.classId, isActive: true,
    subjectId: { $in: subjects.map((item) => item.subjectId) },
    effectiveFrom: { $lte: new Date() },
  }).select("subjectId").lean();
  const mappedSet = new Set(mappedSubjects.map((item) => item.subjectId.toString()));
  const legacySet = new Set((classRecord.subjects || []).map((item: Types.ObjectId) => item.toString()));
  if (subjects.some((item) => !mappedSet.has(item.subjectId.toString()) && !legacySet.has(item.subjectId.toString()))) throw new AppError("Exam subjects must be mapped to this class and session before scheduling", 400);
  const activeSubjectCount = await Subject.countDocuments({ _id: { $in: subjects.map((item) => item.subjectId) }, schoolId, isDeleted: false, isActive: true });
  if (activeSubjectCount !== subjects.length) throw new AppError("Inactive or unavailable subjects cannot be added to a new examination", 400);

  for (const subject of subjects) {
    if (
      subject.examDate < start ||
      subject.examDate > end
    ) {
      throw new AppError(
        "Subject exam date must be within exam start and end dates",
        400
      );
    }
  }

  if (input.examCode) {
    const existingExam = await Exam.findOne({
      schoolId,
      sessionId: new Types.ObjectId(input.sessionId),
      examCode: input.examCode.trim().toUpperCase(),
    });

    if (existingExam) {
      throw new AppError(
        "Exam code already exists in this academic session",
        409
      );
    }
  }

  return Exam.create({
    schoolId,
    sessionId: new Types.ObjectId(input.sessionId),
    classId: new Types.ObjectId(input.classId),
    examName: input.examName,
    examCode: input.examCode?.trim().toUpperCase(),
    examType: input.examType,
    description: input.description,
    startDate: start,
    endDate: end,
    subjects,
    status: input.status ?? ExamStatus.DRAFT,
    isPublished: false,
    createdBy: new Types.ObjectId(actor.id),
  });
};

export const getExamsService = async (
  schoolId: string | null,
  filters: ExamFilters
) => {
  const filter: Record<string, unknown> = {};

  if (schoolId) {
    filter.schoolId = getSchoolId(schoolId);
  }

  if (filters.classId) {
    validateObjectId(filters.classId, "class ID");
    filter.classId = new Types.ObjectId(filters.classId);
  }

  if (filters.sessionId) {
    validateObjectId(filters.sessionId, "session ID");
    filter.sessionId = new Types.ObjectId(filters.sessionId);
  }

  if (filters.status) {
    filter.status = filters.status;
  }

  if (filters.search) {
    filter.$or = [
      { examName: { $regex: filters.search, $options: "i" } },
      { examCode: { $regex: filters.search, $options: "i" } },
      { examType: { $regex: filters.search, $options: "i" } },
    ];
  }

  const page = Math.max(1, filters.page);
  const limit = Math.min(100, Math.max(1, filters.limit));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Exam.find(filter)
      .populate("classId", "className")
      .populate("sessionId", "sessionName")
      .populate("subjects.subjectId", "subjectName subjectCode")
      .sort({ startDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Exam.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getExamByIdService = async (
  schoolId: string | null,
  id: string
) => {
  validateObjectId(id, "exam ID");

  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(id),
  };

  if (schoolId) {
    filter.schoolId = getSchoolId(schoolId);
  } else {
    throw new AppError("School context is required", 400);
  }

  const exam = await Exam.findOne(filter)
    .populate("classId", "className")
    .populate("sessionId", "sessionName")
    .populate("subjects.subjectId", "subjectName subjectCode");

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  return exam;
};

export const updateExamService = async (
  schoolId: string,
  id: string,
  input: Partial<CreateExamInput> & { updatedBy?: string }
) => {
  validateObjectId(id, "exam ID");

  const schoolObjectId = getSchoolId(schoolId);

  const exam = await Exam.findOne({
    _id: new Types.ObjectId(id),
    schoolId: schoolObjectId,
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.isPublished || ["SUBMITTED", "VERIFIED", "APPROVED", "PUBLISHED"].includes(exam.marksWorkflowStatus)) throw new AppError("Examination schedule is locked after marks submission", 409);
  const sourceSession = await Session.findOne({ _id: exam.sessionId, schoolId: schoolObjectId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!sourceSession) throw new AppError("Exams in a closed session cannot be changed", 409);
  const targetSessionId = input.sessionId || String(exam.sessionId);
  const session = await Session.findOne({ _id: targetSessionId, schoolId: schoolObjectId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Exams in a closed session cannot be changed", 409);

  if (input.sessionId) {
    validateObjectId(input.sessionId, "session ID");
    exam.sessionId = new Types.ObjectId(input.sessionId);
  }

  if (input.classId) {
    validateObjectId(input.classId, "class ID");
    exam.classId = new Types.ObjectId(input.classId);
  }

  if (input.examName !== undefined) {
    const duplicateName = await Exam.findOne({ _id: { $ne: exam._id }, schoolId: schoolObjectId, sessionId: exam.sessionId, examName: input.examName.trim() }).collation({ locale: "en", strength: 2 }).select("_id");
    if (duplicateName) throw new AppError("Exam name already exists in this school and academic session", 409);
    exam.examName = input.examName;
  }
  if (input.examCode !== undefined) {
    exam.examCode = input.examCode.trim().toUpperCase();
  }
  if (input.examType !== undefined) exam.examType = input.examType;
  if (input.description !== undefined) {
    exam.description = input.description;
  }

  if (input.startDate !== undefined) {
    exam.startDate = new Date(input.startDate);
  }

  if (input.endDate !== undefined) {
    exam.endDate = new Date(input.endDate);
  }

  if (input.subjects !== undefined) {
    exam.subjects = normalizeSubjects(input.subjects) as typeof exam.subjects;
  }

  if (input.status !== undefined) exam.status = input.status;

  if (input.updatedBy) {
    validateObjectId(input.updatedBy, "updated by user ID");
    exam.updatedBy = new Types.ObjectId(input.updatedBy);
  }

  const { start, end } = validateExamDates(
    exam.startDate,
    exam.endDate
  );

  if (input.subjects !== undefined || input.classId !== undefined || input.sessionId !== undefined) {
    const targetClass = await Class.findOne({ _id: exam.classId, schoolId: schoolObjectId, sessionId: exam.sessionId, isDeleted: false }).select("subjects");
    if (!targetClass) throw new AppError("Exam class must belong to the selected school and academic session", 400);
    const mapped = await ClassSubjectMapping.find({ schoolId: schoolObjectId, sessionId: exam.sessionId, classId: exam.classId, subjectId: { $in: exam.subjects.map((item) => item.subjectId) }, isActive: true, effectiveFrom: { $lte: new Date() } }).select("subjectId").lean();
    const mappedIds = new Set(mapped.map((item) => item.subjectId.toString()));
    const legacyIds = new Set((targetClass.subjects || []).map((item: Types.ObjectId) => item.toString()));
    if (exam.subjects.some((item) => !mappedIds.has(item.subjectId.toString()) && !legacyIds.has(item.subjectId.toString()))) throw new AppError("Every examination subject must be mapped to the selected class and session", 400);
    const activeCount = await Subject.countDocuments({ _id: { $in: exam.subjects.map((item) => item.subjectId) }, schoolId: schoolObjectId, isDeleted: false, isActive: true });
    if (activeCount !== exam.subjects.length) throw new AppError("Inactive or unavailable subjects cannot be added to an examination", 400);
  }

  for (const subject of exam.subjects) {
    if (subject.examDate < start || subject.examDate > end) {
      throw new AppError(
        "Subject exam date must be within exam start and end dates",
        400
      );
    }
  }

  await exam.save();

  return exam;
};

export const deleteExamService = async (
  schoolId: string,
  id: string
) => {
  validateObjectId(id, "exam ID");
  const schoolObjectId = getSchoolId(schoolId);
  const exam = await Exam.findOne({ _id: new Types.ObjectId(id), schoolId: schoolObjectId });
  if (!exam) throw new AppError("Exam not found", 404);
  const session = await Session.findOne({ _id: exam.sessionId, schoolId: schoolObjectId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Exams in a closed session cannot be deleted", 409);
  const marksExist = await ExamMark.exists({ schoolId: schoolObjectId, examId: exam._id });
  if (marksExist) throw new AppError("Exam has student marks and cannot be deleted; preserve its academic history", 409);
  await exam.deleteOne();
  return exam;
};
