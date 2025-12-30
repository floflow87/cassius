import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { 
  createRequestContext, 
  runWithContext, 
  recordEndpointStats, 
  formatContextSummary,
  getTopSlowestEndpoints,
  getTopDbHeavyEndpoints,
  getAllStats,
  clearStats
} from "./instrumentation";

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

setupAuth(app);

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
  const context = createRequestContext();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  let responseSize = 0;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    const jsonStr = JSON.stringify(bodyJson);
    responseSize = jsonStr.length;
    const duration = Date.now() - context.startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - context.startTime;
    
    if (path.startsWith("/api")) {
      recordEndpointStats(req.method, path, context);
      
      const summary = formatContextSummary(context);
      let logLine = `${req.method} ${path} ${res.statusCode} ${summary}`;
      if (responseSize > 0) {
        logLine += ` size=${Math.round(responseSize / 1024)}KB`;
      }
      
      if (duration > 500) {
        logLine += ' [SLOW]';
      }
      if (context.dbQueries.length > 10) {
        logLine += ' [MANY_QUERIES]';
      }

      log(logLine);
    }
  });

  runWithContext(context, () => next());
});

(async () => {
  await registerRoutes(httpServer, app);

  // Gestionnaire d'erreurs global - robuste pour contexte SaaS médical
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    // Si les headers ont déjà été envoyés, déléguer à Express
    if (res.headersSent) {
      return next(err);
    }

    // Logger l'erreur côté serveur
    console.error("Unhandled error:", err);

    // Déterminer le code de statut
    const status = err.status || err.statusCode || 500;

    // Construire la réponse d'erreur structurée
    const errorResponse: { error: string; message: string; details?: any } = {
      error: status >= 500 ? "InternalServerError" : "RequestError",
      message: err.message || "Internal Server Error",
    };

    // En développement, inclure plus de détails
    if (process.env.NODE_ENV !== "production" && err.stack) {
      errorResponse.details = err.stack;
    }

    res.status(status).json(errorResponse);
    // Ne pas relancer l'erreur - la réponse a été envoyée
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
