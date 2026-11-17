
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

import { ADMISSION_STATUS } from "../../config/constants";

export interface IAdmissionAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface IAdmissionGuardian {
  name: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  alternatePhone?: string;
  email?: string;
  occupation?: string;
  isPrimaryContact: boolean;
}

export interface IAdmissionFollowUp {
  note: string;
  outcome?: string;
  followUpDate: Date;
  nextFollowUpDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export interface IAdmissionDocument {
  documentType: string;
  documentName: string;
  fileUrl: string;
  uploadedAt: Date;
  verified: boolean;
  remarks?: string;
}

export interface IAdmission {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  enquiryId?: Types.ObjectId;
  source?: string;
  parentDeclaration?: boolean;
  statusHistory?: Array<{previousStatus?: string; newStatus: string; changedBy: Types.ObjectId; changedAt: Date; remarks?: string}>;

  applicationNumber: string;

  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;

  dateOfBirth: Date;
  gender: "MALE" | "FEMALE" | "OTHER";

  bloodGroup?: string;
  nationality: string;
  religion?: string;
  category?: string;
  motherTongue?: string;

  email?: string;
  phone?: string;

  address: IAdmissionAddress;
  guardians: IAdmissionGuardian[];

  appliedClassId: Types.ObjectId;
  appliedSectionId?: Types.ObjectId;

  admissionDate?: Date;

  previousSchool?: string;
  previousClass?: string;
  previousBoard?: string;
  previousSchoolTcNumber?: string;

  documents: IAdmissionDocument[];
  followUps?: IAdmissionFollowUp[];

  status: (typeof ADMISSION_STATUS)[keyof typeof ADMISSION_STATUS];

  applicationDate: Date;
  submittedAt?: Date;

  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;

  rejectionReason?: string;

  convertedStudentId?: Types.ObjectId;
  convertedAt?: Date;

  isDeleted: boolean;
  deletedAt?: Date;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAdmissionDocumentModel
  extends IAdmission,
    Document {}

const AdmissionAddressSchema = new Schema<IAdmissionAddress>(
  {
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const AdmissionGuardianSchema =
  new Schema<IAdmissionGuardian>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      relationship: {
        type: String,
        enum: ["FATHER", "MOTHER", "GUARDIAN"],
        required: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      alternatePhone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      occupation: {
        type: String,
        trim: true,
      },
      isPrimaryContact: {
        type: Boolean,
        default: false,
      },
    },
    { _id: false }
  );

const AdmissionDocumentSchema =
  new Schema<IAdmissionDocument>(
    {
      documentType: {
        type: String,
        required: true,
        trim: true,
      },
      documentName: {
        type: String,
        required: true,
        trim: true,
      },
      fileUrl: {
        type: String,
        required: true,
        trim: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      verified: {
        type: Boolean,
        default: false,
      },
      remarks: { type: String, trim: true },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
      storagePath: { type: String, select: false },
      isDeleted: { type: Boolean, default: false },
    },
    { _id: true }
  );

const AdmissionFollowUpSchema = new Schema<IAdmissionFollowUp>(
  {
    note: { type: String, required: true, trim: true, maxlength: 1000 },
    outcome: { type: String, trim: true, maxlength: 500 },
    followUpDate: { type: Date, required: true, default: Date.now },
    nextFollowUpDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AdmissionSchema =
  new Schema<IAdmissionDocumentModel>(
    {
      schoolId: {
        type: Schema.Types.ObjectId,
        ref: "School",
        required: true,
        index: true,
      },
      enquiryId: { type: Schema.Types.ObjectId, ref: "AdmissionEnquiry", index: true },
      source: { type: String, trim: true },
      parentDeclaration: { type: Boolean, default: false },
      statusHistory: { type: [{ previousStatus: String, newStatus: { type: String, required: true }, changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, changedAt: { type: Date, default: Date.now }, remarks: String }], default: [] },
      sessionId: {
        type: Schema.Types.ObjectId,
        ref: "Session",
        required: true,
        index: true,
      },

      applicationNumber: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      middleName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      dateOfBirth: {
        type: Date,
        required: true,
      },
      gender: {
        type: String,
        enum: ["MALE", "FEMALE", "OTHER"],
        required: true,
      },

      bloodGroup: {
        type: String,
        trim: true,
      },
      nationality: {
        type: String,
        default: "Indian",
        trim: true,
      },
      religion: {
        type: String,
        trim: true,
      },
      category: {
        type: String,
        trim: true,
      },
      motherTongue: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },

      address: {
        type: AdmissionAddressSchema,
        required: true,
      },
      guardians: {
        type: [AdmissionGuardianSchema],
        required: true,
        validate: {
          validator: (value: IAdmissionGuardian[]) =>
            value.length > 0,
          message: "At least one guardian is required",
        },
      },

      appliedClassId: {
        type: Schema.Types.ObjectId,
        ref: "Class",
        required: true,
        index: true,
      },
      appliedSectionId: {
        type: Schema.Types.ObjectId,
        ref: "Section",
      },

      admissionDate: {
        type: Date,
      },

      previousSchool: {
        type: String,
        trim: true,
      },
      previousClass: {
        type: String,
        trim: true,
      },
      previousBoard: {
        type: String,
        trim: true,
      },
      previousSchoolTcNumber: { type: String, trim: true, maxlength: 100 },

      documents: {
        type: [AdmissionDocumentSchema],
        default: [],
      },

      followUps: {
        type: [AdmissionFollowUpSchema],
        default: [],
      },

      status: {
        type: String,
        enum: Object.values(ADMISSION_STATUS),
        default: ADMISSION_STATUS.APPLIED,
        required: true,
      },

      applicationDate: {
        type: Date,
        default: Date.now,
        required: true,
      },
      submittedAt: {
        type: Date,
      },

      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: {
        type: Date,
      },
      reviewRemarks: {
        type: String,
        trim: true,
      },

      rejectionReason: {
        type: String,
        trim: true,
      },

      convertedStudentId: {
        type: Schema.Types.ObjectId,
        ref: "Student",
      },
      convertedAt: {
        type: Date,
      },

      isDeleted: {
        type: Boolean,
        default: false,
        index: true,
      },
      deletedAt: {
        type: Date,
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
      versionKey: false,
      collection: "admissions",
    }
  );

// Application number unique within each school and session.
AdmissionSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    applicationNumber: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// School-wise admission listing.
AdmissionSchema.index({
  schoolId: 1,
  sessionId: 1,
  status: 1,
  applicationDate: -1,
});

// Search applications by applicant name.
AdmissionSchema.index({
  schoolId: 1,
  fullName: 1,
});

// Search by applicant phone.
AdmissionSchema.index({
  schoolId: 1,
  phone: 1,
});

// Maintain applicant full name automatically.
AdmissionSchema.pre("validate", function (next) {
  this.fullName = [
    this.firstName,
    this.middleName,
    this.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  next();
});

const Admission: Model<IAdmissionDocumentModel> =
  mongoose.models.Admission ||
  mongoose.model<IAdmissionDocumentModel>(
    "Admission",
    AdmissionSchema
  );

export default Admission;
