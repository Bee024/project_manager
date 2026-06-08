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

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8000",
  "https://manager-alpha-taupe.vercel.app",
  "https://project-manager-aktgugi32-bee024s-projects.vercel.app",
];

const defaultCorsOriginPatterns = [
  /^https:\/\/project-manager-[a-z0-9-]+-bee024s-projects\.vercel\.app$/i,
];

const normalizeOrigin = (value = "") => {
  const trimmed = String(value).trim();

  if (!trimmed) return "";
  if (trimmed === "*") return "*";

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(candidate).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
};

const parseOriginList = (value = "") => {
  return String(value).split(",").map(normalizeOrigin).filter(Boolean);
};

const getAllowedOrigins = () => {
  return [
    ...new Set(
      [
        ...defaultCorsOrigins,
        ...parseOriginList(process.env.CORS_ORIGIN),
        ...parseOriginList(process.env.CORS_ORIGINS),
        process.env.FRONTEND_URL,
        process.env.CLIENT_URL,
        process.env.SERVER_URL,
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ]
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  ];
};

const getAllowedOriginPatterns = () => {
  return [
    ...defaultCorsOriginPatterns,
    ...parseOriginList(process.env.CORS_ORIGIN_PATTERNS)
      .map((pattern) => {
        try {
          return new RegExp(pattern);
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  ];
};

const isAllowedOrigin = (origin) => {
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes("*")) return true;
  if (allowedOrigins.includes(origin)) return true;

  return getAllowedOriginPatterns().some((pattern) => pattern.test(origin));
};

const normalizeApiBaseUrl = (value = "") =>
  String(value).trim().replace(/\/+$/, "");

const corsOptions = {
  origin(origin, callback) {
    // Wildcard origins must reflect the request origin when credentials are on.
    if (getAllowedOrigins().includes("*")) {
      callback(null, origin || true);
      return;
    }

    // Allow requests with no origin, such as curl and server-to-server calls.
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, "Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

// CORS must be first so preflight OPTIONS is handled before anything else.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Basic configuration
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
// Inject the backend URL when the frontend is hosted on a different origin.
const htmlPath = path.join(publicDir, "index.html");

app.get(/.*/, (req, res) => {
  const apiBaseUrl = normalizeApiBaseUrl(process.env.API_BASE_URL || "");

  if (!apiBaseUrl) {
    // Same-origin deployment or local dev.
    res.sendFile(htmlPath);
    return;
  }

  try {
    const html = readFileSync(htmlPath, "utf8");
    const injected = html.replace(
      /window\.API_BASE_URL\s*=\s*["'][^"']*["']\s*;/,
      `window.API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`,
    );
    res.setHeader("Content-Type", "text/html");
    res.send(injected);
  } catch {
    res.sendFile(htmlPath);
  }
});

app.use(errorHandler);

export default app;
