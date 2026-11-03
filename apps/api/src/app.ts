import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import attendanceRoutes from "./routes/attendance.js";
import accessControlRoutes from "./routes/accessControl.js";
import auditLogRoutes from "./routes/auditLogs.js";
import authRoutes from "./routes/auth.js";
import departmentRoutes from "./routes/departments.js";
import employeeRoutes from "./routes/employees.js";
import notificationRoutes from "./routes/notifications.js";
import workRequestRoutes from "./routes/workRequests.js";
import { auditSuccessfulMutation } from "./utils/audit.js";
import { errorHandler } from "./utils/errors.js";

export const app = express();

const csrfOriginGuard: express.RequestHandler = (request, response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  if (!env.WEB_ORIGIN.includes(request.get("origin") ?? "")) {
    response.status(403).json({ message: "Request origin is not allowed." });
    return;
  }
  next();
};

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(csrfOriginGuard);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 100 }));
app.use("/api", rateLimit({ windowMs: 15 * 60_000, limit: 600 }));

app.get("/api/health", (_request, response) => {
  const connected = mongoose.connection.readyState === 1;
  response.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "degraded",
    database: connected ? "connected" : "disconnected",
    ...(connected ? {} : { message: "The API is running, but the database is unavailable. Check the API logs." })
  });
});
const requireDatabase: express.RequestHandler = (_request, response, next) => {
  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({
      message: "The database is temporarily unavailable. Check the API connection and try again."
    });
    return;
  }
  next();
};

app.use("/api/auth", requireDatabase, authRoutes);
app.use("/api", auditSuccessfulMutation);
app.use("/api/departments", requireDatabase, departmentRoutes);
app.use("/api/employees", requireDatabase, employeeRoutes);
app.use("/api/attendance", requireDatabase, attendanceRoutes);
app.use("/api/work-requests", requireDatabase, workRequestRoutes);
app.use("/api/notifications", requireDatabase, notificationRoutes);
app.use("/api/audit-logs", requireDatabase, auditLogRoutes);
app.use("/api/access", requireDatabase, accessControlRoutes);
app.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});
app.use(errorHandler);
