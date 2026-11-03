import type { RequestHandler } from "express";
import { z } from "zod";
import { Notification } from "../models/Notification.js";
import { HttpError } from "../utils/errors.js";
import { getDateRange } from "../utils/dateFilters.js";

export const listNotifications: RequestHandler = async (request, response) => {
  const filter: Record<string, unknown> = { userId: request.authUser!.id };
  if (typeof request.query.status === "string" && ["UNREAD", "READ", "ARCHIVED"].includes(request.query.status)) {
    filter.status = request.query.status;
  }
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { message: { $regex: escaped, $options: "i" } }
    ];
  }
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(100);
  response.json({ notifications });
};

export const updateNotificationStatus: RequestHandler = async (request, response) => {
  const { status } = z.object({ status: z.enum(["READ", "ARCHIVED"]) }).parse(request.body);
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, userId: request.authUser!.id },
    { $set: { status } },
    { new: true }
  );
  if (!notification) throw new HttpError(404, "Notification not found.");
  response.json({ notification });
};
