import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";
import {
  createOrderController,
  getOrderController,
  listOrdersController,
} from "./order.controller.js";
import { orderIdSchema } from "./order.validation.js";

const router = Router();

router.post("/", authenticate, createOrderController);
router.get("/", authenticate, listOrdersController);
router.get(
  "/:id",
  authenticate,
  validate(orderIdSchema, "params"),
  getOrderController,
);

export default router;