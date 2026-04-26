# Puppy Design Spec

## Summary

Puppy is a desktop overlay companion for AI coding sessions. It watches tools such as Codex, Claude Code, and later cmux, then turns raw logs, token signals, context window pressure, test failures, and system resource usage into friendly but actionable pet messages.

The product goal is to reduce the anxiety and fatigue of waiting on opaque coding agents. The pet is cute, but the core value is an AI session coach that knows when the user should keep waiting, watch closely, or intervene.

## Hackathon Positioning

Primary track: Business & Applications.

Puppy is positioned as an AI-powered product rather than a simple developer utility:

- Problem: AI coding agents are powerful but opaque. Users do not know whether the agent is making progress, looping, wasting tokens, or approaching context limits.
- AI value: Gemini analyzes the coding session and produces risk assessments, intervention recommendations, and calming companion messages.
- Business model: free or low-cost personal companion with paid pets, skins, accessories, animation packs, tone packs, and a future team plan for AI usage intelligence.

Puppy also has strong Developer Tooling relevance because it lives directly in CLI-first AI coding workflows.

## Target User

The initial user is an individual developer using Codex, Claude Code, cmux, or similar CLI coding agents for multi-step tasks.

The user wants to know:

- What is the agent doing right now?
- Is it making progress or looping?
- Is the context window getting too full?
- When will token or cost pressure become risky?
- Should I keep waiting or intervene with a narrower prompt?

## Core Experience

The user starts a coding agent through Puppy:

```bash
puppy watch -- codex run "fix failing auth tests"
```

Puppy launches the command, streams stdout and stderr, collects signals, asks Gemini to analyze the current session, and updates a floating pet overlay.

The pet stays quiet during normal work. When a risk appears, it changes animation state and shows a short alert.

Example alert:

```text
멍! 같은 테스트가 3번 실패했어요.
컨텍스트가 82% 정도 찼고, 현재 속도면 12분 뒤 토큰이 위험해져요.
이 작업은 새 세션으로 나누는 게 좋아요.
```

Clicking the pet opens a status popup:

```text
Bori's Checkup

Status: Intervene
Context Window: 82%
Token ETA: 12m
Loop Detected: auth.spec.ts failed 3x
CPU: 41%
Memory: 62%

Recommendation:
Start a new session focused only on the failing test.
```

## Pet Interaction Model

Puppy should feel ambient, not intrusive.

Pet states:

- `idle`: sitting or resting.
- `walking`: walking in place while the agent is actively working.
- `alert`: barking and showing a short notification when risk is detected.
- `happy`: wagging tail or purring-like reaction when the user pets the character.

Interactions:

- Click pet: open the detailed status popup.
- Hover or drag over pet: trigger a happy animation when no urgent alert is active.
- Alert state has priority over petting so critical recommendations remain visible.

MVP animation can use state-specific images or CSS animation. Full sprite animation is optional.

## AI Coach

Gemini is the main intelligence layer.

Input:

- Recent CLI logs.
- Recent errors and test failures.
- Repeated failure count.
- Estimated context window usage.
- Token usage and token depletion ETA when available.
- CPU and memory usage.
- Idle time or long-running operation signals.

Output should be structured JSON:

```json
{
  "status": "risk",
  "summary": "인증 테스트를 고치는 중이고 같은 실패가 반복되고 있어요.",
  "risk": "컨텍스트가 82% 정도 찼고, 현재 속도면 12분 뒤 토큰이 부족할 수 있어요.",
  "recommendation": "실패 테스트 하나만 새 세션으로 분리하는 걸 추천해요.",
  "pet_message": "멍! 지금은 살짝 끊어가는 게 좋아요."
}
```

Allowed statuses:

- `normal`: safe to keep waiting.
- `watch`: worth monitoring.
- `risk`: risk is rising.
- `intervene`: user should take action.

## Context Window Health

Puppy distinguishes between session budget and context window pressure.

- Session budget: remaining token or cost budget for the current session.
- Context window: how full the model's working memory is.

Context thresholds:

- Below 60%: normal.
- 60-80%: watch for large tasks.
- 80-95%: recommend summarizing or splitting work.
- Above 95%: strongly recommend starting a new session.

Exact context usage may not be available from every coding agent. MVP should estimate it from available token usage, log size, prompt history size, and diff volume. The UI should phrase estimates softly, such as "about 82%" or "almost full."

## Architecture

Puppy has four layers.

### 1. Session Watcher

Runs and watches a target command:

```bash
puppy watch -- <command>
```

It captures stdout and stderr and normalizes them into session events.

Initial adapters:

- Codex adapter.
- Claude Code adapter.

Future or stretch adapter:

- cmux adapter.

Normalized events:

- `agent_output`
- `tool_call`
- `test_failure`
- `token_usage`
- `context_estimate`
- `idle_time`
- `resource_usage`

### 2. Signal Engine

Converts raw logs and system data into intermediate signals:

- Current task summary candidates.
- Repeated failure detection.
- Idle or stuck state.
- Token burn rate.
- Token depletion ETA.
- Context window estimate.
- CPU usage.
- Memory usage.
- Intervention score.

### 3. Gemini Coach

Calls Gemini using environment variables loaded from `.env.local`.

The API key must never be committed. `.env.example` documents the required variables.

The coach combines deterministic signals with recent logs and returns a structured assessment.

### 4. Overlay Pet UI

Shows the pet and its current state separately from the terminal.

MVP UI:

- Floating pet near the lower-right corner.
- Bubble notification for alerts.
- Status badge.
- Compact metrics: context, token ETA, loop count, CPU, memory.
- Click-to-open status popup.
- Petting interaction for happy animation.

## MVP Scope

Must implement:

- `puppy watch -- <command>`.
- Real-time CLI output capture.
- Gemini-based state analysis.
- Context window estimate.
- Token ETA estimate when possible.
- CPU and memory display.
- Floating pet overlay.
- Idle, walking, alert, and happy states.
- Barking alert message.
- Clickable status popup.
- `.env.local` loading with `.env.example` committed.

Stretch:

- cmux session adapter.
- Multiple pets.
- Basic accessory or skin selection demo.
- Demo storefront UI without real payment.

Out of scope for the hackathon:

- Real payment.
- Full marketplace.
- Full native OS-level overlay polish.
- Exact context accounting for every provider.
- Full team dashboard.
- Production-grade support for every coding agent.

## Demo Script

1. Start a coding agent through Puppy:

   ```bash
   puppy watch -- codex run "fix failing auth tests"
   ```

2. The terminal shows the agent working.
3. The agent repeats the same failing test several times.
4. Puppy detects repeated failure, high context pressure, and token ETA risk.
5. The pet barks and recommends splitting the task into a new focused session.
6. The user clicks the pet to show the detailed status popup.
7. The pitch ends with: Puppy is not a cute system monitor. It is an AI coding session coach that turns opaque agent work into timely, emotionally readable guidance.

## Business Model

Personal plan:

- Free basic pet.
- Paid pets, skins, accessories, animations, and tone packs.

Team plan:

- AI usage reports.
- Cost and token risk alerts.
- Team-level session health analytics.
- Workflow recommendations for agent-heavy engineering teams.

## Open Questions

- Whether the overlay should be implemented as Electron, Tauri, or a browser-based prototype for the hackathon.
- Whether cmux exposes enough session state for a reliable stretch adapter.
- Whether the MVP should ship with generated pet images or CSS/SVG placeholder sprites first.

