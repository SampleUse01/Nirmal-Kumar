import { Router } from "express";
import { authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import { listNotifications, updateNotificationStatus } from "../controllers/notificationsController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
router.get("/", authorizePermission("NOTIFICATIONS_VIEW"), listNotifications);
router.patch("/:id/status", authorizePermission("NOTIFICATIONS_MANAGE"), updateNotificationStatus);

export default router;
