import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";
import {
  getCurrentUser,
  registerUser,
  updateCurrentUser,
} from "./user.controller.js";
import registerSchema, { updateProfileSchema } from "./user.validation.js";

const router = Router();

router.post("/register", validate(registerSchema), registerUser);
router.get("/me", authenticate, getCurrentUser);
router.patch(
  "/me",
  authenticate,
  validate(updateProfileSchema),
  updateCurrentUser,
);

export default router;