
import { Request, Response } from "express";
import mongoose from "mongoose";

import School from "./schools.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";

import {
  sendCreated,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";

import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import { getValidatedData } from "../../middleware/validate";
import { SCHOOL_STATUS } from "../../config/constants";
import Session from "../sessions/sessions.model";

interface SchoolBody {
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: {
    street?: string;
    area?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  contact: {
    phone: string;
    alternatePhone?: string;
    email: string;
    website?: string;
  };
  principal?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  affiliation?: {
    board?: string;
    affiliationNumber?: string;
    recognitionNumber?: string;
  };
  schoolType?: "PUBLIC" | "PRIVATE" | "GOVERNMENT" | "OTHER";
  establishedYear?: number;
  timezone?: string;
  currency?: string;
}

interface SchoolUpdateBody extends Record<string, unknown> {
  name?: string;
  code?: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  principal?: Record<string, unknown>;
  affiliation?: Record<string, unknown>;
  branding?: Record<string, unknown>;
  establishedYear?: number;
  schoolType?: "PUBLIC" | "PRIVATE" | "GOVERNMENT" | "OTHER";
  isVerified?: boolean;
  timezone?: string;
  currency?: string;
}

interface SchoolListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  city?: string;
}

// CREATE SCHOOL
export const createSchool = asyncHandler(
  async (req: Request, res: Response) => {
    const input = getValidatedData<SchoolBody>(
      res,
      "body"
    );

    const normalizedCode = input.code.trim().toUpperCase();
    const normalizedSlug = input.slug.trim().toLowerCase();
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingSchool = await School.findOne({
      isDeleted: false,
      $or: [
        { code: normalizedCode },
        { slug: normalizedSlug },
        { email: normalizedEmail },
      ],
    }).lean();

    if (existingSchool) {
      throw new AppError(
        "A school with this code, slug or email already exists",
        409
      );
    }

    const school = await School.create({
      ...input,
      code: normalizedCode,
      slug: normalizedSlug,
      email: normalizedEmail,
      status: SCHOOL_STATUS.PENDING,
      statusHistory: [{
        status: SCHOOL_STATUS.PENDING,
        changedBy: req.user?.userId && mongoose.isValidObjectId(req.user.userId)
          ? new mongoose.Types.ObjectId(req.user.userId)
          : null,
        changedAt: new Date(),
        reason: "School registered",
      }],
      createdBy: req.user?.userId
        ? new mongoose.Types.ObjectId(req.user.userId)
        : null,
    });

    return sendCreated(
      res,
      "School created successfully",
      school
    );
  }
);

// GET ALL SCHOOLS
export const getAllSchools = asyncHandler(
  async (req: Request, res: Response) => {
    const query = getValidatedData<SchoolListQuery>(
      res,
      "query"
    );

    const { page, limit, skip } = getPagination({
      page: query.page,
      limit: query.limit,
    });

    const filter: Record<string, unknown> = {
      isDeleted: false,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.city) {
      filter["address.city"] = {
        $regex: query.city,
        $options: "i",
      };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        {
          "address.city": {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [schools, total] = await Promise.all([
      School.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      School.countDocuments(filter),
    ]);

    const pagination = createPaginationMeta(
      page,
      limit,
      total
    );

    return sendPaginatedSuccess(
      res,
      "Schools fetched successfully",
      schools,
      pagination
    );
  }
);

// GET SCHOOL BY ID
export const getSchoolById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid school ID", 400);
    }

    const school = await School.findOne({
      _id: id,
      isDeleted: false,
    }).lean();

    if (!school) {
      throw new AppError("School not found", 404);
    }

    return sendSuccess(
      res,
      "School details fetched successfully",
      school
    );
  }
);

// UPDATE SCHOOL
export const updateSchool = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid school ID", 400);
    }

    const input = getValidatedData<SchoolUpdateBody>(
      res,
      "body"
    );

    const school = await School.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!school) {
      throw new AppError("School not found", 404);
    }

    const protectedFields = [
      "_id",
      "status",
      "isDeleted",
      "deletedAt",
      "subscriptionId",
      "subscriptionExpiresAt",
      "createdBy",
      "createdAt",
      "updatedAt",
    ];

    for (const field of protectedFields) {
      if (field in input) {
        throw new AppError(
          `You cannot update the ${field} field through this endpoint`,
          400
        );
      }
    }

    const duplicateConditions: Record<string, unknown>[] = [];

    if (input.code) {
      duplicateConditions.push({
        code: input.code.trim().toUpperCase(),
      });
    }

    if (input.slug) {
      duplicateConditions.push({
        slug: input.slug.trim().toLowerCase(),
      });
    }

    if (input.email) {
      duplicateConditions.push({
        email: input.email.trim().toLowerCase(),
      });
    }

    if (duplicateConditions.length > 0) {
      const duplicate = await School.findOne({
        _id: { $ne: id },
        isDeleted: false,
        $or: duplicateConditions,
      }).lean();

      if (duplicate) {
        throw new AppError(
          "School code, slug or email is already in use",
          409
        );
      }
    }

    if (input.affiliation?.board && input.affiliation.board !== school.affiliation?.board) {
      const activeSession = await Session.findOne({ schoolId: school._id, isActive: true, isDeleted: false }).select("_id").lean();
      if (activeSession) throw new AppError("Board changes are blocked during an active academic session. Close the current session before changing the board.", 409);
    }

    const allowedFields = [
      "name",
      "code",
      "slug",
      "email",
      "phone",
      "address",
      "contact",
      "principal",
      "affiliation",
      "branding",
      "establishedYear",
      "schoolType",
      "isVerified",
      "timezone",
      "currency",
    ];

    for (const field of allowedFields) {
      if (field in input) {
        const value = input[field];

        if (field === "code" && typeof value === "string") {
          school.code = value.trim().toUpperCase();
        } else if (
          field === "slug" &&
          typeof value === "string"
        ) {
          school.slug = value.trim().toLowerCase();
        } else if (
          field === "email" &&
          typeof value === "string"
        ) {
          school.email = value.trim().toLowerCase();
        } else {
          school.set(field, value);
        }
      }
    }

    school.updatedBy = req.user?.userId
      ? new mongoose.Types.ObjectId(req.user.userId)
      : null;

    await school.save();

    return sendSuccess(
      res,
      "School updated successfully",
      school
    );
  }
);

