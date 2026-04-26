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

## Terminal Install

From this repository:

```bash
npm install -g .
puppy doctor
```

From GitHub:

```bash
npm install -g github:Huride/puppy
puppy doctor
```

`puppy doctor` only reports whether provider keys are configured. It never prints API key values.

## LLM Providers

Puppy can analyze the watched terminal session with Gemini, OpenAI, Claude, or local heuristics.

Connect keys and local agent auth first:

```bash
puppy auth gemini --key "$GEMINI_API_KEY"
puppy auth codex
puppy auth codex --status
puppy auth antigravity --key "$GEMINI_API_KEY"
puppy doctor
```

`puppy auth gemini` and `puppy auth antigravity` save `GEMINI_API_KEY` to `.env.local`. `puppy auth codex` uses the installed Codex CLI login flow and only checks whether Codex is already authenticated; Puppy does not read or print Codex credentials.

```bash
puppy watch --provider auto -- codex run "fix failing tests"
puppy watch --provider gemini --model gemini-3-flash-preview -- codex run "fix failing tests"
puppy watch --provider openai --model gpt-5.2 -- codex run "fix failing tests"
puppy watch --provider claude --model claude-sonnet-4-5 -- claude "fix failing tests"
puppy watch --provider heuristic -- node scripts/demo-agent.mjs
```

Provider keys:

```bash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

`--provider auto` chooses Gemini first, then OpenAI, then Claude, then local heuristics. When you do not pass `--model`, Puppy uses the recommended model for the resolved provider.

To share a session plan with another coding agent:

```bash
puppy watch --provider gemini --share-plan -- codex run "fix failing tests"
```

This writes `.puppy/session-plan.md`, a compact Markdown snapshot that Codex, Gemini Antigravity, or another agent can read as handoff context.

## Desktop Demo

```bash
npm run app:dev
```

This starts Puppy as a small transparent Electron companion window and launches the deterministic demo agent automatically. You do not need to open `localhost` manually.

For a local packaged app folder:

```bash
npm run app:pack
```

For a distributable build:

```bash
npm run app:dist
```

Auto-update is wired for packaged builds through GitHub Releases on `Huride/puppy`. A merge to GitHub does not update installed apps by itself; the release artifact must be published so Electron can download it.

## Browser Demo

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
