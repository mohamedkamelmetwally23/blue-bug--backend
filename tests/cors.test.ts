import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

afterEach(() => vi.unstubAllEnvs());

describe("CORS preflight", () => {
  it("allows the configured frontend even when database and auth settings are invalid", async () => {
    vi.stubEnv("FRONTEND_URL", "https://blue-bug.vercel.app/");
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("AUTH_SECRET", "");
    const response = await request(createApp())
      .options("/api/v1/auth/login")
      .set("Origin", "https://blue-bug.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://blue-bug.vercel.app");
  });

  it("does not allow an unrelated origin", async () => {
    vi.stubEnv("FRONTEND_URL", "https://blue-bug.vercel.app");
    const response = await request(createApp())
      .options("/api/v1/auth/login")
      .set("Origin", "https://unrelated.example")
      .set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
