import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { schoolDocumentUploader, schoolLogoUploader } from "../../utils/fileStorage";
import {
  getOwnSchool, updateOwnSchool, updateOwnBranding, uploadSchoolLogo, getSchoolLogo,
  listBranches, createBranch, updateBranch, deleteBranch,
  uploadSchoolDocument, replaceSchoolDocument, listSchoolDocuments, downloadSchoolDocument, deleteSchoolDocument,
} from "./school-management.controller";
import { createBranchSchema, updateBranchSchema, branchIdSchema, documentMetaSchema, schoolBrandingSchema, schoolProfileUpdateSchema } from "./school-management.validation";

const router = Router();
router.use(authenticate, tenantContext, requireTenant);
const readers = authorize("SCHOOL_ADMIN", "PRINCIPAL");
const writers = authorize("SCHOOL_ADMIN");
router.get("/profile", readers, getOwnSchool);
router.patch("/profile", writers, validate(schoolProfileUpdateSchema), updateOwnSchool);
router.patch("/branding", writers, validate(schoolBrandingSchema), updateOwnBranding);
router.post("/branding/logo", writers, schoolLogoUploader.single("file"), uploadSchoolLogo);
router.get("/logo", getSchoolLogo);

router.get("/branches", readers, listBranches);
router.post("/branches", writers, validate(createBranchSchema), createBranch);
router.patch("/branches/:id", writers, validate(updateBranchSchema), updateBranch);
router.delete("/branches/:id", writers, validate(branchIdSchema), deleteBranch);

router.get("/documents", readers, listSchoolDocuments);
router.put("/documents/:id", writers, validate(branchIdSchema), schoolDocumentUploader.single("file"), replaceSchoolDocument);
router.post("/documents", writers, schoolDocumentUploader.single("file"), validate(documentMetaSchema), uploadSchoolDocument);
router.get("/documents/:id/download", readers, validate(branchIdSchema), downloadSchoolDocument);
router.delete("/documents/:id", writers, validate(branchIdSchema), deleteSchoolDocument);

export default router;
