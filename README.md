# Pawtrol

Pawtrol is Bori, a cute companion watching over your AI coding sessions.

The name combines `Paw` and `Patrol`: Bori patrols your coding session, watches for trouble, and barks when it is time to intervene.

RunCat makes CPU load glanceable through an animated macOS menu-bar pet. Pawtrol is similar in spirit, but for AI coding session health: context window pressure, token ETA, repeated failures, intervention timing, and local system load become a companion pet you can understand at a glance.

AI coding agents are powerful but opaque. Pawtrol turns raw logs, context pressure, token risk, repeated failures, and system signals into Bori, a friendly AI companion that tells you when things are normal, when to watch, and when to intervene.

## What Pawtrol Watches

- CLI logs from coding agents
- Repeated failures and loops
- Estimated context window pressure
- Token ETA
- CPU and memory usage

## What Pawtrol Tells You

Pawtrol summarizes the session as four practical states:

- `normal`: the agent is progressing normally
- `watch`: the session deserves attention soon
- `risk`: context, tokens, or repeated failures are becoming dangerous
- `intervene`: the user should step in now

## Hackathon MVP

The current MVP is a stable CLI wrapper plus a local browser overlay. Pawtrol watches the command you run, computes session signals, asks Gemini when available, falls back to heuristics when needed, and renders Bori in a browser overlay.

The product direction is a PC companion app: menu-bar, tray, or floating transparent pet; clickable status popup; petting interaction; skins, runners, and a store; and team usage intelligence later.

## Install

Pawtrol has two current installation paths:

- npm registry install for `pawtrol doctor`, `pawtrol auth`, and `pawtrol watch`
- GitHub Release download for the macOS desktop companion

The npm package name is `pawtrol`. The current published version is `0.1.1`.

### CLI Install From npm

```bash
npm install -g pawtrol
pawtrol doctor
```

You can also run it without a global install:

```bash
npx -y pawtrol@latest doctor
```

This installs the `pawtrol` terminal command. It does not install the macOS desktop app as a native `.app`; for that, use the desktop setup below or build a DMG.

### Desktop App Download

Download the latest macOS desktop build from GitHub Releases:

```text
https://github.com/Huride/puppy/releases/latest
```

The release includes:

- `Pawtrol-<version>-arm64.dmg`
- `Pawtrol-<version>-arm64-mac.zip`
- `latest-mac.yml` for Electron auto-update

### Local Desktop Setup

From this repository:

```bash
git clone https://github.com/Huride/puppy.git
cd puppy
npm install
npm run app
```

### Local CLI Link

Inside a cloned repository:

```bash
npm install
npm install -g .
pawtrol doctor
```

### Build A Desktop App

```bash
npm run app:pack
npm run app:dist
```

`app:pack` creates a local packaged app folder. `app:dist` creates distributable macOS artifacts such as DMG/ZIP in `release/`.

Auto-update is wired for packaged builds through GitHub Releases on `Huride/puppy`. A merge to GitHub does not update installed apps by itself; a release artifact must be published. The release workflow publishes npm and desktop artifacts when a `v*` tag is pushed.

## Requirements

- Node.js and npm
- macOS for the current floating desktop companion
- Optional: Codex CLI for `pawtrol auth codex` and `pawtrol watch -- codex ...`
- Optional: Gemini API key for AI coaching

Without an API key, Pawtrol falls back to local heuristic coaching.

## LLM Providers

Pawtrol can analyze the watched terminal session with Gemini, OpenAI, Claude, or local heuristics.

Connect keys and local agent auth first:

```bash
pawtrol auth gemini --key "$GEMINI_API_KEY"
pawtrol auth codex
pawtrol auth codex --status
pawtrol auth antigravity --key "$GEMINI_API_KEY"
pawtrol doctor
```

`pawtrol auth gemini` and `pawtrol auth antigravity` save `GEMINI_API_KEY` to `.env.local`. `pawtrol auth codex` uses the installed Codex CLI login flow and only checks whether Codex is already authenticated; Pawtrol does not read or print Codex credentials.

