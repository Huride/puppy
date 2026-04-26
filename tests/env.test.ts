import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => vi.fn());

vi.mock("dotenv/config", () => ({}));
vi.mock("dotenv", () => ({ config }));

describe("env config", () => {
  beforeEach(() => {
    vi.resetModules();
    config.mockClear();
  });

  it("loads .env.local without overriding existing environment values", async () => {
    await import("../src/config/env.js");

    expect(config).toHaveBeenCalledWith({ path: ".env.local", override: false });
  });
});
