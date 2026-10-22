import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import { ApiError, errorHandler } from "./lib/http.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity: false, // TLS is terminated by the hosting platform
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
          "img-src": ["'self'", "data:", "blob:", "https:"],
          "connect-src": ["'self'"],
          "frame-src": ["https://www.google.com/maps"],
          "object-src": ["'none'"],
          "upgrade-insecure-requests": null,
          "frame-ancestors": ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cors());

  app.use("/api/admin", adminRouter);
  app.use("/api", publicRouter);
  app.use("/api", (_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "No such endpoint")));

  const here = path.dirname(fileURLToPath(import.meta.url));
  const distDir = process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : path.resolve(here, "../../frontend/dist");
  if (fs.existsSync(path.join(distDir, "index.html"))) {
    app.use(
      "/assets",
      express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
    );
    app.use(express.static(distDir, { maxAge: "1h", index: false }));
    app.get("*", (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    console.warn(`[server] frontend build not found at ${distDir}; serving API only`);
  }

  app.use(errorHandler);
  return app;
}
