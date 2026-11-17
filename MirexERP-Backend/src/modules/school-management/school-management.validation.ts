import { z } from "zod";
const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/).optional();
const branchFields = {
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  phone,
  email: z.string().trim().email().max(150).optional(),
  address: z.object({ street: z.string().trim().max(150).optional(), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), country: z.string().trim().min(2).default("India"), postalCode: z.string().regex(/^[0-9]{6}$/) }),
};
export const createBranchSchema = z.object({ body: z.object(branchFields).strict() });
export const updateBranchSchema = z.object({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) }), body: z.object({ name: branchFields.name.optional(), code: branchFields.code.optional(), phone, email: branchFields.email, address: branchFields.address.partial().optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() }).strict().refine(v => Object.keys(v).length > 0) });
export const branchIdSchema = z.object({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) }) });
export const documentMetaSchema = z.object({ body: z.object({ title: z.string().trim().min(2).max(150), category: z.enum(["AFFILIATION_CERTIFICATE", "REGISTRATION_CERTIFICATE", "RECOGNITION_CERTIFICATE", "OTHER"]) }) });
export const schoolBrandingSchema = z.object({ body: z.object({ primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }).strict().refine(v => Object.keys(v).length > 0) });

export const schoolProfileUpdateSchema = z.object({ body: z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().length(3).optional(),
  address: z.object({ street: z.string().trim().max(150).optional(), area: z.string().trim().max(100).optional(), city: z.string().trim().min(2).max(80).optional(), state: z.string().trim().min(2).max(80).optional(), country: z.string().trim().min(2).max(80).optional(), postalCode: z.string().trim().min(4).max(12).optional() }).partial().optional(),
  contact: z.object({ phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/).optional(), alternatePhone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/).optional(), email: z.string().trim().email().optional(), website: z.string().trim().url().optional() }).optional(),
  affiliation: z.object({ board: z.string().trim().min(2).max(100).optional(), affiliationNumber: z.string().trim().max(100).optional(), recognitionNumber: z.string().trim().max(100).optional() }).optional(),
  principal: z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().optional(), phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/).optional() }).optional(),
}).strict().refine(v => Object.keys(v).length > 0) });
