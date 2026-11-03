import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import {
  createEmployee,
  deactivateEmployee,
  exportEmployees,
  getEmployee,
  importEmployees,
  listEmployees,
  updateEmployee
} from "../controllers/employeesController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
router.get("/", authorizePermission("EMPLOYEES_VIEW"), listEmployees);
router.get("/export", authorize("SUPER_ADMIN"), authorizePermission("EMPLOYEES_VIEW"), exportEmployees);
router.post("/import", authorize("SUPER_ADMIN"), authorizePermission("EMPLOYEES_MANAGE"), importEmployees);
router.post("/", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("EMPLOYEES_MANAGE"), createEmployee);
router.get("/:id", authorizePermission("EMPLOYEES_VIEW"), getEmployee);
router.patch("/:id", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("EMPLOYEES_MANAGE"), updateEmployee);
router.delete("/:id", authorize("SUPER_ADMIN", "ADMIN"), authorizePermission("EMPLOYEES_MANAGE"), deactivateEmployee);

export default router;
