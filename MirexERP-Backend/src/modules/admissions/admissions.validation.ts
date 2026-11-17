
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{10,15}$/, "Enter a valid phone number");

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .toLowerCase();

const guardianSchema = z.object({
  name: z.string().trim().min(2).max(100),

  relationship: z.enum([
    "FATHER",
    "MOTHER",
    "GUARDIAN",
  ]),

  phone: phoneSchema,

  alternatePhone: phoneSchema.optional(),

  email: emailSchema.optional(),

  occupation: z.string().trim().max(100).optional(),

  isPrimaryContact: z.boolean().default(false),
});

const addressSchema = z.object({
  addressLine1: z.string().trim().min(3).max(200),

  addressLine2: z.string().trim().max(200).optional(),

  city: z.string().trim().min(2).max(100),

  state: z.string().trim().min(2).max(100),

  country: z.string().trim().min(2).max(100).default("India"),

  postalCode: z.string().trim().min(4).max(12),
});

const admissionDocumentSchema = z.object({
  documentType: z.string().trim().min(2).max(50),

  documentName: z.string().trim().min(2).max(150),

  fileUrl: z.string().trim().url(),

  verified: z.boolean().optional().default(false),

  remarks: z.string().trim().max(500).optional(),
});

// CREATE ADMISSION APPLICATION
export const createAdmissionSchema = z
  .object({
    sessionId: objectIdSchema,
    enquiryId: objectIdSchema.optional(),
    source: z.string().trim().max(80).optional(),
    parentDeclaration: z.boolean().optional(),

    applicationNumber: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .transform((value) => value.toUpperCase()),

    firstName: z.string().trim().min(2).max(50),

    middleName: z.string().trim().max(50).optional(),

    lastName: z.string().trim().min(1).max(50),

    dateOfBirth: z.coerce.date().refine((value) => value <= new Date(), "Date of birth cannot be in the future"),

    gender: z.enum(["MALE", "FEMALE", "OTHER"]),

    bloodGroup: z
      .enum([
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ])
      .optional(),

    nationality: z.string().trim().max(50).default("Indian"),

    religion: z.string().trim().max(50).optional(),

    category: z.string().trim().max(50).optional(),

    motherTongue: z.string().trim().max(50).optional(),

    email: emailSchema.optional(),

    phone: phoneSchema.optional(),

    address: addressSchema,

    guardians: z.array(guardianSchema).min(1).max(5),

    appliedClassId: objectIdSchema,

    appliedSectionId: objectIdSchema.optional(),

    admissionDate: z.coerce.date().optional(),

    previousSchool: z.string().trim().max(150).optional(),

    previousClass: z.string().trim().max(50).optional(),

    previousBoard: z.string().trim().max(100).optional(),
    previousSchoolTcNumber: z.string().trim().max(100).optional(),

    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.guardians.filter(
        (guardian) => guardian.isPrimaryContact
      ).length <= 1,
    {
      message: "Only one guardian can be the primary contact",
      path: ["guardians"],
    }
  )
  .refine(
    (data) => data.dateOfBirth.getTime() <= Date.now(),
    {
      message: "Date of birth cannot be in the future",
      path: ["dateOfBirth"],
    }
  );

// UPDATE ADMISSION APPLICATION
export const updateAdmissionSchema = z
  .object({
    firstName: z.string().trim().min(2).max(50).optional(),

    middleName: z.string().trim().max(50).optional(),

    lastName: z.string().trim().min(1).max(50).optional(),

    dateOfBirth: z.coerce.date().refine((value) => value <= new Date(), "Date of birth cannot be in the future").optional(),

    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),

    bloodGroup: z
      .enum([
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ])
      .optional(),

    nationality: z.string().trim().max(50).optional(),

    religion: z.string().trim().max(50).optional(),

    category: z.string().trim().max(50).optional(),

    motherTongue: z.string().trim().max(50).optional(),

    email: emailSchema.optional(),

    phone: phoneSchema.optional(),

    address: addressSchema.partial().optional(),

    guardians: z.array(guardianSchema).min(1).max(5).optional(),

    appliedClassId: objectIdSchema.optional(),

    appliedSectionId: objectIdSchema.nullable().optional(),

    admissionDate: z.coerce.date().optional(),

    previousSchool: z.string().trim().max(150).optional(),

    previousClass: z.string().trim().max(50).optional(),

    previousBoard: z.string().trim().max(100).optional(),
    previousSchoolTcNumber: z.string().trim().max(100).optional(),

    remarks: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required for update",
    }
  );

// ADMISSION ID PARAMETER
export const admissionIdParamSchema = z.object({
  id: objectIdSchema,
});

