import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid MongoDB ID");
const markEntry = z.object({
  studentId: objectId,
  subjectId: objectId,
  marksObtained: z.coerce.number().finite().min(0).refine((value) => Math.round(value * 10) === value * 10, "Only one decimal place is allowed"),
  isAbsent: z.boolean().optional().default(false),
  remarks: z.string().trim().max(1000).optional(),
}).strict().refine((entry) => !entry.isAbsent || entry.marksObtained === 0, "Absent students must have zero marks");

export const examMarksParamsSchema = z.object({ examId: objectId });
export const examMarksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  subjectId: objectId.optional(),
  studentId: objectId.optional(),
});
export const saveExamMarksSchema = z.object({
  marks: z.array(markEntry).min(1).max(500),
}).strict();
export type SaveExamMarksInput = z.infer<typeof saveExamMarksSchema>;
