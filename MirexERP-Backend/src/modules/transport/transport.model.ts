
import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

export enum TransportStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

export enum VehicleType {
  BUS = "BUS",
  MINI_BUS = "MINI_BUS",
  VAN = "VAN",
  CAB = "CAB",
}

export interface ITransportStop {
  _id?: Types.ObjectId;
  stopName: string;
  address: string;
  pickupTime: string;
  dropTime: string;
  monthlyFee: number;
}

export interface IStudentTransportAssignment {
  studentId: Types.ObjectId;
  stopId: Types.ObjectId;
  assignedAt: Date;
  assignedBy: Types.ObjectId;
}

export interface ITransport extends Document {
  schoolId: Types.ObjectId;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleName: string;
  capacity: number;
  driverId: Types.ObjectId;
  driverName: string;
  driverPhone: string;
  routeName: string;
  stops: ITransportStop[];
  status: TransportStatus;
  insuranceExpiry?: Date;
  fitnessExpiry?: Date;
  permitExpiry?: Date;
  manufacturer?: string;
  ownershipType?: "OWNED" | "LEASED" | "CONTRACTED";
  purchaseDate?: Date;
  notes?: string;
  documents?: Array<{ type: string; number?: string; issueDate?: Date; expiryDate?: Date; fileUrl?: string; verificationStatus?: string }>;
  assignedStudents: Types.ObjectId[];
  studentAssignments: IStudentTransportAssignment[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transportStopSchema = new Schema<ITransportStop>(
  {
    stopName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    pickupTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    dropTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    monthlyFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const studentTransportAssignmentSchema = new Schema<IStudentTransportAssignment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    stopId: { type: Schema.Types.ObjectId, required: true },
    assignedAt: { type: Date, default: Date.now, required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const transportSchema = new Schema<ITransport>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    vehicleType: {
      type: String,
      enum: Object.values(VehicleType),
      required: true,
    },
    vehicleName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    driverName: {
      type: String,
      required: true,
      trim: true,
    },
    driverPhone: {
      type: String,
      required: true,
      trim: true,
    },
    routeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    stops: {
      type: [transportStopSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(TransportStatus),
      default: TransportStatus.ACTIVE,
    },
    insuranceExpiry: Date,
    fitnessExpiry: Date,
    permitExpiry: Date,
    manufacturer: { type: String, trim: true, maxlength: 100 },
    ownershipType: { type: String, enum: ["OWNED","LEASED","CONTRACTED"], default: "OWNED" },
    purchaseDate: Date,
    notes: { type: String, trim: true, maxlength: 1000 },
    documents: [{
      type: { type: String, enum: ["REGISTRATION_CERTIFICATE","INSURANCE","FITNESS_CERTIFICATE","POLLUTION_CERTIFICATE","PERMIT","OTHER"], required: true },
      number: { type: String, trim: true, maxlength: 100 },
      issueDate: Date, expiryDate: Date, fileUrl: { type: String, trim: true },
      verificationStatus: { type: String, enum: ["PENDING","VERIFIED","REJECTED"], default: "PENDING" },
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User" }, verifiedAt: Date
    }],
    assignedStudents: [
      {
        type: Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    studentAssignments: {
      type: [studentTransportAssignmentSchema],
      default: [],
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
  },
  {
    timestamps: true,
  }
);

// Vehicle number must be unique within a school.
transportSchema.index(
  { schoolId: 1, vehicleNumber: 1 },
  { unique: true }
);

transportSchema.index({
  schoolId: 1,
  status: 1,
});

transportSchema.index({
  schoolId: 1,
  driverId: 1,
});

transportSchema.index({
  schoolId: 1,
  assignedStudents: 1,
});

const Transport = mongoose.model<ITransport>(
  "Transport",
  transportSchema
);

export default Transport;
