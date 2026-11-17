
import jwt, {
  JwtPayload,
  SignOptions,
} from "jsonwebtoken";

import { env } from "../config/env";
import { TOKEN_TYPES, UserRole } from "../config/constants";
import { AppError } from "./AppError";

/**
 * JWT token payload.
 */
export interface TokenPayload {
  sub: string;
  role: UserRole;
  schoolId: string | null;
  tokenType: string;
}

/**
 * Generated authentication tokens.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Common JWT signing configuration.
 */
const JWT_ALGORITHM: SignOptions["algorithm"] = "HS256";

/**
 * Generate an access token.
 *
 * Compatible with authenticate.ts:
 * - sub
 * - role
 * - schoolId
 * - tokenType
 */
export const generateAccessToken = (
  userId: string,
  role: UserRole,
  schoolId: string | null
): string => {
  if (!userId || !role) {
    throw new AppError(
      "User ID and role are required to generate an access token.",
      400
    );
  }

  if (role !== "SUPER_ADMIN" && !schoolId) {
    throw new AppError(
      "School ID is required for school users.",
      400
    );
  }

  const payload: TokenPayload = {
    sub: userId,
    role,
    schoolId,
    tokenType: TOKEN_TYPES.ACCESS,
  };

  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: JWT_ALGORITHM,
  };

  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    options
  );
};

/**
 * Generate a refresh token.
 *
 * Refresh tokens must be validated separately
 * and should be stored in a server-side session.
 */
export const generateRefreshToken = (
  userId: string,
  role: UserRole,
  schoolId: string | null
): string => {
  if (!userId || !role) {
    throw new AppError(
      "User ID and role are required to generate a refresh token.",
      400
    );
  }

  if (role !== "SUPER_ADMIN" && !schoolId) {
    throw new AppError(
      "School ID is required for school users.",
      400
    );
  }

  const payload: TokenPayload = {
    sub: userId,
    role,
    schoolId,
    tokenType: TOKEN_TYPES.REFRESH,
  };

  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: JWT_ALGORITHM,
  };

  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    options
  );
};

/**
 * Generate both authentication tokens.
 */
export const generateAuthTokens = (
  userId: string,
  role: UserRole,
  schoolId: string | null
): AuthTokens => {
  return {
    accessToken: generateAccessToken(
      userId,
      role,
      schoolId
    ),
    refreshToken: generateRefreshToken(
      userId,
      role,
      schoolId
    ),
  };
};

/**
 * Verify an access token.
 */
export const verifyAccessToken = (
  token: string
): JwtPayload & TokenPayload => {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    if (
      typeof decoded === "string" ||
      decoded.tokenType !== TOKEN_TYPES.ACCESS ||
      typeof decoded.sub !== "string" ||
      typeof decoded.role !== "string" ||
      !(
        decoded.schoolId === null ||
        typeof decoded.schoolId === "string"
      )
    ) {
      throw new AppError("Invalid access token.", 401);
    }

    return decoded as JwtPayload & TokenPayload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Access token has expired.", 401);
    }

    throw new AppError("Invalid access token.", 401);
  }
};

/**
 * Verify a refresh token.
 */
export const verifyRefreshToken = (
  token: string
): JwtPayload & TokenPayload => {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_REFRESH_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    if (
      typeof decoded === "string" ||
      decoded.tokenType !== TOKEN_TYPES.REFRESH ||
      typeof decoded.sub !== "string" ||
      typeof decoded.role !== "string" ||
      !(
        decoded.schoolId === null ||
        typeof decoded.schoolId === "string"
      )
    ) {
      throw new AppError("Invalid refresh token.", 401);
    }

    return decoded as JwtPayload & TokenPayload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Refresh token has expired.", 401);
    }

    throw new AppError("Invalid refresh token.", 401);
  }
};
