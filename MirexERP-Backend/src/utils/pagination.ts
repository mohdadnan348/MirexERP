
import { Request } from "express";

import { env } from "../config/env";

/**
 * Pagination options.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Pagination metadata.
 */
export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Sort configuration.
 */
export interface SortOptions {
  sortBy: string;
  sortOrder: 1 | -1;
}

/**
 * Parse a positive integer safely.
 */
const parsePositiveInteger = (
  value: unknown,
  fallback: number
): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

/**
 * Get pagination options from request query.
 *
 * Example:
 * GET /api/v1/students?page=2&limit=20
 */
export const getPagination = (
  input: Request | { page?: unknown; limit?: unknown }
): PaginationOptions => {
  const query: { page?: unknown; limit?: unknown } =
    "query" in input
      ? (input.query as { page?: unknown; limit?: unknown })
      : input;

  const page = parsePositiveInteger(query.page, 1);

  const requestedLimit = parsePositiveInteger(
    query.limit,
    env.DEFAULT_PAGE_SIZE
  );

  const limit = Math.min(
    requestedLimit,
    env.MAX_PAGE_SIZE
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

/**
 * Create pagination metadata.
 */
export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationResult => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
};

/**
 * Get pagination metadata directly from request.
 */
export const getPaginationMeta = (
  req: Request,
  total: number
): PaginationResult => {
  const { page, limit } = getPagination(req);

  return createPaginationMeta(page, limit, total);
};

/**
 * Get safe sorting options from request query.
 *
 * allowedFields prevents users from sorting by
 * arbitrary or sensitive database fields.
 */
export const getSortOptions = (
  req: Request,
  allowedFields: string[],
  defaultSortBy = "createdAt",
  defaultSortOrder: "asc" | "desc" = "desc"
): SortOptions => {
  const requestedSortBy =
    typeof req.query.sortBy === "string"
      ? req.query.sortBy
      : defaultSortBy;

  const sortBy = allowedFields.includes(requestedSortBy)
    ? requestedSortBy
    : defaultSortBy;

  const requestedOrder =
    typeof req.query.sortOrder === "string"
      ? req.query.sortOrder.toLowerCase()
      : defaultSortOrder;

  const sortOrder: 1 | -1 =
    requestedOrder === "asc" ? 1 : -1;

  return {
    sortBy,
    sortOrder,
  };
};
