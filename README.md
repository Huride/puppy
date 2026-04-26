# Puppy

Puppy is a cute AI coding session companion for CLI agents such as Codex, Claude Code, and cmux.

RunCat makes CPU load glanceable through an animated macOS menu-bar pet. Puppy is similar in spirit, but for AI coding session health: context window pressure, token ETA, repeated failures, intervention timing, and local system load become a companion pet you can understand at a glance.

AI coding agents are powerful but opaque. Puppy turns raw logs, context pressure, token risk, repeated failures, and system signals into a friendly AI companion that tells you when things are normal, when to watch, and when to intervene.

## What Puppy Watches

- CLI logs from coding agents
- Repeated failures and loops
- Estimated context window pressure
- Token ETA
- CPU and memory usage

## What Puppy Tells You

Puppy summarizes the session as four practical states:

- `normal`: the agent is progressing normally
- `watch`: the session deserves attention soon
- `risk`: context, tokens, or repeated failures are becoming dangerous
- `intervene`: the user should step in now

## Hackathon MVP

The current MVP is a stable CLI wrapper plus a local browser overlay. Puppy watches the command you run, computes session signals, asks Gemini when available, falls back to heuristics when needed, and renders Bori in a browser overlay.

The product direction is a PC companion app: menu-bar, tray, or floating transparent pet; clickable status popup; petting interaction; skins, runners, and a store; and team usage intelligence later.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add a Gemini API key to `.env.local`:

```bash
GEMINI_API_KEY=...
```

This is optional for the demo. Puppy falls back to local heuristics without Gemini; the key improves coaching quality.

## Demo

```bash
npm run watch:demo
```

Open the printed Puppy overlay URL in your browser, usually:

```text
http://localhost:8787
```

The demo agent emits deterministic CLI output with repeated auth test failures and a token ETA so Puppy can show the overlay, update Bori, and surface the popup status.

## Real CLI Usage

```bash
npm run dev -- watch -- codex run "fix failing tests"
npm run dev -- watch -- claude "fix failing tests"
```

For the live hackathon demo, `npm run watch:demo` is the safest path. Some interactive CLIs change behavior when their output is piped through a watcher; a later desktop-app version should use a PTY-backed adapter for tools that require a real terminal.

Puppy keeps the agent command intact while watching its output and session health.
