import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { USER_ROLES } from "../../config/constants";
import {
  listPlans, createPlan, updatePlan, deletePlan, platformRevenue, platformOverview,
  listPlatformUsers, updatePlatformUser, deactivatePlatformUser,
  listRoles, createRole, updateRolePermissions, deleteRole,
  listSupportTickets, createSupportTicket, updateSupportTicket,
  getPlatformSettings, updatePlatformSettings, listAuditLogs,
} from "./platform.controller";

const router = Router();
router.use(authenticate, authorize(USER_ROLES.SUPER_ADMIN));

router.get("/plans", listPlans);
router.post("/plans", createPlan);
router.patch("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);

router.get("/overview", platformOverview);
router.get("/revenue", platformRevenue);
router.get("/users", listPlatformUsers);
router.patch("/users/:id", updatePlatformUser);
router.delete("/users/:id", deactivatePlatformUser);

router.get("/roles", listRoles);
router.post("/roles", createRole);
router.put("/roles/:id/permissions", updateRolePermissions);
router.delete("/roles/:id", deleteRole);

router.get("/support-tickets", listSupportTickets);
router.post("/support-tickets", createSupportTicket);
router.patch("/support-tickets/:id", updateSupportTicket);

router.get("/settings", getPlatformSettings);
router.patch("/settings", updatePlatformSettings);

router.get("/audit-logs", listAuditLogs);

export default router;
