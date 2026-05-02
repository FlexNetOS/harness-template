import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@postgres:5432/app";

export const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });

/**
 * pingDb — lightweight connectivity check used by /health.
 * Returns true if `SELECT 1` succeeds within `timeoutMs`.
 */
export async function pingDb(timeoutMs = 1500): Promise<boolean> {
  const timer = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), timeoutMs),
  );
  const query = pool
    .query("SELECT 1")
    .then(() => true)
    .catch(() => false);
  return Promise.race([query, timer]);
}
