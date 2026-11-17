
import { Schema, model, models } from "mongoose";
import Transport from "./transport.model";

const tenant = {
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
};

const documentSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "REGISTRATION_CERTIFICATE",
        "INSURANCE",
        "FITNESS_CERTIFICATE",
        "POLLUTION_CERTIFICATE",
        "PERMIT",
        "LICENSE",
        "OTHER",
      ],
      required: true,
    },
    number: { type: String, trim: true, maxlength: 100 },
    issueDate: Date,
    expiryDate: Date,
    fileUrl: String,
    mimeType: String,
    fileSize: { type: Number, min: 0 },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
  },
  { _id: true, timestamps: true }
);

// Vehicle fleet metadata extends the existing Transport collection.
export const TransportVehicle = Transport;

const driverSchema = new Schema(
  {
    ...tenant,
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    name: { type: String, required: true, trim: true },
    phone: String,
    address: String,
    dateOfBirth: Date,
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    licenseType: String,
    licenseExpiry: { type: Date, required: true },
    emergencyContact: String,
    joiningDate: Date,
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    documents: { type: [documentSchema], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

driverSchema.index({ schoolId: 1, licenseNumber: 1 }, { unique: true });

export const TransportDriver =
  models.TransportDriver || model("TransportDriver", driverSchema);

const stopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: String,
    sequence: { type: Number, required: true, min: 1 },
    pickupTime: String,
    dropTime: String,
    landmark: String,
    latitude: Number,
    longitude: Number,
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { _id: true }
);

const routeSchema = new Schema(
  {
    ...tenant,
    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    startPoint: String,
    destination: String,
    vehicleId: { type: Schema.Types.ObjectId, ref: "Transport" },
    driverId: { type: Schema.Types.ObjectId, ref: "TransportDriver" },
    substituteDriverId: {
      type: Schema.Types.ObjectId,
      ref: "TransportDriver",
    },
    driverAssignmentHistory: [
      {
        driverId: Schema.Types.ObjectId,
        role: String,
        assignedAt: { type: Date, default: Date.now },
        assignedBy: Schema.Types.ObjectId,
        reason: String,
      },
    ],
    stops: { type: [stopSchema], default: [] },
    estimatedDistanceKm: { type: Number, min: 0 },
    estimatedDurationMinutes: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    description: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

routeSchema.index({ schoolId: 1, code: 1 }, { unique: true });
routeSchema.index({ schoolId: 1, academicSessionId: 1, status: 1 });

export const TransportRoute =
  models.TransportRoute || model("TransportRoute", routeSchema);

const assignmentSchema = new Schema(
  {
    ...tenant,
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "TransportRoute",
      required: true,
    },
    stopId: { type: Schema.Types.ObjectId, required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Transport" },
    pickupPoint: String,
    dropPoint: String,
    assignmentDate: { type: Date, required: true },
    endDate: Date,
    monthlyFee: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "ENDED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    feeConfigurationRef: String,
    feeInvoiceId: { type: Schema.Types.ObjectId, ref: "FeeInvoice" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    history: [
      {
        action: String,
        from: Schema.Types.Mixed,
        to: Schema.Types.Mixed,
        at: { type: Date, default: Date.now },
        by: Schema.Types.ObjectId,
        reason: String,
      },
    ],
  },
  { timestamps: true }
);

assignmentSchema.index(
  { schoolId: 1, studentId: 1, academicSessionId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  }
);

export const StudentTransportAssignment =
  models.StudentTransportAssignment ||
  model("StudentTransportAssignment", assignmentSchema);

const maintenanceSchema = new Schema(
  {
    ...tenant,
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Transport",
      required: true,
    },
    maintenanceType: { type: String, required: true },
    serviceDate: { type: Date, required: true },
    description: String,
    vendor: String,
    cost: { type: Number, min: 0, default: 0 },
    nextServiceDate: Date,
    attachmentUrl: String,
    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "COMPLETED",
    },
    financePostingRef: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

maintenanceSchema.index({ schoolId: 1, vehicleId: 1, serviceDate: -1 });

export const VehicleMaintenance =
  models.VehicleMaintenance || model("VehicleMaintenance", maintenanceSchema);

const settingsSchema = new Schema(
  {
    ...tenant,
    documentExpiryAlertDays: { type: Number, default: 30, min: 1, max: 180 },
    gpsEnabled: { type: Boolean, default: false },
    gpsProvider: String,
    parentVehicleContactVisible: { type: Boolean, default: false },
    parentRouteVisible: { type: Boolean, default: true },
    parentStopVisible: { type: Boolean, default: true },
    studentTransportVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingsSchema.index({ schoolId: 1 }, { unique: true });

export const TransportSettings =
  models.TransportSettings || model("TransportSettings", settingsSchema);