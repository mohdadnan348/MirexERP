
import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

export const INVENTORY_ITEM_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DISCONTINUED: "DISCONTINUED",
} as const;

export const INVENTORY_TRANSACTION_TYPE = {
  PURCHASE: "PURCHASE",
  ISSUE: "ISSUE",
  RETURN: "RETURN",
  ADJUSTMENT: "ADJUSTMENT",
  DAMAGE: "DAMAGE",
  LOST: "LOST",
} as const;

export const INVENTORY_ITEM_CONDITION = {
  NEW: "NEW",
  GOOD: "GOOD",
  FAIR: "FAIR",
  DAMAGED: "DAMAGED",
} as const;

export type InventoryItemStatus =
  (typeof INVENTORY_ITEM_STATUS)[keyof typeof INVENTORY_ITEM_STATUS];

export type InventoryTransactionType =
  (typeof INVENTORY_TRANSACTION_TYPE)[keyof typeof INVENTORY_TRANSACTION_TYPE];

export type InventoryItemCondition =
  (typeof INVENTORY_ITEM_CONDITION)[keyof typeof INVENTORY_ITEM_CONDITION];

export interface IInventoryItem extends Document {
  schoolId: Types.ObjectId;
  name: string;
  itemCode: string;
  category: string;
  description?: string;
  unit: string;
  quantity: number;
  availableQuantity: number;
  minimumStockLevel: number;
  unitPrice: number;
  supplierName?: string;
  supplierContact?: string;
  storageLocation?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  condition: InventoryItemCondition;
  status: InventoryItemStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryTransaction extends Document {
  schoolId: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  transactionType: InventoryTransactionType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  previousAvailableQuantity?: number;
  newAvailableQuantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  issuedTo?: Types.ObjectId;
  issuedToName?: string;
  issuedToRole?: string;
  issueDate?: Date;
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  conditionBefore?: InventoryItemCondition;
  conditionAfter?: InventoryItemCondition;
  reason?: string;
  referenceNumber?: string;
  idempotencyKey?: string;
  notes?: string;
  performedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    itemCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      default: "PCS",
      maxlength: 30,
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    availableQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    minimumStockLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    unitPrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    supplierName: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    supplierContact: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    storageLocation: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    purchaseDate: Date,

    warrantyExpiry: Date,

    condition: {
      type: String,
      enum: Object.values(INVENTORY_ITEM_CONDITION),
      default: INVENTORY_ITEM_CONDITION.NEW,
    },

    status: {
      type: String,
      enum: Object.values(INVENTORY_ITEM_STATUS),
      default: INVENTORY_ITEM_STATUS.ACTIVE,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventoryItemSchema.index(
  { schoolId: 1, itemCode: 1 },
  { unique: true }
);

inventoryItemSchema.index({
  schoolId: 1,
  category: 1,
  status: 1,
});

inventoryItemSchema.index({
  schoolId: 1,
  quantity: 1,
  minimumStockLevel: 1,
});

const inventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },

    transactionType: {
      type: String,
      enum: Object.values(INVENTORY_TRANSACTION_TYPE),
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    previousAvailableQuantity: { type: Number, min: 0 },
    newAvailableQuantity: { type: Number, min: 0 },

    unitPrice: {
      type: Number,
      min: 0,
    },

    totalAmount: {
      type: Number,
      min: 0,
    },

    issuedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    issuedToName: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    issuedToRole: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    issueDate: Date,

    expectedReturnDate: Date,

    actualReturnDate: Date,

    conditionBefore: {
      type: String,
      enum: Object.values(INVENTORY_ITEM_CONDITION),
    },

    conditionAfter: {
      type: String,
      enum: Object.values(INVENTORY_ITEM_CONDITION),
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    idempotencyKey: { type: String, trim: true, maxlength: 150 },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventoryTransactionSchema.index({
  schoolId: 1,
  inventoryItemId: 1,
  createdAt: -1,
});

inventoryTransactionSchema.index({
  schoolId: 1,
  transactionType: 1,
  createdAt: -1,
});
inventoryTransactionSchema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

export const InventoryItem: Model<IInventoryItem> =
  (models.InventoryItem as Model<IInventoryItem>) ||
  model<IInventoryItem>("InventoryItem", inventoryItemSchema);

export const InventoryTransaction: Model<IInventoryTransaction> =
  (models.InventoryTransaction as Model<IInventoryTransaction>) ||
  model<IInventoryTransaction>(
    "InventoryTransaction",
    inventoryTransactionSchema
  );
