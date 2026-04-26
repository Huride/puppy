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

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
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
        wss.close(() => server.close(() => resolve()));
      });
    },
  };
}
