import { requireSubscriptionFeature } from "../subscriptions/subscription-entitlement.middleware";
import { Router } from "express";
import * as advanced from "./communication-advanced.controller";

import * as controller from "./communication.controller";
import { authenticate } from "../../middleware/authenticate";
import { tenantContext } from "../../middleware/tenantContext";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { USER_ROLES } from "../../config/constants";
import {
  createSchema,
  idSchema,
  listSchema,
  settingsSchema,
  updateSchema,
} from "./communication.validation";

export const communicationRouter = Router();

communicationRouter.use(authenticate, tenantContext);
communicationRouter.use(requireSubscriptionFeature("COMMUNICATION"));

const communicationReaders = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ACCOUNTANT,
  USER_ROLES.RECEPTIONIST,
  USER_ROLES.LIBRARIAN,
  USER_ROLES.TRANSPORT_MANAGER,
  USER_ROLES.TEACHER,
  USER_ROLES.PARENT,
  USER_ROLES.STUDENT,
];
const communicationWriters = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.TEACHER,
];
const communicationAdmins = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
];

communicationRouter.get(
  "/",
  authorize(...communicationReaders),
  validate(listSchema),
  controller.list
);

communicationRouter.post(
  "/",
  authorize(...communicationWriters),
  validate(createSchema),
  controller.create
);

communicationRouter.get(
  "/settings",
  authorize(...communicationReaders),
  controller.getSettings
);

communicationRouter.patch(
  "/settings",
  authorize(...communicationWriters),
  validate(settingsSchema),
  controller.updateSettings
);

// Extended communication operations: dashboard, templates, campaigns and personal preferences.
communicationRouter.get("/dashboard", authorize(...communicationReaders), advanced.dashboard);
communicationRouter.get("/templates", authorize(...communicationWriters), advanced.listTemplates);
communicationRouter.post("/templates", authorize(...communicationAdmins), advanced.createTemplate);
communicationRouter.patch("/templates/:id", authorize(...communicationAdmins), advanced.updateTemplate);
communicationRouter.get("/campaigns", authorize(...communicationWriters), advanced.listCampaigns);
communicationRouter.post("/campaigns", authorize(...communicationWriters), advanced.createCampaign);
communicationRouter.post("/campaigns/:id/cancel", authorize(...communicationAdmins), advanced.cancelCampaign);
communicationRouter.get("/preferences/me", advanced.getPreferences);
communicationRouter.patch("/preferences/me", advanced.savePreferences);

communicationRouter.get(
  "/:id/history",
  authorize(...communicationReaders),
  validate(idSchema),
  controller.history
);

communicationRouter.post(
  "/:id/publish",
  authorize(...communicationAdmins),
  validate(idSchema),
  controller.publish
);

communicationRouter.post(
  "/:id/archive",
  authorize(...communicationWriters),
  validate(idSchema),
  controller.archive
);

communicationRouter.patch(
  "/:id",
  authorize(...communicationWriters),
  validate(updateSchema),
  controller.update
);

communicationRouter.get(
  "/:id",
  authorize(...communicationReaders),
  validate(idSchema),
  controller.getById
);

communicationRouter.delete(
  "/:id",
  authorize(...communicationAdmins),
  validate(idSchema),
  controller.remove
);

export default communicationRouter;
