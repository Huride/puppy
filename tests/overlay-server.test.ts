import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { startOverlayServer } from "../src/server/overlay-server.js";

describe("startOverlayServer", () => {
  it("rejects when the requested port is already in use", async () => {
    const port = randomPort();
    const first = await startOverlayServer(port);

    try {
      await expect(startOverlayServer(port)).rejects.toHaveProperty("code", "EADDRINUSE");
    } finally {
      await first.close();
    }
  });

  it("closes promptly with a connected WebSocket client", async () => {
    const port = randomPort();
    const overlay = await startOverlayServer(port);
    const client = new WebSocket(`ws://localhost:${port}`);

    await once(client, "open");

    await expect(withTimeout(overlay.close(), 500)).resolves.toBeUndefined();
  });
});

function randomPort(): number {
  return 20_000 + Math.floor(Math.random() * 20_000);
}

function once(socket: WebSocket, event: "open"): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once(event, () => resolve());
    socket.once("error", reject);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
