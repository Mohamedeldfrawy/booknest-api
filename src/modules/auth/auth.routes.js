import { Router } from "express";
import validate from "../../middleware/validate.js";
import { loginUser } from "./auth.controller.js";
import loginSchema from "./auth.validation.js";
import { loginLimiter } from "../../middleware/rate-limiter.js";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), loginUser);

export default router;