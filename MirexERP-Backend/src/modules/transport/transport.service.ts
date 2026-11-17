
import { Types } from "mongoose";
import Transport, {
  TransportStatus,
} from "./transport.model";

import Student from "../students/students.model";
import Employee from "../employees/employees.model";
import { AppError } from "../../utils/AppError";

interface TransportActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface CreateTransportInput {
  vehicleNumber: string;
  vehicleType: string;
  vehicleName: string;
  capacity: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  routeName: string;
  stops?: Array<{
    stopName: string;
    address: string;
    pickupTime: string;
    dropTime: string;
    monthlyFee: number;
  }>;
  status?: TransportStatus;
  insuranceExpiry?: Date | string;
  fitnessExpiry?: Date | string;
  permitExpiry?: Date | string;
}

interface TransportFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  routeId?: string;
}

const validateId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const ensureSchool = (schoolId: string) => {
  validateId(schoolId, "school ID");
};

const validateVehicleInput = (
  input: Partial<CreateTransportInput>
) => {
  if (input.capacity !== undefined && input.capacity < 1) {
    throw new AppError("Vehicle capacity must be at least 1", 400);
  }

  if (input.stops) {
    for (const stop of input.stops) {
      if (stop.monthlyFee < 0) {
        throw new AppError(
          "Stop monthly fee cannot be negative",
          400
        );
      }

      if (stop.pickupTime >= stop.dropTime) {
        throw new AppError(
          "Drop time must be after pickup time",
          400
        );
      }
    }
  }
};

/**
 * Create transport
 */
export const createTransportService = async (
  actor: TransportActor,
  input: CreateTransportInput
) => {
  ensureSchool(actor.schoolId);
  validateId(input.driverId, "driver ID");
  validateVehicleInput(input);

  const driver = await Employee.findOne({
    _id: input.driverId,
    schoolId: actor.schoolId,
    isDeleted: false,
  }).select("_id firstName lastName phone");
  if (!driver) {
    throw new AppError("Selected driver is not an active employee of this school", 404);
  }

  const existingVehicle = await Transport.findOne({
    schoolId: actor.schoolId,
    vehicleNumber: input.vehicleNumber.toUpperCase(),
  });

  if (existingVehicle) {
    throw new AppError(
      "Vehicle number already exists",
      409
    );
  }

  const transport = await Transport.create({
    ...input,
    schoolId: actor.schoolId,
    vehicleNumber: input.vehicleNumber.toUpperCase(),
    assignedStudents: [],
    createdBy: actor.userId,
  });

  return transport;
};

/**
 * Get all transport records
 */
