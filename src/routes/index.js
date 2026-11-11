import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import bookRoutes from "../modules/books/book.routes.js";
import cartRoutes from "../modules/carts/cart.routes.js";
import userRoutes from "../modules/users/user.routes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/users", authRoutes);
router.use("/books", bookRoutes);
router.use("/cart", cartRoutes);

export default router;