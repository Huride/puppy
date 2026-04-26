import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { OverlayState } from "../session/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type OverlayServer = {
  url: string;
  broadcast: (state: OverlayState) => void;
  close: () => Promise<void>;
};

export async function startOverlayServer(port = 8787): Promise<OverlayServer> {
  const app = express();
  const staticDir = path.resolve(__dirname, "../overlay");
  app.use(express.static(staticDir));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      server.off("error", onError);
      wss.off("error", onError);
    };
    const onError = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
      try {
        wss.close();
      } catch {
        // The WebSocket server may not be fully listening yet.
      }
    };
    const onListening = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    server.once("error", onError);
    wss.once("error", onError);
    server.listen(port, "127.0.0.1", onListening);
  });

  return {
    url: `http://localhost:${port}`,
    broadcast(state: OverlayState) {
      const payload = JSON.stringify(state);
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(payload);
        }
      }
    },
    close() {
      return new Promise((resolve) => {
        for (const client of wss.clients) {
          client.close(1001, "Server shutting down");
          client.terminate();
        }

        wss.close(() => server.close(() => resolve()));
      });
    },
  };
}
