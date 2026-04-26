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

## Install

Puppy has two current installation paths:

- CLI install from GitHub for `puppy doctor`, `puppy auth`, and `puppy watch`
- Repository install for the Electron desktop companion during the hackathon MVP

Puppy is package-ready for GitHub npm installs. It is not published to the npm registry yet, so use the GitHub URL rather than `npm install -g puppy`.

### CLI Install From GitHub

After this branch is merged to `main`:

```bash
npm install -g github:Huride/puppy
puppy doctor
```

Before merge, install the current PR branch explicitly:

```bash
npm install -g github:Huride/puppy#codex/puppy-mvp
puppy doctor
```

This installs the `puppy` terminal command. It does not install the macOS desktop app as a native `.app`; for that, use the desktop setup below or build a DMG.

### Local Desktop Setup

From this repository:

```bash
git clone https://github.com/Huride/puppy.git
cd puppy
npm install
npm run app
```

If you are testing the PR branch before merge:

```bash
git clone -b codex/puppy-mvp https://github.com/Huride/puppy.git
cd puppy
npm install
npm run app
```

### Local CLI Link

Inside a cloned repository:

```bash
npm install
npm install -g .
puppy doctor
```

### Build A Desktop App

```bash
npm run app:pack
npm run app:dist
```

`app:pack` creates a local packaged app folder. `app:dist` creates distributable macOS artifacts such as DMG/ZIP in `release/`.

Auto-update is wired for packaged builds through GitHub Releases on `Huride/puppy`. A merge to GitHub does not update installed apps by itself; a release artifact must be published.

## Requirements

- Node.js and npm
- macOS for the current floating desktop companion
- Optional: Codex CLI for `puppy auth codex` and `puppy watch -- codex ...`
- Optional: Gemini API key for AI coaching

Without an API key, Puppy falls back to local heuristic coaching.

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

Run the local auth smoke check from a cloned repository:

```bash
npm run auth:check
```

For a live Gemini API request as part of the same check:

```bash
PUPPY_AUTH_LIVE=1 npm run auth:check
```

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

## CLI Usage

Check installation and auth:

```bash
puppy doctor
puppy auth codex --status
puppy auth antigravity --status
```

Watch a real coding-agent command:

```bash
puppy watch --provider auto -- codex exec "fix failing tests"
puppy watch --provider gemini -- codex exec "fix failing tests"
puppy watch --provider heuristic -- node scripts/demo-agent.mjs
```

Puppy prints a local overlay URL while it watches the command:

```text
Puppy overlay: http://localhost:8787
```

Open that URL in a browser if you are using the CLI-only flow.

To share a session plan with another coding agent:

```bash
puppy watch --provider gemini --share-plan -- codex run "fix failing tests"
```

This writes `.puppy/session-plan.md`, a compact Markdown snapshot that Codex, Gemini Antigravity, or another agent can read as handoff context.

## Desktop Demo

```bash
npm run app
```

Equivalent development aliases:

```bash
npm start
npm run run:dev
npm run app:dev
```

This starts Puppy as a small transparent Electron companion window and launches the deterministic demo agent automatically. You do not need to open `localhost` manually.

In the macOS menu bar, open `Puppy > 연동 설정` to check or change provider auth after installation:

- `연동 상태 확인`
- `Gemini API 키 등록/교체`
- `Codex 로그인`
- `Codex 로그인 상태 확인`
- `Antigravity/Gemini 연결 확인`
- `Gemini Live 테스트`

On first launch, Puppy prompts for setup when Gemini or Codex auth is missing. Packaged apps store the Gemini key in the app data directory, not inside the app bundle.

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

## Current Distribution Status

Other PCs can install the CLI from GitHub with npm:

```bash
npm install -g github:Huride/puppy#codex/puppy-mvp
```

After merge, use:

```bash
npm install -g github:Huride/puppy
```

The npm registry package name is not published yet. The desktop app should be shared through `npm run app:dist` artifacts or GitHub Releases.
