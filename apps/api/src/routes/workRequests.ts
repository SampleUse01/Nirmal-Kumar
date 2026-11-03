import { Router } from "express";
import { authorize, authorizePermission, requireAuth, requirePasswordChangeComplete } from "../middleware/auth.js";
import {
  cancelWorkRequest,
  createWorkRequest,
  listWorkRequests,
  reviewWorkRequest
} from "../controllers/workRequestsController.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
router.post("/", authorizePermission("WORK_REQUESTS_SUBMIT"), createWorkRequest);
router.get("/", authorizePermission("WORK_REQUESTS_VIEW"), listWorkRequests);
router.post("/:id/cancel", authorizePermission("WORK_REQUESTS_SUBMIT"), cancelWorkRequest);
router.post(
  "/:id/review",
  authorize("SUPER_ADMIN", "ADMIN"),
  authorizePermission("WORK_REQUESTS_REVIEW"),
  reviewWorkRequest
);

export default router;
