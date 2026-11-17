
import { Types, type FilterQuery } from "mongoose";
import { AppError } from "../../utils/AppError";

import {
  InventoryItem,
  InventoryTransaction,
  INVENTORY_ITEM_STATUS,
  INVENTORY_TRANSACTION_TYPE,
  INVENTORY_ITEM_CONDITION,
  type IInventoryItem,
  type IInventoryTransaction,
  type InventoryItemCondition,
} from "./inventory.model";
import { syncInventoryLowStockAlert } from "./inventory-alerts.service";

interface InventoryActor {
  userId: string;
  schoolId: string;
  role: string;
  employeeId?: string;
}

interface PaginationInput {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: string;
  lowStock?: boolean;
}

interface TransactionPaginationInput {
  page: number;
  limit: number;
  type?: string;
}

interface InventoryItemInput {
  name: string;
  itemCode: string;
  category: string;
  description?: string;
  unit?: string;
  quantity?: number;
  minimumStockLevel?: number;
  unitPrice?: number;
  supplierName?: string;
  supplierContact?: string;
  storageLocation?: string;
  purchaseDate?: string | Date;
  warrantyExpiry?: string | Date;
  condition?: string;
}

interface StockAdjustmentInput {
  quantity: number;
  operation: "ADD" | "REMOVE";
  reason: string;
  idempotencyKey?: string;
  notes?: string;
}

interface IssueInventoryInput {
  quantity: number;
  issuedTo?: string;
  issuedToName?: string;
  issuedToRole?: string;
  expectedReturnDate?: string | Date;
  reason?: string;
  idempotencyKey?: string;
  notes?: string;
}

interface ReturnInventoryInput {
  quantity: number;
  condition?: string;
  idempotencyKey?: string;
  notes?: string;
}

const getSchoolId = (actor: InventoryActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Invalid school context", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getUserId = (actor: InventoryActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Invalid user context", 400);
  }

  return new Types.ObjectId(actor.userId);
};

const validatePositiveNumber = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(`${field} must be greater than zero`, 400);
  }
};

const getInventoryItem = async (
  itemId: string,
  actor: InventoryActor
): Promise<IInventoryItem> => {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AppError("Invalid inventory item ID", 400);
  }

  const item = await InventoryItem.findOne({
    _id: itemId,
    schoolId: getSchoolId(actor),
    isDeleted: false,
  });

  if (!item) {
    throw new AppError("Inventory item not found", 404);
  }

  return item;
};

const createTransaction = async (
  data: Partial<IInventoryTransaction>
) => {
  return InventoryTransaction.create(data);
};

// Create inventory item
export const createInventoryItemService = async (
  input: InventoryItemInput,
  actor: InventoryActor
) => {
  if (!input.name?.trim()) {
    throw new AppError("Item name is required", 400);
  }

  if (!input.itemCode?.trim()) {
    throw new AppError("Item code is required", 400);
  }

  const schoolId = getSchoolId(actor);

  const existingItem = await InventoryItem.findOne({
    schoolId,
    itemCode: input.itemCode.trim().toUpperCase(),
    isDeleted: false,
  });

  if (existingItem) {
    throw new AppError("Inventory item code already exists", 409);
  }

  const quantity = input.quantity ?? 0;
  const unitPrice = input.unitPrice ?? 0;

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new AppError("Quantity cannot be negative", 400);
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new AppError("Unit price cannot be negative", 400);
  }

  const item = await InventoryItem.create({
    ...input,
    schoolId,
    itemCode: input.itemCode.trim().toUpperCase(),
    quantity,
    availableQuantity: quantity,
    minimumStockLevel: input.minimumStockLevel ?? 0,
    unitPrice,
    createdBy: getUserId(actor),
  });

  if (quantity > 0) {
    try {
      await createTransaction({
        schoolId, inventoryItemId: item._id, transactionType: INVENTORY_TRANSACTION_TYPE.PURCHASE,
        quantity, previousQuantity: 0, newQuantity: quantity, previousAvailableQuantity: 0,
        newAvailableQuantity: quantity, unitPrice, totalAmount: quantity * unitPrice,
        reason: "Opening inventory stock", performedBy: getUserId(actor),
      });
    } catch (error) {
      await InventoryItem.deleteOne({ _id: item._id, schoolId });
      throw error;
    }
  }
  await syncInventoryLowStockAlert(item, { schoolId: actor.schoolId, userId: actor.userId });
  return item;
};

// Get inventory items
export const getInventoryItemsService = async (
  filters: PaginationInput,
  actor: InventoryActor
) => {
  const { page, limit, search, category, status, lowStock } = filters;

  const query: FilterQuery<IInventoryItem> = {
    schoolId: getSchoolId(actor),
    isDeleted: false,
  };

  if (search?.trim()) {
    query.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { itemCode: { $regex: search.trim(), $options: "i" } },
      { category: { $regex: search.trim(), $options: "i" } },
    ];
  }

  if (category) query.category = category;

  if (status) query.status = status;

  if (lowStock) {
    query.$expr = {
      $lte: ["$availableQuantity", "$minimumStockLevel"],
    };
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    InventoryItem.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    InventoryItem.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1 && total > 0,
    },
  };
};

