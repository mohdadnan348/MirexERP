
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const employeeTypes = [
  "TEACHING",
  "NON_TEACHING",
  "ADMINISTRATIVE",
  "SUPPORT",
  "OTHER",
] as const;

const employmentTypes = [
  "PERMANENT",
  "CONTRACT",
  "PART_TIME",
  "TEMPORARY",
  "SUBSTITUTE",
] as const;

const employeeStatuses = [
  "ACTIVE",
  "INACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
] as const;

const genderTypes = [
  "MALE",
  "FEMALE",
  "OTHER",
] as const;

const bloodGroups = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is too short")
  .max(20, "Phone number cannot exceed 20 characters")
  .regex(/^[+0-9()\-\s]+$/, "Invalid phone number");

const optionalPhoneSchema = phoneSchema.optional();

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .max(150)
  .transform((value) => value.toLowerCase())
  .optional();

const salarySchema = z
  .object({
    basic: z.number().min(0),
    hra: z.number().min(0).default(0),
    allowances: z.number().min(0).default(0),
    deductions: z.number().min(0).default(0),
    currency: z
      .string()
      .trim()
      .length(3)
      .default("INR"),
  })
  .refine(
    (salary) =>
      salary.basic + salary.hra + salary.allowances >= salary.deductions,
    {
      message: "Deductions cannot exceed gross salary",
      path: ["deductions"],
    }
  );

const addressSchema = z.object({
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(15).optional(),
  country: z.string().trim().max(100).default("India"),
});

const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relationship: z.string().trim().min(1).max(50),
  phone: phoneSchema,
});

const employeeDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(100),
  documentNumber: z.string().trim().max(100).optional(),
  fileUrl: z.string().trim().url("Invalid document URL"),
  uploadedAt: z.coerce.date().optional(),
});

// Create employee
export const createEmployeeSchema = z.object({
  employeeId: z.string().trim().max(30).optional(),

  userId: objectIdSchema.nullable().optional(),

  firstName: z.string().trim().min(1).max(50),

  middleName: z.string().trim().max(50).optional(),

  lastName: z.string().trim().min(1).max(50),

  email: emailSchema,

  phone: phoneSchema,

  alternatePhone: optionalPhoneSchema,

  dateOfBirth: z.coerce.date().optional(),

  gender: z.enum(genderTypes),

  bloodGroup: z.enum(bloodGroups).optional(),

  employeeType: z.enum(employeeTypes),

  designation: z.string().trim().min(1).max(100),

  department: z.string().trim().max(100).optional(),

  employmentType: z
    .enum(employmentTypes)
    .default("PERMANENT"),

  qualification: z.string().trim().max(200).optional(),

  specialization: z.string().trim().max(150).optional(),

  experienceYears: z
    .number()
    .min(0)
    .max(60)
    .default(0),

  joiningDate: z.coerce.date(),

  confirmationDate: z.coerce.date().optional(),

  salary: salarySchema.optional(),

  address: addressSchema.optional(),

  emergencyContact: emergencyContactSchema.optional(),

  remarks: z.string().trim().max(1000).optional(),
 panNumber: z.string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"))
  .optional(),
  workEmail: emailSchema,
  workMobile: optionalPhoneSchema,
});

// Update employee
export const updateEmployeeSchema = z
  .object({
    userId: objectIdSchema.nullable().optional(),

    firstName: z.string().trim().min(1).max(50).optional(),

    middleName: z.string().trim().max(50).nullable().optional(),

    lastName: z.string().trim().min(1).max(50).optional(),

    email: emailSchema.nullable().optional(),
    panNumber: z.string()
      .trim()
      .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
      .pipe(z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"))
      .optional(),
    workEmail: emailSchema,
    workMobile: optionalPhoneSchema,

    phone: phoneSchema.optional(),

    alternatePhone: phoneSchema.nullable().optional(),

    dateOfBirth: z.coerce.date().nullable().optional(),

    gender: z.enum(genderTypes).optional(),

    bloodGroup: z.enum(bloodGroups).nullable().optional(),

    employeeType: z.enum(employeeTypes).optional(),

    designation: z.string().trim().min(1).max(100).optional(),

    department: z.string().trim().max(100).nullable().optional(),

    employmentType: z.enum(employmentTypes).optional(),

    qualification: z.string().trim().max(200).nullable().optional(),

    specialization: z.string().trim().max(150).nullable().optional(),

    experienceYears: z.number().min(0).max(60).optional(),

    joiningDate: z.coerce.date().optional(),

    confirmationDate: z.coerce.date().nullable().optional(),



    address: addressSchema.nullable().optional(),

    emergencyContact: emergencyContactSchema.nullable().optional(),




    remarks: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

// Employee ID parameter
export const employeeIdParamSchema = z.object({
  id: objectIdSchema,
});

// Employee listing filters
export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  employeeType: z.enum(employeeTypes).optional(),

  employmentType: z.enum(employmentTypes).optional(),

  designation: z.string().trim().max(100).optional(),

  department: z.string().trim().max(100).optional(),

  status: z.enum(employeeStatuses).optional(),

  gender: z.enum(genderTypes).optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  joiningDateFrom: z.coerce.date().optional(),

  joiningDateTo: z.coerce.date().optional(),

  sortBy: z
    .enum(["firstName", "employeeId", "joiningDate", "createdAt"])
    .default("createdAt"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).refine(
  (data) =>
    !data.joiningDateFrom ||
    !data.joiningDateTo ||
    data.joiningDateFrom <= data.joiningDateTo,
  {
    message: "Joining date range is invalid",
    path: ["joiningDateTo"],
  }
);

// Update employee status
export const updateEmployeeStatusSchema = z.object({
  status: z.enum(employeeStatuses),
});

// Assign user account
export const assignEmployeeUserSchema = z.object({
  userId: objectIdSchema.nullable(),
});

// Employee ID lookup
export const employeeIdQuerySchema = z.object({
  employeeId: z.string().trim().min(1).max(30),
});

// Inferred TypeScript types
export type CreateEmployeeInput = z.infer<
  typeof createEmployeeSchema
>;

export type UpdateEmployeeInput = z.infer<
  typeof updateEmployeeSchema
>;

export type EmployeeListQuery = z.infer<
  typeof employeeListQuerySchema
>;

export type UpdateEmployeeStatusInput = z.infer<
  typeof updateEmployeeStatusSchema
>;

export type AssignEmployeeUserInput = z.infer<
  typeof assignEmployeeUserSchema
>;

export type EmployeeIdQuery = z.infer<
  typeof employeeIdQuerySchema
>;
