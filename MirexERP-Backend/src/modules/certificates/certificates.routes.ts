
import { Router } from "express";
import * as advanced from "./certificate-advanced.controller";

import { USER_ROLES } from "../../config/constants";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  createCertificate,
  deleteCertificate,
  getCertificateById,
  getCertificates,
  getStudentCertificates,
  downloadCertificatePdf,
  updateCertificate,
} from "./certificates.controller";

import {
  createCertificateSchema,
  certificateIdSchema,
  getCertificatesSchema,
  getStudentCertificatesSchema,
  updateCertificateSchema,
} from "./certificates.validation";

const router = Router();

const certificateManagementRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
];

const certificateReadRoles = [
  ...certificateManagementRoles,
  USER_ROLES.ACCOUNTANT,
  USER_ROLES.RECEPTIONIST,
];

router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Approval, templates, document vault and verification operations.
router.get("/templates", authorize(...certificateManagementRoles), advanced.listTemplates);
router.post("/templates", authorize(...certificateManagementRoles), advanced.createTemplate);
router.post("/:id/submit", authorize(...certificateManagementRoles), advanced.submitApproval);
router.post("/:id/approve", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), advanced.approveCertificate);
router.post("/:id/reject", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), advanced.rejectCertificate);
router.post("/:id/issue", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), advanced.issueCertificate);
router.get("/verify/:code", advanced.verificationLookup);
router.post("/documents/upload", authorize(...certificateManagementRoles), advanced.certificateDocumentUploader.single("file"), advanced.uploadDocument);
router.get("/documents", authorize(...certificateReadRoles), advanced.listDocuments);
router.patch("/documents/:id/verify", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), advanced.verifyDocument);
router.get("/documents/:id/download", authorize(...certificateReadRoles), advanced.documentDownload);

// Create certificate
router.post(
  "/",
  authorize(...certificateManagementRoles),
  validate(createCertificateSchema),
  createCertificate
);

// Get all certificates
router.get(
  "/",
  authorize(...certificateReadRoles),
  validate(getCertificatesSchema),
  getCertificates
);

// Get certificates of a student
router.get(
  "/student/:studentId",
  authorize(...certificateReadRoles),
  validate(getStudentCertificatesSchema),
  getStudentCertificates
);

// Download generated certificate PDF
router.get(
  "/:id/pdf",
  authorize(...certificateReadRoles),
  validate(certificateIdSchema),
  downloadCertificatePdf
);

// Get certificate by ID
router.get(
  "/:id",
  authorize(...certificateReadRoles),
  validate(certificateIdSchema),
  getCertificateById
);

// Update certificate
router.patch(
  "/:id",
  authorize(...certificateManagementRoles),
  validate(updateCertificateSchema),
  updateCertificate
);

// Delete certificate
router.delete(
  "/:id",
  authorize(...certificateManagementRoles),
  validate(certificateIdSchema),
  deleteCertificate
);

export default router;
