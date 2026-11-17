import { requireSubscriptionFeature } from "../subscriptions/subscription-entitlement.middleware";

import { Router } from "express";

import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryStock,
  issueInventoryItem,
  returnInventoryItem,
  getInventoryTransactions,
} from "./inventory.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryItemIdSchema,
  getInventoryItemsSchema,
  adjustInventoryStockSchema,
  issueInventoryItemSchema,
  returnInventoryItemSchema,
  getInventoryTransactionsSchema,
} from "./inventory.validation";

import { USER_ROLES } from "../../config/constants";

const router = Router();

const inventoryManagers = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.TRANSPORT_MANAGER,
  USER_ROLES.INVENTORY_MANAGER,
];

const inventoryViewers = [
  ...inventoryManagers,
  USER_ROLES.TEACHER,
  USER_ROLES.ACCOUNTANT,
  USER_ROLES.RECEPTIONIST,
  USER_ROLES.LIBRARIAN,
];

// All inventory routes require authentication and school context.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);
router.use(requireSubscriptionFeature("INVENTORY"));

// Inventory items
router.post(
  "/",
  authorize(...inventoryManagers),
  validate(createInventoryItemSchema),
  createInventoryItem
);

router.get(
  "/",
  authorize(...inventoryViewers),
  validate(getInventoryItemsSchema),
  getInventoryItems
);

router.get(
  "/:id",
  authorize(...inventoryViewers),
  validate(inventoryItemIdSchema),
  getInventoryItemById
);

router.patch(
  "/:id",
  authorize(...inventoryManagers),
  validate(updateInventoryItemSchema),
  updateInventoryItem
);

router.delete(
  "/:id",
  authorize(...inventoryManagers),
  validate(inventoryItemIdSchema),
  deleteInventoryItem
);

// Stock management
router.post(
  "/:id/adjust-stock",
  authorize(...inventoryManagers),
  validate(adjustInventoryStockSchema),
  adjustInventoryStock
);

// Issue and return
router.post(
  "/:id/issue",
  authorize(...inventoryManagers),
  validate(issueInventoryItemSchema),
  issueInventoryItem
);

router.post(
  "/:id/return",
  authorize(...inventoryManagers),
  validate(returnInventoryItemSchema),
  returnInventoryItem
);

// Inventory transaction history
router.get(
  "/:id/transactions",
  authorize(...inventoryViewers),
  validate(getInventoryTransactionsSchema),
  getInventoryTransactions
);

export default router;