// UPDATE SCHOOL STATUS
export const updateSchoolStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid school ID", 400);
    }

    const input = getValidatedData<{
      status: string;
      reason?: string;
    }>(res, "body");

    const allowedStatuses = Object.values(SCHOOL_STATUS);

    if (!allowedStatuses.includes(input.status as never)) {
      throw new AppError("Invalid school status", 400);
    }

    const school = await School.findOne({ _id: id, isDeleted: false });
    if (school) {
      const changedBy = req.user?.userId && mongoose.isValidObjectId(req.user.userId)
        ? new mongoose.Types.ObjectId(req.user.userId)
        : null;
      if (school.status !== input.status) {
        school.status = input.status as typeof school.status;
        school.statusHistory.push({ status: school.status, changedBy, changedAt: new Date(), reason: input.reason });
      }
      school.updatedBy = changedBy;
      await school.save();
    }

    if (!school) {
      throw new AppError("School not found", 404);
    }

    return sendSuccess(
      res,
      "School status updated successfully",
      school
    );
  }
);

// DELETE SCHOOL (SOFT DELETE)
export const deleteSchool = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid school ID", 400);
    }

    const school = await School.findOneAndUpdate(
      {
        _id: id,
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          status: SCHOOL_STATUS.INACTIVE,
          updatedBy: req.user?.userId
            ? new mongoose.Types.ObjectId(req.user.userId)
            : null,
        },
      },
      {
        new: true,
      }
    );

    if (!school) {
      throw new AppError("School not found", 404);
    }

    return sendSuccess(
      res,
      "School deleted successfully",
      {
        schoolId: school._id,
        deletedAt: school.deletedAt,
      }
    );
  }
);
