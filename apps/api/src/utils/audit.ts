import type { Request, RequestHandler } from "express";
import { AuditLog } from "../models/AuditLog.js";

interface AuditEntry {
  userId?: string | null;
  role: string;
  action: string;
  module: string;
  description: string;
  ipAddress?: string;
}

export async function writeAudit(entry: AuditEntry) {
  await AuditLog.create({
    userId: entry.userId ?? null,
    role: entry.role,
    action: entry.action,
    module: entry.module,
    description: entry.description.slice(0, 1000),
    ipAddress: entry.ipAddress?.slice(0, 64) ?? ""
  });
}

function moduleForPath(request: Request) {
  const segments = request.path.split("/").filter(Boolean);
  const segment = (segments[0]?.toLowerCase() === "api" ? segments[1] : segments[0]) ?? "API";
  return segment.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase().slice(0, 80);
}

export const auditSuccessfulMutation: RequestHandler = (request, response, next) => {
  const method = request.method.toUpperCase();
  const isExport = method === "GET" && request.path.endsWith("/export");
  if (!isExport && !["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }
  const path = request.path;
  if (["/auth", "/work-requests", "/notifications", "/audit-logs", "/access"].some((prefix) => path.startsWith(prefix))) {
    next();
    return;
  }
  response.once("finish", () => {
    if (response.statusCode < 200 || response.statusCode >= 400) return;
    const action = isExport
      ? "EXPORT"
      : path.endsWith("/import")
        ? "IMPORT"
        : method === "POST" ? "CREATE" : method === "DELETE" ? "DELETE" : "UPDATE";
    void writeAudit({
      userId: request.authUser?.id,
      role: request.authUser?.role ?? "UNKNOWN",
      action,
      module: moduleForPath(request),
      description: `${action} ${request.method} ${request.originalUrl.split("?")[0]} completed.`,
      ipAddress: request.ip
    }).catch((error: unknown) => console.error("Could not write audit log.", error));
  });
  next();
};
