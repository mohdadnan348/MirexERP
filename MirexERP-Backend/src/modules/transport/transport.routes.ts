import { requireSubscriptionFeature } from "../subscriptions/subscription-entitlement.middleware";

import { Router } from "express";

import {
  createTransport,
  getTransports,
  getTransportById,
  updateTransport,
  deleteTransport,
  assignStudentTransport,
  removeStudentTransport,
  getStudentTransport,
} from "./transport.controller";

import {
  createTransportSchema,
  updateTransportSchema,
  transportIdSchema,
  getTransportsSchema,
  assignStudentTransportSchema,
  removeStudentTransportSchema,
  getStudentTransportSchema,
} from "./transport.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

const router = Router();

const {
  SCHOOL_ADMIN,
  PRINCIPAL,
  TRANSPORT_MANAGER,
} = USER_ROLES;

// Authentication and school tenant context.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);
router.use(requireSubscriptionFeature("TRANSPORT"));

const transportManagers = [
  SCHOOL_ADMIN,
  PRINCIPAL,
  TRANSPORT_MANAGER,
];

const transportViewers = [
  SCHOOL_ADMIN,
  PRINCIPAL,
  TRANSPORT_MANAGER,
  "TEACHER",
];

// Create transport.
router.post(
  "/",
  authorize(...transportManagers),
  validate(createTransportSchema),
  createTransport
);

// Get all transport records.
router.get(
  "/",
  authorize(...transportViewers),
  validate(getTransportsSchema),
  getTransports
);

// Blueprint-compatible resource aliases must precede the /:id catch-all.
router.get("/vehicles", authorize(...transportViewers), getTransports);
router.get("/routes", authorize(...transportViewers), getTransports);

// Get student's transport details.
// Keep this route before /:id.
router.get(
  "/student/:studentId",
  authorize(...transportViewers),
  validate(getStudentTransportSchema),
  getStudentTransport
);

// Assign transport to student.
router.post(
  "/:id/assign",
  authorize(...transportManagers),
  validate(assignStudentTransportSchema),
  assignStudentTransport
);

// Remove student's transport assignment.
router.delete(
  "/:id/assign/:studentId",
  authorize(...transportManagers),
  validate(removeStudentTransportSchema),
  removeStudentTransport
);

// Get transport details by ID.
router.get(
  "/:id",
  authorize(...transportViewers),
  validate(transportIdSchema),
  getTransportById
);

// Update transport.
router.patch(
  "/:id",
  authorize(...transportManagers),
  validate(updateTransportSchema),
  updateTransport
);

// Delete transport.
router.delete(
  "/:id",
  authorize(...transportManagers),
  validate(transportIdSchema),
  deleteTransport
);

export default router;
