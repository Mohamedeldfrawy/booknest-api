
import { rateLimit } from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  limit: 5, // 5 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    status: "error",
    message: "Too many login attempts. Please try again later.",
  },
});

export { loginLimiter };
