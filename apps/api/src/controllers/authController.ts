import type { RequestHandler, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { Employee } from "../models/Employee.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/errors.js";
import { writeAudit } from "../utils/audit.js";
import { getRolePermissions } from "../utils/rbac.js";

const loginSchema = z.object({
  email: z.string().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128)
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/,
    "Use 8-128 characters with uppercase, lowercase, a number, and a special character."
  ),
  confirmPassword: z.string().min(1).max(128)
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "New password and confirmation do not match."
});
const profileSchema = z.object({
  email: z.string().email().max(254).transform((email) => email.toLowerCase()).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional()
});

function tokenPair(user: { id: string; role: string; tokenVersion: number }) {
  const claims = { sub: user.id, role: user.role, version: user.tokenVersion };
  return {
    accessToken: jwt.sign(claims, env.JWT_ACCESS_SECRET, {
      expiresIn: env.ACCESS_TOKEN_MINUTES * 60
    }),
    refreshToken: jwt.sign(claims, env.JWT_REFRESH_SECRET, {
      expiresIn: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60
    })
  };
}

function setSessionCookies(response: Response, tokens: ReturnType<typeof tokenPair>) {
  const secure = env.NODE_ENV === "production";
  const sameSite = secure ? "none" : "strict";
  response.cookie("accessToken", tokens.accessToken, {
    httpOnly: true, secure, sameSite, path: "/", maxAge: env.ACCESS_TOKEN_MINUTES * 60_000
  });
  response.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true, secure, sameSite, path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60_000
  });
}

function clearSessionCookies(response: Response) {
  const secure = env.NODE_ENV === "production";
  const sameSite = secure ? "none" : "strict";
  response.clearCookie("accessToken", { httpOnly: true, secure, sameSite, path: "/" });
  response.clearCookie("refreshToken", {
    httpOnly: true, secure, sameSite, path: "/api/auth"
  });
}

