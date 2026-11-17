
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export enum CertificateType {
  BONAFIDE = "BONAFIDE",
  TRANSFER = "TRANSFER",
  CHARACTER = "CHARACTER",
  STUDY = "STUDY",
  COMPLETION = "COMPLETION",
  MIGRATION = "MIGRATION",
  ACHIEVEMENT = "ACHIEVEMENT",
  OTHER = "OTHER",
}

export enum CertificateStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
}

export interface ICertificate extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;

  certificateNumber: string;
  certificateType: CertificateType;
  title: string;
  description?: string;

  issueDate: Date;
  validUntil?: Date;

  studentName: string;
  fatherName?: string;
  motherName?: string;
  admissionNumber?: string;
  className?: string;

  reason?: string;
  remarks?: string;

  templateId?: Types.ObjectId;
  pdfUrl?: string;

  status: CertificateStatus;
  verificationCode: string;
  isVerified: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalRemarks?: string;
  rejectedAt?: Date;
  issuedAt?: Date;
  revokedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  issuedBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const certificateSchema = new Schema<ICertificate>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    certificateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    certificateType: {
      type: String,
      enum: Object.values(CertificateType),
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    validUntil: {
      type: Date,
    },

    studentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    fatherName: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    motherName: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    admissionNumber: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    className: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    templateId: {
      type: Schema.Types.ObjectId,
      ref: "CertificateTemplate",
    },

    pdfUrl: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(CertificateStatus),
      default: CertificateStatus.ACTIVE,
      index: true,
    },

    verificationCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    isVerified: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "APPROVED", index: true },
    approvalRemarks: { type: String, trim: true, maxlength: 1000 },
    rejectedAt: Date,
    issuedAt: Date,
    revokedAt: Date,

    issuedBy: {
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
    versionKey: false,
  }
);

// Certificate number unique within a school.
certificateSchema.index(
  {
    schoolId: 1,
    certificateNumber: 1,
  },
  {
    unique: true,
  }
);


// Prevent more than one active transfer certificate for a student in a school.
certificateSchema.index(
  { schoolId: 1, studentId: 1, certificateType: 1 },
  { unique: true, partialFilterExpression: { certificateType: "TRANSFER" } }
);

// Efficient student certificate lookup.
certificateSchema.index({
  schoolId: 1,
  studentId: 1,
  issueDate: -1,
});

// Efficient certificate listing.
certificateSchema.index({
  schoolId: 1,
  certificateType: 1,
  status: 1,
  issueDate: -1,
});

certificateSchema.pre("validate", function (next) {
  if (
    this.validUntil &&
    this.issueDate &&
    this.validUntil < this.issueDate
  ) {
    this.invalidate(
      "validUntil",
      "Validity date cannot be before issue date"
    );
  }

  next();
});

const Certificate: Model<ICertificate> =
  mongoose.models.Certificate ||
  mongoose.model<ICertificate>(
    "Certificate",
    certificateSchema
  );

export { Certificate };
export default Certificate;
