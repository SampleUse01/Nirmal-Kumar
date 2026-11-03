import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { PermissionKey } from "../config/permissions.js";
import { User, type Role } from "../models/User.js";
import { HttpError } from "../utils/errors.js";
import { roleHasPermission } from "../utils/rbac.js";

type SessionClaims = JwtPayload & { sub: string; version: number; role: Role };

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.accessToken;
  if (!token) {
    next(new HttpError(401, "Authentication is required."));
    return;
  }

  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as SessionClaims;
    if (!claims.sub || !Number.isInteger(claims.version)) {
      next(new HttpError(401, "The session is invalid or has expired."));
      return;
    }

    const user = await User.findById(claims.sub).select("role active tokenVersion mustChangePassword");
    if (!user || !user.active || user.tokenVersion !== claims.version) {
      next(new HttpError(401, "The session is invalid or has expired."));
      return;
    }

    request.authUser = {
      id: user.id,
      role: user.role as Role,
      mustChangePassword: user.mustChangePassword
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new HttpError(401, "The session is invalid or has expired."));
      return;
    }
    next(error);
  }
};

export const requirePasswordChangeComplete: RequestHandler = (request, _response, next) => {
  if (request.authUser?.mustChangePassword) {
    next(new HttpError(403, "Change your temporary password before continuing."));
    return;
  }
  next();
};

export function authorize(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser) {
      next(new HttpError(401, "Authentication is required."));
      return;
    }
    if (!roles.includes(request.authUser.role)) {
      next(new HttpError(403, "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

export function authorizePermission(permission: PermissionKey): RequestHandler {
  return async (request, _response, next) => {
    if (!request.authUser) {
      next(new HttpError(401, "Authentication is required."));
      return;
    }
    try {
      if (!(await roleHasPermission(request.authUser.role, permission))) {
        next(new HttpError(403, "You do not have permission to perform this action."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
