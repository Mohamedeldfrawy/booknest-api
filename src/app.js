import express from "express";
import errorHandler from "./middleware/error-handler.js";
import notFound from "./middleware/not-found.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("BookNest API is running");
});
import healthRoutes from "./modules/health/health.routes.js";
app.use(healthRoutes);

// Error handling must be last

app.use(notFound);
app.use(errorHandler);

export default app;