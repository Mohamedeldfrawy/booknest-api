import express from "express";
import errorHandler from "./middleware/error-handler.js";
import notFound from "./middleware/not-found.js";
import healthRoutes from "./modules/health/health.routes.js";
import apiRoutes from "./routes/index.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("BookNest API is running");
});

app.use(healthRoutes);
app.use("/api", apiRoutes);

// Error handling must be last

app.use(notFound);
app.use(errorHandler);

export default app;