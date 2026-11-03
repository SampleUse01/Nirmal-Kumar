import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import {
  createAdminAccount,
  listAdminAccounts,
  listRoleAccess,
  updateAdminAccountStatus,
  updateRoleAccess
} from "../controllers/accessControlController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete, authorize("SUPER_ADMIN"));
router.get("/roles", authorizePermission("ROLE_MANAGE"), listRoleAccess);
router.patch("/roles/:role", authorizePermission("ROLE_MANAGE"), updateRoleAccess);
router.get("/admins", authorizePermission("ADMIN_MANAGE"), listAdminAccounts);
router.post("/admins", authorizePermission("ADMIN_MANAGE"), createAdminAccount);
router.patch("/admins/:id/status", authorizePermission("ADMIN_MANAGE"), updateAdminAccountStatus);

export default router;