export const login: RequestHandler = async (request, response) => {
  const { email, password } = loginSchema.parse(request.body);
  const user = await User.findOne({ email }).select("+passwordHash");
  const now = new Date();
  const genericError = new HttpError(401, "Email or password is incorrect.");
  if (!user || !user.active) {
    await writeAudit({
      userId: user?.id, role: user?.role ?? "UNKNOWN", action: "LOGIN_FAILED", module: "AUTH",
      description: "Sign-in failed for an unknown or inactive account.", ipAddress: request.ip
    });
    throw genericError;
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    await writeAudit({
      userId: user.id, role: user.role, action: "LOGIN_BLOCKED", module: "AUTH",
      description: "Sign-in was blocked because the account is temporarily locked.", ipAddress: request.ip
    });
    throw new HttpError(423, "This account is temporarily locked. Try again later.");
  }
  if (user.lockedUntil && user.lockedUntil <= now) {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 10) {
      user.lockedUntil = new Date(now.getTime() + 15 * 60_000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    await writeAudit({
      userId: user.id, role: user.role, action: "LOGIN_FAILED", module: "AUTH",
      description: "Sign-in failed because the password was incorrect.", ipAddress: request.ip
    });
    throw genericError;
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  await writeAudit({
    userId: user.id, role: user.role, action: "LOGIN", module: "AUTH",
    description: "User signed in.", ipAddress: request.ip
  });
  setSessionCookies(response, tokenPair({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }));
  response.json({ user: { id: user.id, email: user.email, role: user.role } });
};

export const refresh: RequestHandler = async (request, response, next) => {
  const refreshToken = request.cookies?.refreshToken as string | undefined;
  if (!refreshToken) {
    next(new HttpError(401, "A refresh session is required."));
    return;
  }
  let claims: JwtPayload;
  try {
    claims = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      clearSessionCookies(response);
      next(new HttpError(401, "The refresh session is invalid or has expired."));
      return;
    }
    next(error);
    return;
  }
  if (typeof claims.sub !== "string" || !Number.isInteger(claims.version)) {
    clearSessionCookies(response);
    next(new HttpError(401, "The refresh session is invalid or has expired."));
    return;
  }
  const user = await User.findOneAndUpdate(
    { _id: claims.sub, active: true, tokenVersion: claims.version },
    { $inc: { tokenVersion: 1 } }, { new: true }
  );
  if (!user) {
    clearSessionCookies(response);
    next(new HttpError(401, "The refresh session is invalid or has expired."));
    return;
  }
  setSessionCookies(response, tokenPair({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }));
  response.json({
    user: {
      id: user.id, email: user.email, role: user.role,
      mustChangePassword: user.mustChangePassword
    }
  });
};

export const logout: RequestHandler = async (request, response) => {
  await User.findByIdAndUpdate(request.authUser!.id, { $inc: { tokenVersion: 1 } });
  await writeAudit({
    userId: request.authUser!.id, role: request.authUser!.role, action: "LOGOUT",
    module: "AUTH", description: "User signed out.", ipAddress: request.ip
  });
  clearSessionCookies(response);
  response.status(204).end();
};

export const changePassword: RequestHandler = async (request, response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
  const user = await User.findById(request.authUser!.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Current password is incorrect.");
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new HttpError(400, "Choose a password you have not used before.");
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  await user.save();
  await writeAudit({
    userId: user.id, role: user.role, action: "PASSWORD_CHANGE", module: "AUTH",
    description: "User changed their password.", ipAddress: request.ip
  });
  setSessionCookies(response, tokenPair({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }));
  const employee = await Employee.findOne({ userId: user.id }).select("employeeId name");
  response.json({
    user: { id: user.id, email: user.email, role: user.role, mustChangePassword: false, employee: employee ?? null }
  });
};

export const getCurrentUser: RequestHandler = async (request, response) => {
  const user = await User.findById(request.authUser!.id).select("email role mustChangePassword");
  if (!user) throw new HttpError(401, "The session is invalid or has expired.");
  const employee = await Employee.findOne({ userId: user.id }).select("employeeId name");
  response.json({
    user: {
      id: user.id, email: user.email, role: user.role,
      permissions: await getRolePermissions(user.role),
      mustChangePassword: user.mustChangePassword, employee: employee ?? null
    }
  });
};

export const getProfile: RequestHandler = async (request, response) => {
  if (request.authUser!.mustChangePassword) throw new HttpError(403, "Change your temporary password before continuing.");
  const user = await User.findById(request.authUser!.id).select("email role");
  if (!user) throw new HttpError(401, "The session is invalid or has expired.");
  const employee = await Employee.findOne({ userId: user.id }).select(
    "employeeId name email phone address designation departmentId joiningDate"
  ).populate("departmentId", "name");
  response.json({ profile: { id: user.id, email: user.email, role: user.role, employee: employee ?? null } });
};

export const updateProfile: RequestHandler = async (request, response) => {
  if (request.authUser!.mustChangePassword) throw new HttpError(403, "Change your temporary password before continuing.");
  const input = profileSchema.parse(request.body);
  if (Object.keys(input).length === 0) throw new HttpError(400, "Provide at least one profile field to update.");
  const user = await User.findById(request.authUser!.id).select("email role");
  if (!user) throw new HttpError(401, "The session is invalid or has expired.");
  const employee = await Employee.findOne({ userId: user.id });
  const previousEmail = user.email;
  const nextEmail = input.email ?? previousEmail;
  const emailChanged = nextEmail !== previousEmail;
  if (emailChanged) {
    user.email = nextEmail;
    await user.save();
  }
  if (employee) {
    if (input.name !== undefined) employee.name = input.name;
    if (input.phone !== undefined) employee.phone = input.phone;
    if (input.address !== undefined) employee.address = input.address;
    if (emailChanged) employee.email = nextEmail;
    try {
      await employee.save();
    } catch (error) {
      if (emailChanged) {
        try {
          user.email = previousEmail;
          await user.save();
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "Profile update failed and the account email could not be rolled back.");
        }
      }
      throw error;
    }
  }
  const updatedEmployee = await Employee.findOne({ userId: user.id }).select(
    "employeeId name email phone address designation departmentId joiningDate"
  ).populate("departmentId", "name");
  await writeAudit({
    userId: user.id, role: user.role, action: "UPDATE", module: "PROFILE",
    description: "User updated their profile.", ipAddress: request.ip
  });
  response.json({ profile: { id: user.id, email: user.email, role: user.role, employee: updatedEmployee ?? null } });
};
