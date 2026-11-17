
import mongoose, { FilterQuery, Types } from "mongoose";

import School, { ISchool } from "./schools.model";
import { SCHOOL_STATUS } from "../../config/constants";
import AppError from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

interface CreateSchoolData {
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: ISchool["address"];
  contact: ISchool["contact"];
  principal?: ISchool["principal"];
  affiliation?: ISchool["affiliation"];
  schoolType?: ISchool["schoolType"];
  establishedYear?: number;
}

interface SchoolListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  city?: string;
}

interface UpdateSchoolData {
  name?: string;
  code?: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: Partial<ISchool["address"]>;
  contact?: Partial<ISchool["contact"]>;
  principal?: ISchool["principal"];
  affiliation?: ISchool["affiliation"];
  branding?: ISchool["branding"];
  schoolType?: ISchool["schoolType"];
  establishedYear?: number;
  isVerified?: boolean;
}

const normalizeSchoolIdentifiers = (
  data: {
    code?: string;
    slug?: string;
    email?: string;
  }
) => ({
  ...(data.code !== undefined && {
    code: data.code.trim().toUpperCase(),
  }),
  ...(data.slug !== undefined && {
    slug: data.slug.trim().toLowerCase(),
  }),
  ...(data.email !== undefined && {
    email: data.email.trim().toLowerCase(),
  }),
});

const ensureValidId = (id: string): void => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid school ID", 400);
  }
};

const findSchoolOrFail = async (
  id: string
): Promise<ISchool> => {
  ensureValidId(id);

  const school = await School.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!school) {
    throw new AppError("School not found", 404);
  }

  return school;
};

export const createSchoolService = async (
  data: CreateSchoolData,
  userId?: string
): Promise<ISchool> => {
  const normalized = normalizeSchoolIdentifiers(data);

  const existingSchool = await School.findOne({
    isDeleted: false,
    $or: [
      { code: normalized.code },
      { slug: normalized.slug },
      { email: normalized.email },
    ],
  }).lean();

  if (existingSchool) {
    throw new AppError(
      "A school with this code, slug or email already exists",
      409
    );
  }

  return School.create({
    ...data,
    ...normalized,
    status: SCHOOL_STATUS.PENDING,
    createdBy: userId ? new Types.ObjectId(userId) : null,
  });
};

export const getAllSchoolsService = async (
  options: SchoolListOptions
) => {
  const { page, limit, skip } = getPagination(options);

  const filter: FilterQuery<ISchool> = {
    isDeleted: false,
  };

  if (options.status) {
    filter.status = options.status as ISchool["status"];
  }

  if (options.city) {
    filter["address.city"] = {
      $regex: options.city,
      $options: "i",
    };
  }

  if (options.search?.trim()) {
    const search = options.search.trim();

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

  return {
    schools,
    pagination: createPaginationMeta(page, limit, total),
  };
};

export const getSchoolByIdService = async (
  id: string
): Promise<ISchool> => {
  return findSchoolOrFail(id);
};

export const updateSchoolService = async (
  id: string,
  data: UpdateSchoolData,
  userId?: string
): Promise<ISchool> => {
  const school = await findSchoolOrFail(id);

  const normalized = normalizeSchoolIdentifiers(data);

  const duplicateConditions: Record<string, unknown>[] = [];

  if (normalized.code) {
    duplicateConditions.push({ code: normalized.code });
  }

  if (normalized.slug) {
    duplicateConditions.push({ slug: normalized.slug });
  }

  if (normalized.email) {
    duplicateConditions.push({ email: normalized.email });
  }

  if (duplicateConditions.length > 0) {
    const duplicate = await School.findOne({
      _id: { $ne: school._id },
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

  const updateData = {
    ...data,
    ...normalized,
  };

  for (const [key, value] of Object.entries(updateData)) {
    school.set(key, value);
  }

  school.updatedBy = userId
    ? new Types.ObjectId(userId)
    : null;

  await school.save();

  return school;
};

export const updateSchoolStatusService = async (
  id: string,
  status: ISchool["status"],
  userId?: string
): Promise<ISchool> => {
  ensureValidId(id);

  const school = await School.findOneAndUpdate(
    {
      _id: id,
      isDeleted: false,
    },
    {
      $set: {
        status,
        updatedBy: userId ? new Types.ObjectId(userId) : null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!school) {
    throw new AppError("School not found", 404);
  }

  return school;
};

export const deleteSchoolService = async (
  id: string,
  userId?: string
): Promise<{ schoolId: string; deletedAt: Date }> => {
  ensureValidId(id);

  const deletedAt = new Date();

  const school = await School.findOneAndUpdate(
    {
      _id: id,
      isDeleted: false,
    },
    {
      $set: {
        isDeleted: true,
        deletedAt,
        status: SCHOOL_STATUS.INACTIVE,
        updatedBy: userId ? new Types.ObjectId(userId) : null,
      },
    },
    {
      new: true,
    }
  );

  if (!school) {
    throw new AppError("School not found", 404);
  }

  return {
    schoolId: school._id.toString(),
    deletedAt,
  };
};
