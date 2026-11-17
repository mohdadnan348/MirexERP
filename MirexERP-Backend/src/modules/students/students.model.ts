
import {
  Schema,
  model,
  models,
  Document,
  Types,
} from "mongoose";

export enum StudentStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  TRANSFERRED = "TRANSFERRED",
  GRADUATED = "GRADUATED",
  WITHDRAWN = "WITHDRAWN",
  SUSPENDED = "SUSPENDED",
  EXPELLED = "EXPELLED",
  TC = "TC",
  ALUMNI = "ALUMNI",
}

export enum StudentGender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

export interface IStudent extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;

  admissionNumber: string;
  rollNumber?: string;

  firstName: string;
  middleName?: string;
  lastName: string;

  dateOfBirth: Date;
  gender: StudentGender;
  bloodGroup?: string;

  email?: string;
  phone?: string;
  profileImage?: string;

  classId: Types.ObjectId;
  sectionId: Types.ObjectId;

  parentId?: Types.ObjectId;

  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
  };

  medicalInformation?: {
    allergies?: string[];
    conditions?: string[];
    notes?: string;
  };

  admissionDate: Date;
  previousSchool?: string;
  previousSchoolDetails?: {
    name?: string; board?: string; previousClass?: string; academicSession?: string;
    tcNumber?: string; address?: string; notes?: string;
  };
  tcNumber?: string;
  tcIssuedAt?: Date;
  tcLocked?: boolean;
  isDeleted: boolean;
  deletedAt?: Date;

  status: StudentStatus;
  isActive: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
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

    admissionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    rollNumber: {
      type: String,
      trim: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: Object.values(StudentGender),
      required: true,
    },

    bloodGroup: {
      type: String,
      trim: true,
      uppercase: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    profileImage: {
      type: String,
      trim: true,
    },

    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      index: true,
    },

    address: {
      street: String,
      city: String,
      state: String,
      country: {
        type: String,
        default: "India",
      },
      postalCode: String,
    },

    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },

    medicalInformation: {
      allergies: {
        type: [String],
        default: [],
      },
      conditions: {
        type: [String],
        default: [],
      },
      notes: String,
    },

    admissionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    previousSchool: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(StudentStatus),
      default: StudentStatus.ACTIVE,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Admission number must be unique within a school.
studentSchema.index(
  { schoolId: 1, admissionNumber: 1 },
  { unique: true }
);

// Roll number must be unique within a section and session.
studentSchema.index(
  { schoolId: 1, sessionId: 1, sectionId: 1, rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rollNumber: { $type: "string" },
    },
  }
);

// Common listing indexes.
studentSchema.index({
  schoolId: 1,
  classId: 1,
  sectionId: 1,
  status: 1,
});

studentSchema.index({
  schoolId: 1,
  firstName: 1,
  lastName: 1,
});

const Student =
  models.Student ||
  model<IStudent>("Student", studentSchema);

export { Student };
export default Student;
