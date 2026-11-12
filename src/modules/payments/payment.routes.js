import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";
import { createPaymentController } from "./payment.controller.js";
import { paymentSchema } from "./payment.validation.js";

const router = Router();

router.post(
  "/",
  authenticate,
  validate(paymentSchema),
  createPaymentController,
);

export default router;