// ADMISSION LIST FILTERS
export const admissionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  sessionId: objectIdSchema.optional(),

  appliedClassId: objectIdSchema.optional(),

  status: z
    .enum([
      "ENQUIRY","DRAFT","SUBMITTED","APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING","VERIFIED","APPROVED","WAITLISTED","REJECTED","WITHDRAWN","CANCELLED","CONVERTED","REGISTERED",
    ])
    .optional(),

  sortBy: z
    .enum(["createdAt", "fullName", "applicationDate", "applicationNumber"])
    .default("createdAt"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// REVIEW ADMISSION
export const reviewAdmissionSchema = z.object({
  reviewRemarks: z.string().trim().max(1000).optional(),

  documentsVerified: z.boolean().optional(),
});

// APPROVE ADMISSION
export const approveAdmissionSchema = z.object({
  admissionDate: z.coerce.date(),

  appliedClassId: objectIdSchema,

  appliedSectionId: objectIdSchema.optional(),

  reviewRemarks: z.string().trim().max(1000).optional(),
});

// REJECT ADMISSION
export const rejectAdmissionSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(5, "Rejection reason is required")
    .max(1000),
});

// CANCEL ADMISSION
export const cancelAdmissionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// EXPORT TYPES
export type CreateAdmissionInput = z.infer<
  typeof createAdmissionSchema
>;

export type UpdateAdmissionInput = z.infer<
  typeof updateAdmissionSchema
>;

export type AdmissionListQuery = z.infer<
  typeof admissionListQuerySchema
>;

export type ReviewAdmissionInput = z.infer<
  typeof reviewAdmissionSchema
>;

export type ApproveAdmissionInput = z.infer<
  typeof approveAdmissionSchema
>;

export type RejectAdmissionInput = z.infer<
  typeof rejectAdmissionSchema
>;

export type CancelAdmissionInput = z.infer<
  typeof cancelAdmissionSchema
>;

export const createAdmissionFollowUpSchema = z.object({
  note: z.string().trim().min(3).max(1000),
  outcome: z.string().trim().max(500).optional(),
  followUpDate: z.coerce.date().optional(),
  nextFollowUpDate: z.coerce.date().optional(),
}).refine((data) => !data.nextFollowUpDate || !data.followUpDate || data.nextFollowUpDate >= data.followUpDate, {
  message: "Next follow-up date cannot be before the follow-up date",
  path: ["nextFollowUpDate"],
});
export type CreateAdmissionFollowUpInput = z.infer<typeof createAdmissionFollowUpSchema>;

export const approveDecisionSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
}).strict();

const phoneRequiredSchema = z.string().trim().regex(/^[0-9]{10,15}$/, "Enter a valid 10–15 digit phone number");
export const createEnquirySchema = z.object({
 sessionId: objectIdSchema,
 childName: z.string().trim().min(2).max(150),
 dateOfBirth: z.coerce.date().refine(v=>v<=new Date(),"Date of birth cannot be in the future").optional(),
 classSought: objectIdSchema.optional(),
 parentName: z.string().trim().min(2).max(150),
 parentPhone: phoneRequiredSchema,
 source: z.string().trim().min(1).max(80).optional(),
 notes: z.string().trim().max(2000).optional(),
 assignedTo: objectIdSchema.optional(),
}).strict();
export const updateEnquirySchema = z.object({
 childName:z.string().trim().min(2).max(150).optional(),
 dateOfBirth:z.coerce.date().refine(v=>v<=new Date(),"Date of birth cannot be in the future").nullable().optional(),
 classSought:objectIdSchema.nullable().optional(),
 parentName:z.string().trim().min(2).max(150).optional(),
 parentPhone:phoneRequiredSchema.optional(),
 source:z.string().trim().min(1).max(80).optional(),
 notes:z.string().trim().max(2000).optional(),
 status:z.enum(["NEW","CONTACTED","INTERESTED","CLOSED"]).optional(),
 assignedTo:objectIdSchema.nullable().optional(),
}).strict();
export const createEnquiryFollowUpSchema = z.object({
 date:z.coerce.date(),
 time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
 notes:z.string().trim().min(2).max(1000),
 assignedTo:objectIdSchema.optional(),
}).strict();
export const updateEnquiryFollowUpSchema = z.object({
 date:z.coerce.date().optional(), time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
 notes:z.string().trim().min(2).max(1000).optional(),
 status:z.enum(["SCHEDULED","COMPLETED","CANCELLED"]).optional(),
 assignedTo:objectIdSchema.nullable().optional(),
}).strict();
export const transitionAdmissionStatusSchema = z.object({
 status:z.enum(["SUBMITTED","UNDER_REVIEW","VERIFIED","DOCUMENTS_PENDING","WAITLISTED","WITHDRAWN"]),
 remarks:z.string().trim().max(1000).optional(),
}).strict();
