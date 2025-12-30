import express from "express";
import cors from "cors";
import healthRoute from "./routes/health.route.js";
import videoRoute from "./routes/videos.route.js";
import hlsRouter from "./routes/hls.route.js";
import progressRouter from "./routes/progress.route.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.use("/api", healthRoute);
app.use("/videos", videoRoute);
app.use("/hls", hlsRouter);
app.use("/progress", progressRouter);

export default app;
