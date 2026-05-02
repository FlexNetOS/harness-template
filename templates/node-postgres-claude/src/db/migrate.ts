/**
 * migrate.ts — apply Drizzle migrations from the ./drizzle directory.
 *
 * Usage: pnpm migrate
 *
 * If no migrations exist yet, generate them with:
 *   pnpm migrate:generate
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const migrationsFolder = resolve(process.cwd(), "drizzle");

  if (!existsSync(migrationsFolder)) {
    console.log(
      `[migrate] No migrations folder at ${migrationsFolder} — run 'pnpm migrate:generate' first.`,
    );
    await pool.end();
    return;
  }

  console.log(`[migrate] Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
