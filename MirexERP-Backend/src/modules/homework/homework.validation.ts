import { z } from "zod";
import { HOMEWORK_STATUS, HOMEWORK_SUBMISSION_STATUS } from "./homework.model";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const bool = z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean());
const optionalBool = bool.optional();
const status = z.enum([HOMEWORK_STATUS.DRAFT, HOMEWORK_STATUS.PUBLISHED] as const);
const submissionStatus = z.enum(Object.values(HOMEWORK_SUBMISSION_STATUS) as [string, ...string[]]);

export const createHomeworkSchema = z.object({
  body: z.object({
    academicSessionId: objectId,
    classId: objectId,
    sectionId: objectId.optional(),
    sectionIds: z.array(objectId).max(30).optional(),
    subjectId: objectId,
    teacherId: objectId.optional(),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(10000),
    instructions: z.string().trim().max(5000).optional(),
    assignedDate: date.optional(),
    dueDate: date,
    totalMarks: z.coerce.number().nonnegative().optional(),
    attachments: z.array(z.object({ name: z.string().min(1), url: z.string().startsWith("/api/v1/homework/files/"), type: z.string().optional(), size: z.number().max(10 * 1024 * 1024).optional() })).max(10).optional(),
    allowSubmission: optionalBool,
    allowLateSubmission: optionalBool,
    allowResubmission: optionalBool,
    status: status.optional(),
  }),
});
export const updateHomeworkSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    academicSessionId: objectId.optional(),
    classId: objectId.optional(),
    sectionId: objectId.nullable().optional(),
    sectionIds: z.array(objectId).max(30).optional(),
    subjectId: objectId.optional(),
    teacherId: objectId.optional(),
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(3).max(10000).optional(),
    instructions: z.string().trim().max(5000).optional(),
    assignedDate: date.optional(),
    dueDate: date.optional(),
    totalMarks: z.coerce.number().nonnegative().nullable().optional(),
    attachments: z.array(z.object({ name: z.string().min(1), url: z.string().startsWith("/api/v1/homework/files/"), type: z.string().optional(), size: z.number().max(10 * 1024 * 1024).optional() })).max(10).optional(),
    allowSubmission: optionalBool,
    allowLateSubmission: optionalBool,
    allowResubmission: optionalBool,
    status: status.optional(),
  }).refine((v) => Object.keys(v).length > 0, "At least one field is required"),
});
export const idSchema = z.object({ params: z.object({ id: objectId }) });
export const submissionIdSchema = z.object({ params: z.object({ id: objectId, submissionId: objectId }) });
const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  subjectId: objectId.optional(),
  teacherId: objectId.optional(),
  studentId: objectId.optional(),
  homeworkId: objectId.optional(),
  academicSessionId: objectId.optional(),
  status: z.string().optional(),
  startDate: date.optional(),
  endDate: date.optional(),
});
export const listHomeworkSchema = z.object({ query: listQuery });
export const submissionsQuerySchema = z.object({
  params: z.object({ id: objectId }),
  query: listQuery.extend({ status: submissionStatus.optional() }),
});
export const submitHomeworkSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ answer: z.string().max(20000).optional(), studentId: objectId.optional() }),
});
export const evaluateSubmissionSchema = z.object({
  params: z.object({ id: objectId, submissionId: objectId }),
  body: z.object({
    marksObtained: z.coerce.number().nonnegative().optional(),
    feedback: z.string().trim().max(2000).optional(),
    requestResubmission: optionalBool,
  }).refine((v) => v.marksObtained !== undefined || v.feedback !== undefined || v.requestResubmission === true, "Marks, feedback or resubmission request is required"),
});
export const remindersSchema = z.object({ body: z.object({ homeworkId: objectId.optional() }) });
export const fileSchema = z.object({ params: z.object({ filename: z.string().min(20).max(100) }) });
