
import { Router } from "express";

import {
  createStudent,
  getAllStudents as getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  downloadStudentIdCard,
} from "./students.controller";

import {
  createStudentSchema,
  getStudentsSchema,
  studentIdSchema,
  updateStudentSchema,
} from "./students.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

const router = Router();

// Authentication and tenant isolation
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Create student
router.post(
  "/",
  authorize(["SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"]),
  validate(createStudentSchema),
  createStudent
);

// Get all students
router.get(
  "/",
  authorize([
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
    "ACCOUNTANT",
    "RECEPTIONIST",
  ]),
  validate(getStudentsSchema),
  getStudents
);

// Get student by ID
router.get(
  "/:id",
  authorize([
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
    "ACCOUNTANT",
    "RECEPTIONIST",
  ]),
  validate(studentIdSchema),
  getStudentById
);

// Update student
router.patch(
  "/:id",
  authorize(["SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"]),
  validate(updateStudentSchema),
  updateStudent
);

// Download an individual student ID card.
router.get(
  "/:id/id-card",
  authorize(["SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST", "TEACHER"]),
  validate(studentIdSchema),
  downloadStudentIdCard
);

// Delete student
router.delete(
  "/:id",
  authorize(["SCHOOL_ADMIN", "PRINCIPAL"]),
  validate(studentIdSchema),
  deleteStudent
);

export default router;
