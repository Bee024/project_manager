import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import {
  apiRateLimiter,
  securityHeaders,
} from "./middlewares/security.middleware.js";
import authRouter from "./routes/auth.routes.js";
import healthCheckRouter from "./routes/healthcheck.routes.js";
import noteRouter from "./routes/note.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import { ApiError } from "./utils/api-error.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const corsOptions = {
  origin(origin, callback) {
    // read at request time so dotenv is already loaded
    const allowedOrigins = (
      process.env.CORS_ORIGIN ||
      "http://localhost:5173,http://localhost:3000,http://localhost:8000,https://manager-alpha-taupe.vercel.app"
    )
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    // wildcard: allow any origin — but reflect the actual origin back so
    // credentials: true still works (browsers reject "*" + credentials)
    if (allowedOrigins.includes("*")) {
      callback(null, origin || true);
      return;
    }
    // allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(403, "Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// cors must be first — handles preflight OPTIONS before anything else
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// basic configuration
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static(publicDir));
app.use(cookieParser());

app.use("/api", apiRateLimiter());

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

app.use("/api", notFoundHandler);

// Serve the SPA for every non-API route.
// Injects the backend URL so the browser knows where to send requests
// when the frontend is hosted on a different origin (e.g. Vercel static).
const htmlPath = path.join(publicDir, "index.html");

app.get(/.*/, (req, res) => {
  const serverUrl = (process.env.SERVER_URL || "").trim();

  if (!serverUrl) {
    // Same-origin (local dev) — serve file as-is
    res.sendFile(htmlPath);
    return;
  }

  try {
    const html = readFileSync(htmlPath, "utf8");
    const injected = html.replace(
      'window.API_BASE_URL = ""',
      `window.API_BASE_URL = ${JSON.stringify(serverUrl)}`,
    );
    res.setHeader("Content-Type", "text/html");
    res.send(injected);
  } catch {
    res.sendFile(htmlPath);
  }
});

app.use(errorHandler);

export default app;
