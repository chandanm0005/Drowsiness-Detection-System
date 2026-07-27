import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createServer as createNetServer } from "net";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Respect explicit PORT in production. In development, prefer a stable default
  // and probe nearby ports to avoid crashing on EADDRINUSE.
  const requestedPort = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : undefined;
  if (requestedPort !== undefined && Number.isNaN(requestedPort)) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const initialPort = requestedPort ?? (isDevelopment ? 5030 : 5000);
  const maxRetries = requestedPort
    ? (isDevelopment ? 20 : 0)
    : 20;

  const isPortAvailable = (port: number) =>
    new Promise<boolean>((resolve) => {
      const tester = createNetServer();

      tester.once("error", (err: NodeJS.ErrnoException) => {
        resolve(false);
      });

      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });

      tester.listen({ port, host: "0.0.0.0" });
    });

  let port = initialPort;
  if (maxRetries > 0) {
    while (port <= initialPort + maxRetries) {
      const available = await isPortAvailable(port);
      if (available) {
        break;
      }

      const nextPort = port + 1;
      if (nextPort <= initialPort + maxRetries) {
        log(`port ${port} in use, retrying on ${nextPort}`);
      }
      port = nextPort;
    }
  }

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
