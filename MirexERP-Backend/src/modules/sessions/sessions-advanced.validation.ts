import { z } from "zod";

const id = z.string().regex(/^[0-9a-fA-F]{24}$/, "Please provide a valid ID");
const sessionPair = z.object({ sourceSessionId: id, destinationSessionId: id }).refine(v => v.sourceSessionId !== v.destinationSessionId, { message: "Source and destination sessions must differ", path: ["destinationSessionId"] });

export const closeSessionSchema = z.object({ params: z.object({ id }), body: z.object({ confirmation: z.literal("CLOSE_SESSION") }) });
export const prepareClassesSchema = z.object({ body: sessionPair });
export const cloneFeesSchema = z.object({ body: sessionPair });
export const activateFeeStructureSchema = z.object({ params: z.object({ feeStructureId: id }), body: z.object({ confirmation: z.literal("ACTIVATE_FEE_STRUCTURE") }) });
export const sessionIdSchema = z.object({ params: z.object({ id }) });
export const reportQuerySchema = z.object({ query: z.object({ sessionId: id.optional() }) });
export const historyQuerySchema = z.object({ query: z.object({ sessionId: id.optional() }) });
export const promotionPreviewSchema = z.object({ query: z.object({
  sourceSessionId: id, destinationSessionId: id,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine(v => v.sourceSessionId !== v.destinationSessionId, { message: "Source and destination sessions must differ" }) });
export const eligibleQuerySchema = z.object({ query: z.object({ sessionId: id, search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }) });
export const promoteStudentsSchema = z.object({
  body: z.object({
    fromSessionId: id,
    toSessionId: id,
    confirmOverCapacity: z.boolean().optional(),
    promotions: z.array(z.object({
      studentId: id,
      classId: id.optional(),
      sectionId: id.optional(),
      status: z.enum(["PROMOTED", "DETAINED"]).optional(),
      reason: z.string().trim().max(500).optional(),
    })).min(1).max(100),
  }).refine(v => v.fromSessionId !== v.toSessionId, { message: "Source and destination sessions must differ" }),
});

export const promoteIndividualStudentSchema = z.object({
  body: z.object({
    fromSessionId: id,
    toSessionId: id,
    confirmOverCapacity: z.boolean().optional(),
    promotions: z.array(z.object({
      studentId: id,
      classId: id.optional(),
      sectionId: id.optional(),
      status: z.enum(["PROMOTED", "DETAINED"]).optional(),
      reason: z.string().trim().max(500).optional(),
    })).length(1),
  }).refine(value => value.fromSessionId !== value.toSessionId, { message: "Source and destination sessions must differ" }),
});
