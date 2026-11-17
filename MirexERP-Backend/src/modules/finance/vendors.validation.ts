import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid MongoDB ID");
export const createVendorSchema = z.object({ body: z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(150).optional(),
  address: z.string().trim().max(500).optional(),
  gstin: z.string().trim().max(15).optional(),
  pan: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
}) });
export const updateVendorSchema = z.object({ params: z.object({ id: objectId }), body: z.object({
  name: z.string().trim().min(2).max(150).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(150).optional(),
  address: z.string().trim().max(500).optional(),
  gstin: z.string().trim().max(15).optional(),
  pan: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
}).refine((v)=>Object.keys(v).length>0,"At least one field is required") });
export const vendorListSchema = z.object({ query: z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
}) });
export const vendorIdSchema = z.object({ params: z.object({ id: objectId }) });
