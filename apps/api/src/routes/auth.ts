import { Router } from "express";
import { authorizePermission, requireAuth } from "../middleware/auth.js";
import {
  changePassword,
  getCurrentUser,
  getProfile,
  login,
  logout,
  refresh,
  updateProfile
} from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);
router.post("/change-password", requireAuth, changePassword);
router.get("/me", requireAuth, getCurrentUser);
router.get("/profile", requireAuth, authorizePermission("PROFILE_MANAGE"), getProfile);
router.patch("/profile", requireAuth, authorizePermission("PROFILE_MANAGE"), updateProfile);

export default router;
