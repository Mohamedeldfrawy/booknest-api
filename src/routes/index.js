import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/users", authRoutes);

export default router;