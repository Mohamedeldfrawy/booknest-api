import { Router } from "express";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";
import {
  createBookController,
  deleteBookController,
  getBookController,
  listBooksController,
  updateBookController,
} from "./book.controller.js";
import {
  bookIdSchema,
  browseBooksQuerySchema,
  createBookSchema,
  updateBookSchema,
} from "./book.validation.js";

const router = Router();
const adminOnly = [authenticate, authorize("admin")];

router.get(
  "/",
  validate(browseBooksQuerySchema, "query"),
  listBooksController,
);
router.get(
  "/:id",
  validate(bookIdSchema, "params"),
  getBookController,
);
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