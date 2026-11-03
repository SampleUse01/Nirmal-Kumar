import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import {
  createDepartment,
  deactivateDepartment,
  exportDepartments,
  importDepartments,
  listDepartments,
  updateDepartment
} from "../controllers/departmentsController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
router.get("/", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("DEPARTMENTS_VIEW"), listDepartments);
router.get("/export", authorize("SUPER_ADMIN"), authorizePermission("DEPARTMENTS_VIEW"), exportDepartments);
router.post("/import", authorize("SUPER_ADMIN"), authorizePermission("DEPARTMENTS_MANAGE"), importDepartments);
router.post("/", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("DEPARTMENTS_MANAGE"), createDepartment);
router.patch("/:id", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("DEPARTMENTS_MANAGE"), updateDepartment);
router.delete("/:id", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("DEPARTMENTS_MANAGE"), deactivateDepartment);

export default router;
