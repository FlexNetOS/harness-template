import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock the db client BEFORE importing the app, so buildApp picks up the mock.
vi.mock("../src/db/client.js", () => ({
  pingDb: vi.fn(),
  db: {},
  pool: { end: vi.fn() },
}));

import { buildApp } from "../src/app.js";
import { pingDb } from "../src/db/client.js";

describe("GET /health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with status=ok when DB is reachable", async () => {
    vi.mocked(pingDb).mockResolvedValue(true);
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("ok");
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it("returns 503 with status=degraded when DB is unreachable", async () => {
    vi.mocked(pingDb).mockResolvedValue(false);
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.db).toBe("unreachable");
  });
});

describe("GET /", () => {
  it("returns the service identity", async () => {
    vi.mocked(pingDb).mockResolvedValue(true);
    const app = buildApp();
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("node-postgres-claude-app");
  });
});
