import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { startOverlayServer } from "../src/server/overlay-server.js";
import type { OverlayState } from "../src/session/types.js";

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

  it("replays the latest broadcast state to new websocket clients", async () => {
    const port = randomPort();
    const overlay = await startOverlayServer(port);
    const state = sampleOverlayState();

    try {
      overlay.broadcast(state);
      const client = new WebSocket(`ws://localhost:${port}`);
      const message = await onceMessage(client);

      expect(JSON.parse(message.toString("utf8"))).toEqual(state);
      client.close();
    } finally {
      await overlay.close();
    }
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

function onceMessage(socket: WebSocket): Promise<WebSocket.RawData> {
  return new Promise((resolve, reject) => {
    socket.once("message", (payload) => resolve(payload));
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

function sampleOverlayState(): OverlayState {
  return {
    status: "watch",
    petState: "watching",
    message: "멍!",
    popup: {
      title: "Bori's Checkup",
      contextPercent: 12,
      tokenEtaMinutes: 18,
      repeatedFailureCount: null,
      repeatedFailureKey: null,
      cpuPercent: 24,
      memoryPercent: 58,
      summary: "cached",
      recommendation: "reuse cached state",
    },
  };
}
