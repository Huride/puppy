#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";

config({ path: ".env.local", override: false });

const cli = ["node", "dist/src/cli.js"];
const checks = [
  { label: "provider doctor", args: ["doctor"], required: true },
  { label: "codex auth", args: ["auth", "codex", "--status"], required: false },
  { label: "antigravity/gemini auth", args: ["auth", "antigravity", "--status"], required: false },
];

let failed = false;

if (!existsSync("dist/src/cli.js")) {
  console.error("dist/src/cli.js가 없어요. 먼저 `npm run build`를 실행해 주세요.");
  process.exit(1);
}

for (const check of checks) {
  console.log(`\n[auth-check] ${check.label}`);
  const result = spawnSync(cli[0], [...cli.slice(1), ...check.args], { encoding: "utf8" });
  writeOutput(result.stdout);
  writeOutput(result.stderr);

  if (result.status !== 0 && check.required) {
    failed = true;
  }
}

if (process.env.PAWTROL_AUTH_LIVE === "1") {
  console.log("\n[auth-check] gemini live request");
  const ok = await checkGeminiLive();
  failed = failed || !ok;
} else {
  console.log("\n[auth-check] Gemini live request skipped. Set PAWTROL_AUTH_LIVE=1 to verify the API key against Gemini.");
}

process.exit(failed ? 1 : 0);

function writeOutput(value) {
  const trimmed = value.trim();
  if (trimmed) {
    console.log(redactSecrets(trimmed));
  }
}

function redactSecrets(value) {
  return value.replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza...REDACTED");
}

async function checkGeminiLive() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("GEMINI_API_KEY가 없어서 Gemini live request를 확인할 수 없어요.");
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Reply with exactly: pawtrol-auth-ok",
    });
    const text = response.text?.trim() ?? "";
    console.log(`Gemini response: ${text}`);
    return text.toLowerCase().includes("pawtrol-auth-ok");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}
