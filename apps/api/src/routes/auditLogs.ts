import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import { exportAuditLogs, listAuditLogs } from "../controllers/auditLogsController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete, authorize("SUPER_ADMIN"), authorizePermission("AUDIT_VIEW"));
router.get("/", listAuditLogs);
router.get("/export", exportAuditLogs);

export default router;
