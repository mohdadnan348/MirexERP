
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format");

const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    "Time must be in HH:mm format"
  );

const dateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date format",
  })
  .optional()
  .nullable();

const stopSchema = z
  .object({
    stopName: z.string().trim().min(2).max(100),
    address: z.string().trim().min(2).max(300),
    pickupTime: timeSchema,
    dropTime: timeSchema,
    monthlyFee: z.coerce.number().min(0).default(0),
  })
  .refine((stop) => stop.pickupTime < stop.dropTime, {
    message: "Pickup time must be earlier than drop time",
    path: ["dropTime"],
  });

const createTransportFields = {
  vehicleNumber: z.string().trim().min(2).max(30),
  vehicleType: z.string().trim().min(2).max(50),
  vehicleName: z.string().trim().max(100).optional().default(""),
  capacity: z.coerce.number().int().min(1).max(200),
  driverId: objectIdSchema.optional().nullable(),
  driverName: z.string().trim().max(100).optional().default(""),
  driverPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "Invalid driver phone number")
    .optional()
    .default(""),
  routeName: z.string().trim().min(2).max(100),
  stops: z.array(stopSchema).min(1).max(100),
  status: z
    .enum(["ACTIVE", "INACTIVE", "MAINTENANCE"])
    .optional()
    .default("ACTIVE"),
  insuranceExpiry: dateSchema,
  fitnessExpiry: dateSchema,
  permitExpiry: dateSchema,
};

export const createTransportSchema = z.object({
  body: z.object(createTransportFields),
});

export const updateTransportSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      vehicleNumber: createTransportFields.vehicleNumber.optional(),
      vehicleType: createTransportFields.vehicleType.optional(),
      vehicleName: createTransportFields.vehicleName.optional(),
      capacity: createTransportFields.capacity.optional(),
      driverId: objectIdSchema.optional().nullable(),
      driverName: z.string().trim().max(100).optional(),
      driverPhone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{7,20}$/, "Invalid driver phone number")
        .optional(),
      routeName: z.string().trim().min(2).max(100).optional(),
      stops: z.array(stopSchema).min(1).max(100).optional(),
      status: z
        .enum(["ACTIVE", "INACTIVE", "MAINTENANCE"])
        .optional(),
      insuranceExpiry: dateSchema,
      fitnessExpiry: dateSchema,
      permitExpiry: dateSchema,
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
});

export const transportIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getTransportsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().trim().max(100).optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "MAINTENANCE"])
      .optional(),
    routeId: objectIdSchema.optional(),
  }),
});

export const assignStudentTransportSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    studentId: objectIdSchema,
    stopId: objectIdSchema,
  }),
});

export const removeStudentTransportSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    studentId: objectIdSchema,
  }),
});

export const getStudentTransportSchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
});