// Get inventory item by ID
export const getInventoryItemByIdService = async (
  itemId: string,
  actor: InventoryActor
) => {
  const item = await InventoryItem.findOne({
    _id: itemId,
    schoolId: getSchoolId(actor),
    isDeleted: false,
  }).populate("createdBy updatedBy", "name email");

  if (!item) {
    throw new AppError("Inventory item not found", 404);
  }

  return item;
};

// Update inventory item
export const updateInventoryItemService = async (
  itemId: string,
  input: Partial<InventoryItemInput>,
  actor: InventoryActor
) => {
  const item = await getInventoryItem(itemId, actor);

  if (input.itemCode) {
    const duplicate = await InventoryItem.findOne({
      _id: { $ne: item._id },
      schoolId: getSchoolId(actor),
      itemCode: input.itemCode.trim().toUpperCase(),
      isDeleted: false,
    });

    if (duplicate) {
      throw new AppError("Inventory item code already exists", 409);
    }
  }

  // Stock must be changed through stock adjustment or purchase.
  const {
    quantity,
    ...allowedUpdates
  } = input;

  Object.assign(item, allowedUpdates);

  if (input.itemCode) {
    item.itemCode = input.itemCode.trim().toUpperCase();
  }

  item.updatedBy = getUserId(actor);

  await item.save();

  return item;
};

// Delete inventory item
export const deleteInventoryItemService = async (
  itemId: string,
  actor: InventoryActor
) => {
  const item = await getInventoryItem(itemId, actor);

  if (item.quantity !== item.availableQuantity) {
    throw new AppError(
      "Cannot delete an item with currently issued stock",
      409
    );
  }

  item.isDeleted = true;
  item.status = INVENTORY_ITEM_STATUS.INACTIVE;
  item.updatedBy = getUserId(actor);

  await item.save();

  return { id: item._id };
};

// Adjust inventory stock
export const adjustInventoryStockService = async (
  itemId: string,
  input: StockAdjustmentInput,
  actor: InventoryActor
) => {
  validatePositiveNumber(input.quantity, "Adjustment quantity");
  if (!["ADD", "REMOVE"].includes(input.operation)) throw new AppError("Operation must be ADD or REMOVE", 400);
  if (!input.reason?.trim()) throw new AppError("Stock adjustment reason is required", 400);
  if (!input.idempotencyKey?.trim()) throw new AppError("Idempotency key is required", 400);
  const schoolId = getSchoolId(actor);
  if (input.idempotencyKey) {
    const prior = await InventoryTransaction.findOne({ schoolId, idempotencyKey: input.idempotencyKey });
    if (prior) {
      if (String(prior.inventoryItemId) !== itemId || prior.transactionType !== INVENTORY_TRANSACTION_TYPE.ADJUSTMENT) throw new AppError("Idempotency key is already used by another stock movement", 409);
      return { item: await getInventoryItem(itemId, actor), transaction: prior };
    }
  }
  const item = await getInventoryItem(itemId, actor);
  const previousQuantity = item.quantity;
  const previousAvailable = item.availableQuantity;
  const delta = input.operation === "ADD" ? input.quantity : -input.quantity;
  const updated = await InventoryItem.findOneAndUpdate(
    { _id: item._id, schoolId, isDeleted: false, ...(delta < 0 ? { quantity: { $gte: input.quantity }, availableQuantity: { $gte: input.quantity } } : {}) },
    { $inc: { quantity: delta, availableQuantity: delta }, $set: { updatedBy: getUserId(actor) } },
    { new: true }
  );
  if (!updated) throw new AppError("Insufficient available stock", 409);
  try {
    const transaction = await createTransaction({
      schoolId, inventoryItemId: item._id, transactionType: INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
      quantity: input.quantity, previousQuantity, newQuantity: updated.quantity,
      previousAvailableQuantity: previousAvailable, newAvailableQuantity: updated.availableQuantity,
      reason: input.reason, idempotencyKey: input.idempotencyKey, notes: input.notes, performedBy: getUserId(actor),
    });
    await syncInventoryLowStockAlert(updated, { schoolId: actor.schoolId, userId: actor.userId });
    return { item: updated, transaction };
  } catch (error) {
    await InventoryItem.updateOne({ _id: item._id, schoolId }, { $inc: { quantity: -delta, availableQuantity: -delta } });
    throw error;
  }
};

