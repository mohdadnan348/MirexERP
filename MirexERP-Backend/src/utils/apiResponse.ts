
import { Response } from "express";

/**
 * Standard API success response structure.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  statusCode: number;
  timestamp: string;
}

/**
 * Pagination metadata.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated API response structure.
 */
export interface PaginatedApiResponse<T> {
  success: true;
  message: string;
  data: T[];
  pagination: PaginationMeta;
  statusCode: number;
  timestamp: string;
}

/**
 * Send a standardized success response.
 *
 * Example:
 * sendSuccess(res, "Student created successfully.", student, 201);
 */
export const sendSuccess = <T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200
): Response<ApiSuccessResponse<T>> => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a standardized paginated success response.
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  message: string,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200
): Response<PaginatedApiResponse<T>> => {
  const response: PaginatedApiResponse<T> = {
    success: true,
    message,
    data,
    pagination,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a success response without data.
 */
export const sendMessage = (
  res: Response,
  message: string,
  statusCode = 200
): Response<ApiSuccessResponse<null>> => {
  return sendSuccess(res, message, null, statusCode);
};

/**
 * Send a resource creation response.
 */
export const sendCreated = <T>(
  res: Response,
  message: string,
  data: T
): Response<ApiSuccessResponse<T>> => {
  return sendSuccess(res, message, data, 201);
};

/**
 * Send a resource deletion response.
 */
export const sendDeleted = (
  res: Response,
  message = "Resource deleted successfully."
): Response<ApiSuccessResponse<null>> => {
  return sendMessage(res, message, 200);
};

/** Compatibility helper for legacy module controllers. */
export const success = <T>(res: Response, data: T, message = "Success", statusCode = 200): Response => {
  return res.status(statusCode).json({ success: true, message, data, statusCode, timestamp: new Date().toISOString() });
};
