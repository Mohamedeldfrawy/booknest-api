import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";
import {
  createBookController,
  deleteBookController,
  updateBookController,
} from "./book.controller.js";
import {
  bookIdSchema,
  createBookSchema,
  updateBookSchema,
} from "./book.validation.js";

const router = Router();
const adminOnly = [authenticate, authorize("admin")];

router.post(
  "/",
  ...adminOnly,
  validate(createBookSchema),
  createBookController,
);
router.patch(
  "/:id",
  ...adminOnly,
  validate(bookIdSchema, "params"),
  validate(updateBookSchema),
  updateBookController,
);
router.delete(
  "/:id",
  ...adminOnly,
  validate(bookIdSchema, "params"),
  deleteBookController,
);

export default router;