Run the local auth smoke check from a cloned repository:

```bash
npm run auth:check
```

For a live Gemini API request as part of the same check:

```bash
PAWTROL_AUTH_LIVE=1 npm run auth:check
```

```bash
pawtrol watch --provider auto -- codex run "fix failing tests"
pawtrol watch --provider gemini --model gemini-3-flash-preview -- codex run "fix failing tests"
pawtrol watch --provider openai --model gpt-5.2 -- codex run "fix failing tests"
pawtrol watch --provider claude --model claude-sonnet-4-5 -- claude "fix failing tests"
pawtrol watch --provider heuristic -- node scripts/demo-agent.mjs
```

Provider keys:

```bash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

`--provider auto` chooses Gemini first, then OpenAI, then Claude, then local heuristics. When you do not pass `--model`, Pawtrol uses the recommended model for the resolved provider.

## CLI Usage

Check installation and auth:

```bash
pawtrol doctor
pawtrol auth codex --status
pawtrol auth antigravity --status
```

Watch a real coding-agent command:

```bash
pawtrol watch --provider auto -- codex exec "fix failing tests"
pawtrol watch --provider gemini -- codex exec "fix failing tests"
pawtrol watch --provider heuristic -- node scripts/demo-agent.mjs
```

Pawtrol prints a local overlay URL while it watches the command:

```text
Pawtrol overlay: http://localhost:8787
```

Open that URL in a browser if you are using the CLI-only flow.

To share a session plan with another coding agent:

```bash
pawtrol watch --provider gemini --share-plan -- codex run "fix failing tests"
```

This writes `.pawtrol/session-plan.md`, a compact Markdown snapshot that Codex, Gemini Antigravity, or another agent can read as handoff context.

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

This starts Pawtrol as a small transparent Electron companion window and launches the deterministic demo agent automatically. You do not need to open `localhost` manually.

In the macOS menu bar, open `Pawtrol > 연동 설정` to check or change provider auth after installation:

- `연동 상태 확인`
- `Gemini API 키 등록/교체`
- `Codex 로그인`
- `Codex 로그인 상태 확인`
- `Antigravity/Gemini 연결 확인`
- `Gemini Live 테스트`

On first launch, Pawtrol prompts for setup when Gemini or Codex auth is missing. Packaged apps store the Gemini key in the app data directory, not inside the app bundle.

## Browser Demo

```bash
npm run watch:demo
```

Open the printed Pawtrol overlay URL in your browser, usually:

```text
http://localhost:8787
```

The demo agent emits deterministic CLI output with repeated auth test failures and a token ETA so Pawtrol can show the overlay, update Bori, and surface the popup status.

## Real CLI Usage

```bash
npm run dev -- watch -- codex run "fix failing tests"
npm run dev -- watch -- claude "fix failing tests"
```

For the live hackathon demo, `npm run watch:demo` is the safest path. Some interactive CLIs change behavior when their output is piped through a watcher; a later desktop-app version should use a PTY-backed adapter for tools that require a real terminal.

Pawtrol keeps the agent command intact while watching its output and session health.

## Current Distribution Status

Other PCs can install the CLI from npm:

```bash
npm install -g pawtrol
pawtrol doctor
```

The published package has been verified with:

```bash
npx -y pawtrol@0.1.1 doctor
```

The desktop app is distributed through GitHub Releases. Packaged desktop apps check GitHub Releases for automatic updates.

## Release

1. Add `NPM_TOKEN` to GitHub repository secrets.
2. Bump `package.json` version.
3. Push a new version tag:

```bash
npm version patch
git push origin main
git push origin v0.1.2
```

The release workflow runs tests, publishes `pawtrol` to npm, builds the macOS app, uploads release artifacts to GitHub Releases, and enables Electron auto-update for installed packaged apps.
