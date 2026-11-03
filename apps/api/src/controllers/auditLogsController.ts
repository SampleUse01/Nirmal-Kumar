import type { RequestHandler } from "express";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { getDateRange, toCsv } from "../utils/dateFilters.js";

async function getAuditFilter(request: Parameters<RequestHandler>[0]) {
  const filter: Record<string, unknown> = {};
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches: Record<string, unknown>[] = [
      { action: { $regex: escaped, $options: "i" } },
      { module: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
      { ipAddress: { $regex: escaped, $options: "i" } },
      { role: { $regex: escaped, $options: "i" } }
    ];
    const users = await User.find({ email: { $regex: escaped, $options: "i" } }).select("_id");
    if (users.length) matches.push({ userId: { $in: users.map((user) => user._id) } });
    filter.$or = matches;
  }
  return filter;
}

export const listAuditLogs: RequestHandler = async (request, response) => {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
  const filter = await getAuditFilter(request);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter)
  ]);
  response.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const exportAuditLogs: RequestHandler = async (request, response) => {
  const logs = await AuditLog.find(await getAuditFilter(request))
    .populate("userId", "email role")
    .sort({ createdAt: -1 });
  response.type("text/csv").attachment("audit-logs.csv").send(toCsv(
    ["timestamp", "user", "role", "action", "module", "description", "ipAddress"],
    logs.map((log) => {
      const user = log.userId as unknown as { email?: string } | null;
      return [log.createdAt, user?.email ?? "Deleted account", log.role, log.action, log.module, log.description, log.ipAddress];
    })
  ));
};
