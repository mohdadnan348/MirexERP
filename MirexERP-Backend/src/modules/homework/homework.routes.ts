import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { USER_ROLES } from "../../config/constants";
import {
  createHomework, getHomeworks, getHomeworkById, updateHomework, deleteHomework,
  submitHomework, getHomeworkSubmissions, reviewHomeworkSubmission, publishHomework,
  archiveHomework, getPendingHomework, getHomeworkSummary, getClassWiseReport,
  getSubjectWiseReport, getLateSubmissions, getMySubmissions, sendPendingReminders,
  downloadHomeworkFile, getSubmissionHistory, getEvaluationReport,
} from "./homework.controller";
import {
  createHomeworkSchema, updateHomeworkSchema, idSchema, listHomeworkSchema,
  submissionsQuerySchema, submitHomeworkSchema, evaluateSubmissionSchema,
  remindersSchema, fileSchema,
} from "./homework.validation";
import { normalizeHomeworkMultipart, uploadHomeworkFiles, validateHomeworkRequest } from "./homework.upload";

const router = Router();
const { SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, STUDENT, PARENT } = USER_ROLES;
const managers = [SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER] as const;
const homeworkReaders = [SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, STUDENT, PARENT] as const;

router.use(authenticate, tenantContext, requireTenant);

// Named routes must precede /:id.
router.get("/submissions/:submissionId/history", authorize(...homeworkReaders), getSubmissionHistory);
router.get("/my-submissions", authorize(STUDENT, PARENT), getMySubmissions);
router.get("/student", authorize(STUDENT), validate(listHomeworkSchema), getHomeworks);
router.get("/parent", authorize(PARENT), validate(listHomeworkSchema), getHomeworks);
router.get("/reports/summary", authorize(...managers), validate(listHomeworkSchema), getHomeworkSummary);
router.get("/reports/class-wise", authorize(...managers), validate(listHomeworkSchema), getClassWiseReport);
router.get("/reports/subject-wise", authorize(...managers), validate(listHomeworkSchema), getSubjectWiseReport);
router.get("/reports/late-submissions", authorize(...managers), validate(listHomeworkSchema), getLateSubmissions);
router.get("/reports/evaluations", authorize(...managers), validate(listHomeworkSchema), getEvaluationReport);
router.post("/reminders/send", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), validate(remindersSchema), sendPendingReminders);
router.get("/files/:filename", authorize(...homeworkReaders), validate(fileSchema), downloadHomeworkFile);

// Create and list.
router.post("/", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), uploadHomeworkFiles, normalizeHomeworkMultipart, validateHomeworkRequest(createHomeworkSchema), createHomework);
router.get("/", authorize(...homeworkReaders), validate(listHomeworkSchema), getHomeworks);

// Submission and evaluation.
router.post("/:id/submit", authorize(STUDENT, PARENT), uploadHomeworkFiles, normalizeHomeworkMultipart, validateHomeworkRequest(submitHomeworkSchema), submitHomework);
router.post("/:id/submissions", authorize(STUDENT, PARENT), uploadHomeworkFiles, normalizeHomeworkMultipart, validateHomeworkRequest(submitHomeworkSchema), submitHomework);
router.get("/:id/submissions", authorize(...managers), validate(submissionsQuerySchema), getHomeworkSubmissions);
router.patch("/:id/submissions/:submissionId/evaluate", authorize(...managers), validate(evaluateSubmissionSchema), reviewHomeworkSubmission);
router.patch("/:id/submissions/:submissionId", authorize(...managers), validate(evaluateSubmissionSchema), reviewHomeworkSubmission);
router.get("/:id/pending", authorize(...managers), validate(idSchema), getPendingHomework);

// Lifecycle and detail.
router.patch("/:id/publish", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), validate(idSchema), publishHomework);
router.patch("/:id/archive", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), validate(idSchema), archiveHomework);
router.get("/:id", authorize(...homeworkReaders), validate(idSchema), getHomeworkById);
router.patch("/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), uploadHomeworkFiles, normalizeHomeworkMultipart, validateHomeworkRequest(updateHomeworkSchema), updateHomework);
router.delete("/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER), validate(idSchema), deleteHomework);

export default router;
