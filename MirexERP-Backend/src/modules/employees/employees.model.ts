
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type EmployeeType =
  | "TEACHING"
  | "NON_TEACHING"
  | "ADMINISTRATIVE"
  | "SUPPORT"
  | "OTHER";

export type EmploymentType =
  | "PERMANENT"
  | "CONTRACT"
  | "PART_TIME"
  | "TEMPORARY"
  | "SUBSTITUTE";

export type EmployeeGender =
  | "MALE"
  | "FEMALE"
  | "OTHER";

export interface IEmployee {
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId | null;

  employeeId: string;

  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;

  email?: string;
  phone: string;
  alternatePhone?: string;

  dateOfBirth?: Date;
  gender: EmployeeGender;
  bloodGroup?: string;

  employeeType: EmployeeType;
  designation: string;
  department?: string;
  employmentType: EmploymentType;

  qualification?: string;
  specialization?: string;
  experienceYears?: number;

  joiningDate: Date;
  confirmationDate?: Date;
  resignationDate?: Date;

  salary?: {
    basic: number;
    hra: number;
    allowances: number;
    deductions: number;
    grossSalary: number;
    netSalary: number;
    currency: string;
  };

  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };

  documents?: Array<{
    documentType: string;
    documentNumber?: string;
    fileUrl: string;
    uploadedAt: Date;
  }>;

  profileImage?: string;

  status:
    | "ACTIVE"
    | "INACTIVE"
    | "ON_LEAVE"
    | "RESIGNED"
    | "TERMINATED";

  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;

  remarks?: string;
  panNumber?: string;
  workEmail?: string;
  workMobile?: string;
  qualifications?: Array<Record<string, unknown>>;
  experienceHistory?: Array<Record<string, unknown>>;
  salaryHistory?: Array<Record<string, unknown>>;
  exitHistory?: Array<Record<string, unknown>>;
  exitDetails?: Record<string, unknown>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeDocument
  extends IEmployee,
    Document {}

const employeeSchema = new Schema<IEmployeeDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 150,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    alternatePhone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true,
    },

    bloodGroup: {
      type: String,
      trim: true,
      enum: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ],
    },

    employeeType: {
      type: String,
      enum: [
        "TEACHING",
        "NON_TEACHING",
        "ADMINISTRATIVE",
        "SUPPORT",
        "OTHER",
      ],
      required: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    department: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    employmentType: {
      type: String,
      enum: [
        "PERMANENT",
        "CONTRACT",
        "PART_TIME",
        "TEMPORARY",
        "SUBSTITUTE",
      ],
      default: "PERMANENT",
      required: true,
    },

    qualification: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    specialization: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    experienceYears: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    confirmationDate: {
      type: Date,
    },

    resignationDate: {
      type: Date,
    },

    salary: {
      basic: {
        type: Number,
        min: 0,
        default: 0,
      },

      hra: {
        type: Number,
        min: 0,
        default: 0,
      },

      allowances: {
        type: Number,
        min: 0,
        default: 0,
      },

      deductions: {
        type: Number,
        min: 0,
        default: 0,
      },

      grossSalary: {
        type: Number,
        min: 0,
        default: 0,
      },

      netSalary: {
        type: Number,
        min: 0,
        default: 0,
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },
    },

    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: {
        type: String,
        default: "India",
      },
    },

    emergencyContact: {
      name: {
        type: String,
        trim: true,
      },
      relationship: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },

    documents: [
      {
        documentType: {
          type: String,
          required: true,
          trim: true,
        },

        documentNumber: {
          type: String,
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
      },
    ],

    profileImage: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "INACTIVE",
        "ON_LEAVE",
        "RESIGNED",
        "TERMINATED",
      ],
      default: "ACTIVE",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
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
    collection: "employees",
  }
);

// Employee ID must be unique within a school.
employeeSchema.index(
  {
    schoolId: 1,
    employeeId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Email must be unique within a school when provided.
employeeSchema.index(
  {
    schoolId: 1,
    email: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      email: { $type: "string" },
    },
  }
);

// User account can be linked to only one active employee
// record within the same school.
employeeSchema.index(
  {
    schoolId: 1,
    userId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      userId: { $type: "objectId" },
    },
  }
);

// Common employee listing filters.
employeeSchema.index({
  schoolId: 1,
  employeeType: 1,
  department: 1,
  status: 1,
  isDeleted: 1,
});

employeeSchema.index({
  schoolId: 1,
  designation: 1,
});

employeeSchema.index({
  schoolId: 1,
  joiningDate: -1,
});

// Normalize employee information.
employeeSchema.pre("validate", function () {
  if (this.employeeId) {
    this.employeeId = this.employeeId.trim().toUpperCase();
  }

  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.firstName) {
    this.firstName = this.firstName.trim();
  }

  if (this.middleName) {
    this.middleName = this.middleName.trim();
  }

  if (this.lastName) {
    this.lastName = this.lastName.trim();
  }

  this.fullName = [
    this.firstName,
    this.middleName,
    this.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  if (
    this.salary &&
    this.salary.basic !== undefined &&
    this.salary.allowances !== undefined &&
    this.salary.deductions !== undefined
  ) {
    this.salary.grossSalary =
      this.salary.basic + (this.salary.hra || 0) + this.salary.allowances;

    this.salary.netSalary =
      this.salary.grossSalary - this.salary.deductions;
  }

  if (
    this.resignationDate &&
    this.joiningDate &&
    this.resignationDate < this.joiningDate
  ) {
    this.invalidate(
      "resignationDate",
      "Resignation date cannot be before joining date"
    );
  }
});

const Employee: Model<IEmployeeDocument> =
  mongoose.models.Employee ||
  mongoose.model<IEmployeeDocument>(
    "Employee",
    employeeSchema
  );

export { Employee };
export default Employee;
