import express, { type Express, type Request, type Response } from "express";
import { pingDb } from "./db/client.js";

/**
 * Build an Express app instance. Exported separately from `index.ts` so tests
 * can import the app without booting a listener.
 */
export function buildApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req: Request, res: Response) => {
    const dbOk = await pingDb();
    const status = dbOk ? 200 : 503;
    res.status(status).json({
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "ok" : "unreachable",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "node-postgres-claude-app",
      message: "Spawned from harness-template. See /health.",
    });
  });

  return app;
}
