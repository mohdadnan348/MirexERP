
import { z } from "zod";

const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  "Invalid ID format"
);

const genderSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
]);

const statusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "GRADUATED",
  "WITHDRAWN",
  "SUSPENDED",
  "EXPELLED",
  "TC",
  "ALUMNI",
]);

const addressSchema = z.object({
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
}).strict();

const emergencyContactSchema = z.object({
  name: z.string().trim().optional(),
  relationship: z.string().trim().optional(),
  phone: z.string().trim().optional(),
}).strict();

const medicalInformationSchema = z.object({
  allergies: z.array(z.string().trim()).optional(),
  conditions: z.array(z.string().trim()).optional(),
  notes: z.string().trim().optional(),
}).strict();

const studentFields = {
  admissionNumber: z.string().trim().min(2).max(30),
  rollNumber: z.string().trim().max(30).optional(),

  firstName: z.string().trim().min(2).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),

  dateOfBirth: z.coerce.date().refine((d) => d <= new Date(), "Date of birth cannot be in the future"),
  gender: genderSchema,
  bloodGroup: z.string().trim().max(5).optional(),

  email: z.string().email().optional(),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, "Invalid phone number").optional(),
  profileImage: z.string().url().optional(),

  sessionId: objectIdSchema,
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  parentId: objectIdSchema.nullable().optional(),

  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  medicalInformation: medicalInformationSchema.optional(),

  admissionDate: z.coerce.date().optional(),
  previousSchool: z.string().trim().max(200).optional(),
};

// CREATE STUDENT
export const createStudentSchema = z.object({
  body: z.object(studentFields).strict(),
});

// UPDATE STUDENT
export const updateStudentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }).strict(),

  body: z.object({
    rollNumber: studentFields.rollNumber,

    firstName: studentFields.firstName.optional(),
    middleName: studentFields.middleName,
    lastName: studentFields.lastName.optional(),

    dateOfBirth: studentFields.dateOfBirth.optional(),
    gender: genderSchema.optional(),
    bloodGroup: studentFields.bloodGroup,

    email: studentFields.email,
    phone: studentFields.phone,
    profileImage: studentFields.profileImage,

    sessionId: objectIdSchema.optional(),
    classId: objectIdSchema.optional(),
    sectionId: objectIdSchema.optional(),
    parentId: objectIdSchema.nullable().optional(),

    address: addressSchema.optional(),
    emergencyContact: emergencyContactSchema.optional(),
    medicalInformation: medicalInformationSchema.optional(),

    admissionDate: z.coerce.date().optional(),
    previousSchool: studentFields.previousSchool,

    status: statusSchema.optional(),
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required for update",
    }
  ),
});

// STUDENT ID
export const studentIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }).strict(),
});

// GET STUDENTS
export const getStudentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).optional(),

    status: statusSchema.optional(),

    classId: objectIdSchema.optional(),

    sectionId: objectIdSchema.optional(),

    sessionId: objectIdSchema.optional(),

    gender: genderSchema.optional(),
  }).strict(),
});

// INFERRED TYPES
export type CreateStudentInput = z.infer<
  typeof createStudentSchema
>["body"];

export type UpdateStudentInput = z.infer<
  typeof updateStudentSchema
>["body"];

export type GetStudentsQuery = z.infer<
  typeof getStudentsSchema
>["query"];