// Issue inventory item
export const issueInventoryItemService = async (
  itemId: string,
  input: IssueInventoryInput,
  actor: InventoryActor
) => {
  validatePositiveNumber(input.quantity, "Issue quantity");
  if (!input.idempotencyKey?.trim()) throw new AppError("Idempotency key is required", 400);
  const schoolId = getSchoolId(actor);
  if (input.idempotencyKey) {
    const prior = await InventoryTransaction.findOne({ schoolId, idempotencyKey: input.idempotencyKey });
    if (prior) {
      if (String(prior.inventoryItemId) !== itemId || prior.transactionType !== INVENTORY_TRANSACTION_TYPE.ISSUE) throw new AppError("Idempotency key is already used by another stock movement", 409);
      return { item: await getInventoryItem(itemId, actor), transaction: prior };
    }
  }
  const item = await getInventoryItem(itemId, actor);
  const previousAvailable = item.availableQuantity;
  const updated = await InventoryItem.findOneAndUpdate(
    { _id: item._id, schoolId, isDeleted: false, availableQuantity: { $gte: input.quantity } },
    { $inc: { availableQuantity: -input.quantity }, $set: { updatedBy: getUserId(actor) } },
    { new: true }
  );
  if (!updated) throw new AppError("Insufficient available stock", 409);
  try {
    const transaction = await createTransaction({
      schoolId, inventoryItemId: item._id, transactionType: INVENTORY_TRANSACTION_TYPE.ISSUE,
      quantity: input.quantity, previousQuantity: item.quantity, newQuantity: updated.quantity,
      previousAvailableQuantity: previousAvailable, newAvailableQuantity: updated.availableQuantity,
      issuedTo: input.issuedTo && Types.ObjectId.isValid(input.issuedTo) ? new Types.ObjectId(input.issuedTo) : undefined,
      issuedToName: input.issuedToName, issuedToRole: input.issuedToRole, issueDate: new Date(),
      expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : undefined,
      reason: input.reason, idempotencyKey: input.idempotencyKey, notes: input.notes, performedBy: getUserId(actor),
    });
    await syncInventoryLowStockAlert(updated, { schoolId: actor.schoolId, userId: actor.userId });
    return { item: updated, transaction };
  } catch (error) {
    await InventoryItem.updateOne({ _id: item._id, schoolId }, { $inc: { availableQuantity: input.quantity } });
    throw error;
  }
};

// Return issued inventory item
export const returnInventoryItemService = async (
  itemId: string,
  input: ReturnInventoryInput,
  actor: InventoryActor
) => {
  validatePositiveNumber(input.quantity, "Return quantity");
  if (!input.idempotencyKey?.trim()) throw new AppError("Idempotency key is required", 400);
  const schoolId = getSchoolId(actor);
  if (input.idempotencyKey) {
    const prior = await InventoryTransaction.findOne({ schoolId, idempotencyKey: input.idempotencyKey });
    if (prior) {
      if (String(prior.inventoryItemId) !== itemId || prior.transactionType !== INVENTORY_TRANSACTION_TYPE.RETURN) throw new AppError("Idempotency key is already used by another stock movement", 409);
      return { item: await getInventoryItem(itemId, actor), transaction: prior };
    }
  }
  const item = await getInventoryItem(itemId, actor);
  const previousAvailable = item.availableQuantity;
  const updated = await InventoryItem.findOneAndUpdate(
    { _id: item._id, schoolId, isDeleted: false, $expr: { $lte: [{ $add: ["$availableQuantity", input.quantity] }, "$quantity"] } },
    { $inc: { availableQuantity: input.quantity }, $set: { updatedBy: getUserId(actor), ...(input.condition && Object.values(INVENTORY_ITEM_CONDITION).includes(input.condition as InventoryItemCondition) ? { condition: input.condition } : {}) } },
    { new: true }
  );
  if (!updated) throw new AppError("Return quantity exceeds the outstanding issued stock", 409);
  try {
    const transaction = await createTransaction({
      schoolId, inventoryItemId: item._id, transactionType: INVENTORY_TRANSACTION_TYPE.RETURN,
      quantity: input.quantity, previousQuantity: item.quantity, newQuantity: updated.quantity,
      previousAvailableQuantity: previousAvailable, newAvailableQuantity: updated.availableQuantity,
      actualReturnDate: new Date(), conditionAfter: input.condition as InventoryItemCondition,
      idempotencyKey: input.idempotencyKey, notes: input.notes, performedBy: getUserId(actor),
    });
    await syncInventoryLowStockAlert(updated, { schoolId: actor.schoolId, userId: actor.userId });
    return { item: updated, transaction };
  } catch (error) {
    await InventoryItem.updateOne({ _id: item._id, schoolId }, { $inc: { availableQuantity: -input.quantity } });
    throw error;
  }
};

// Get inventory transaction history
export const getInventoryTransactionsService = async (
  itemId: string,
  filters: TransactionPaginationInput,
  actor: InventoryActor
) => {
  const item = await getInventoryItem(itemId, actor);

  const query: FilterQuery<IInventoryTransaction> = {
    schoolId: getSchoolId(actor),
    inventoryItemId: item._id,
  };

  if (filters.type) {
    query.transactionType = filters.type;
  }

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    InventoryTransaction.find(query)
      .populate("performedBy", "name email")
      .populate("issuedTo", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .lean(),

    InventoryTransaction.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
      hasNextPage: filters.page < Math.ceil(total / filters.limit),
      hasPreviousPage: filters.page > 1 && total > 0,
    },
  };
};