export const getTransportsService = async (
  schoolId: string,
  filters: TransportFilters
) => {
  ensureSchool(schoolId);

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 10));

  const query: Record<string, any> = {
    schoolId,
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    query.$or = [
      { vehicleNumber: { $regex: filters.search, $options: "i" } },
      { vehicleName: { $regex: filters.search, $options: "i" } },
      { driverName: { $regex: filters.search, $options: "i" } },
      { routeName: { $regex: filters.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Transport.find(query)
      .populate("driverId", "firstName lastName employeeId")
      .populate("assignedStudents", "firstName lastName admissionNumber")
      .populate("studentAssignments.studentId", "firstName lastName admissionNumber")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Transport.countDocuments(query),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get transport by ID
 */
export const getTransportByIdService = async (
  schoolId: string,
  transportId: string
) => {
  ensureSchool(schoolId);
  validateId(transportId, "transport ID");

  const transport = await Transport.findOne({
    _id: transportId,
    schoolId,
  })
    .populate("driverId", "firstName lastName employeeId phone")
    .populate(
      "assignedStudents",
      "firstName lastName admissionNumber classId sectionId"
    );

  if (!transport) {
    throw new AppError("Transport record not found", 404);
  }

  return transport;
};

/**
 * Update transport
 */
export const updateTransportService = async (
  schoolId: string,
  transportId: string,
  input: Partial<CreateTransportInput> & {
    updatedBy?: string;
  }
) => {
  ensureSchool(schoolId);
  validateId(transportId, "transport ID");

  const transport = await Transport.findOne({
    _id: transportId,
    schoolId,
  });

  if (!transport) {
    throw new AppError("Transport record not found", 404);
  }

  validateVehicleInput(input);

  if (input.driverId) {
    validateId(input.driverId, "driver ID");
    const driver = await Employee.findOne({
      _id: input.driverId,
      schoolId,
      isDeleted: false,
    }).select("_id");
    if (!driver) {
      throw new AppError("Selected driver is not an active employee of this school", 404);
    }
  }

  if (input.vehicleNumber) {
    const duplicate = await Transport.findOne({
      schoolId,
      vehicleNumber: input.vehicleNumber.toUpperCase(),
      _id: { $ne: transportId },
    });

    if (duplicate) {
      throw new AppError(
        "Vehicle number already exists",
        409
      );
    }
  }

  const allowedFields = [
    "vehicleNumber",
    "vehicleType",
    "vehicleName",
    "capacity",
    "driverId",
    "driverName",
    "driverPhone",
    "routeName",
    "stops",
    "status",
    "insuranceExpiry",
    "fitnessExpiry",
    "permitExpiry",
  ] as const;

  for (const field of allowedFields) {
    const value = input[field];

    if (value !== undefined) {
      (transport as any)[field] =
        field === "vehicleNumber" && typeof value === "string"
          ? value.toUpperCase()
          : value;
    }
  }

  if (input.updatedBy) {
    transport.updatedBy = new Types.ObjectId(input.updatedBy);
  }

  await transport.save();

  return transport;
};

/**
 * Delete transport (soft delete)
 */
export const deleteTransportService = async (
  schoolId: string,
  transportId: string
) => {
  ensureSchool(schoolId);
  validateId(transportId, "transport ID");

  const transport = await Transport.findOne({
    _id: transportId,
    schoolId,
  });

  if (!transport) {
    throw new AppError("Transport record not found", 404);
  }

  if (transport.assignedStudents.length > 0) {
    throw new AppError(
      "Remove all student assignments before deleting this vehicle",
      409
    );
  }

  transport.status = TransportStatus.INACTIVE;

  await transport.save();

  return transport;
};

/**
 * Assign transport to student
 */
export const assignStudentTransportService = async (
  schoolId: string,
  transportId: string,
  studentId: string,
  stopId: string,
  userId: string
) => {
  ensureSchool(schoolId);
  validateId(transportId, "transport ID");
  validateId(studentId, "student ID");
  validateId(stopId, "stop ID");
  validateId(userId, "user ID");

  const [transport, student] = await Promise.all([
    Transport.findOne({
      _id: transportId,
      schoolId,
      status: TransportStatus.ACTIVE,
    }),
    Student.findOne({
      _id: studentId,
      schoolId,
      isActive: true,
    }),
  ]);

  if (!transport) {
    throw new AppError("Active transport not found", 404);
  }

  if (!student) {
    throw new AppError("Active student not found", 404);
  }

  const stopExists = transport.stops.some(
    (stop) => stop._id?.toString() === stopId
  );

  if (!stopExists) {
    throw new AppError(
      "Selected transport stop does not exist",
      404
    );
  }

  if (
    transport.assignedStudents.some(
      (id) => id.toString() === studentId
    )
  ) {
    throw new AppError(
      "Student is already assigned to this transport",
      409
    );
  }

  const existingAssignment = await Transport.findOne({
    schoolId,
    assignedStudents: studentId,
    status: TransportStatus.ACTIVE,
  });

  if (existingAssignment) {
    throw new AppError(
      "Student already has an active transport assignment",
      409
    );
  }

  if (transport.assignedStudents.length >= transport.capacity) {
    throw new AppError(
      "Vehicle capacity is full",
      409
    );
  }

  transport.assignedStudents.push(
    new Types.ObjectId(studentId)
  );
  transport.studentAssignments.push({
    studentId: new Types.ObjectId(studentId),
    stopId: new Types.ObjectId(stopId),
    assignedAt: new Date(),
    assignedBy: new Types.ObjectId(userId),
  } as any);

  transport.updatedBy = new Types.ObjectId(userId);

  await transport.save();

  return {
    transport,
    student,
    assignedStop: transport.stops.find(
      (stop) => stop._id?.toString() === stopId
    ),
  };
};

/**
 * Remove student transport assignment
 */
export const removeStudentTransportService = async (
  schoolId: string,
  transportId: string,
  studentId: string
) => {
  ensureSchool(schoolId);
  validateId(transportId, "transport ID");
  validateId(studentId, "student ID");

  const transport = await Transport.findOne({
    _id: transportId,
    schoolId,
  });

  if (!transport) {
    throw new AppError("Transport record not found", 404);
  }

  const assigned = transport.assignedStudents.some(
    (id) => id.toString() === studentId
  );

  if (!assigned) {
    throw new AppError(
      "Student is not assigned to this transport",
      404
    );
  }

  transport.assignedStudents =
    transport.assignedStudents.filter(
      (id) => id.toString() !== studentId
    ) as any;
  transport.studentAssignments =
    (transport.studentAssignments || []).filter(
      (assignment: any) => assignment.studentId?.toString() !== studentId
    ) as any;

  await transport.save();

  return transport;
};

/**
 * Get student's transport details
 */
export const getStudentTransportService = async (
  schoolId: string,
  studentId: string
) => {
  ensureSchool(schoolId);
  validateId(studentId, "student ID");

  const student = await Student.findOne({
    _id: studentId,
    schoolId,
  });

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  const transport = await Transport.findOne({
    schoolId,
    assignedStudents: studentId,
    status: TransportStatus.ACTIVE,
  })
    .populate("driverId", "firstName lastName phone")
    .populate("assignedStudents", "firstName lastName admissionNumber")
    .populate("studentAssignments.studentId", "firstName lastName admissionNumber");

  if (!transport) {
    throw new AppError(
      "No transport assigned to this student",
      404
    );
  }

  const assignedStudent = transport.assignedStudents.find(
    (item: any) => item._id?.toString() === studentId
  );

  const assignment = (transport.studentAssignments || []).find(
    (item: any) => item.studentId?._id?.toString() === studentId || item.studentId?.toString() === studentId
  );
  const assignedStop = assignment
    ? transport.stops.find((stop: any) => stop._id?.toString() === assignment.stopId?.toString())
    : undefined;

  return {
    student: assignedStudent,
    transport,
    assignment: assignment || null,
    assignedStop: assignedStop || null,
  };
};
