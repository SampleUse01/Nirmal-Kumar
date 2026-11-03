import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import {
  checkIn,
  checkOut,
  exportAttendance,
  exportAttendanceSummary,
  getAttendanceSummary,
  getTeamTodayAttendance,
  getTodayAttendance,
  listAttendance
} from "../controllers/attendanceController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
router.get("/export", exportAttendance);
router.get("/summary/export", exportAttendanceSummary);
router.get("/summary", getAttendanceSummary);
router.get("/today", getTodayAttendance);
router.get("/", listAttendance);
router.post("/check-in", authorize("EMPLOYEE"), authorizePermission("ATTENDANCE_SELF"), checkIn);
router.post("/check-out", authorize("EMPLOYEE"), authorizePermission("ATTENDANCE_SELF"), checkOut);
router.get(
  "/team/today",
  authorize("SUPER_ADMIN", "ADMIN"),
  authorizePermission("ATTENDANCE_TEAM"),
  getTeamTodayAttendance
);

export default router;
