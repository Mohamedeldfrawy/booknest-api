import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";
import {
  addCartItemController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from "./cart.controller.js";
import {
  addCartItemSchema,
  cartItemParamsSchema,
  updateCartItemSchema,
} from "./cart.validation.js";

const router = Router();

router.get("/", authenticate, getCartController);

router.post(
  "/items",
  authenticate,
  validate(addCartItemSchema),
  addCartItemController,
);
router.patch(
  "/items/:bookId",
  authenticate,
  validate(cartItemParamsSchema, "params"),
  validate(updateCartItemSchema),
  updateCartItemController,
);
router.delete(
  "/items/:bookId",
  authenticate,
  validate(cartItemParamsSchema, "params"),
  removeCartItemController,
);

export default router;