# Agent Artifact Install And Resource Cards Design

## Summary

Pawtrol passive mode should stop depending on opportunistic discovery alone. On install and upgrade, Pawtrol will provision global home-level artifact wiring for Codex, Claude, and Gemini-compatible tooling so snapshot and log artifacts are emitted consistently into Pawtrol-managed paths. Passive mode will continue reading legacy and tool-native locations, but writes will converge into a single standard layout under `~/.pawtrol`.

At the same time, the status panel should present richer macOS system telemetry. CPU, memory, storage, and battery cards will keep the current compact card layout, but each card will expose more grounded values. CPU will switch from a thin line to a filled area sparkline. Battery will add maximum capacity, cycle count, and temperature when available. The existing initial loading gap will continue to show a visible spinner until first real data arrives.

## Goals

- Improve passive companion accuracy by making artifact generation explicit for Codex, Claude, and Gemini.
- Keep user workflows unchanged: users continue to run their existing CLIs normally.
- Centralize Pawtrol-managed artifacts into a stable home-level layout.
- Preserve backward compatibility by still reading older `.codex`, `.claude`, `.gemini`, and project-local artifacts.
- Expand resource cards with stable macOS-local telemetry only.
- Keep the status panel compact and scannable.

## Non-Goals

- Full deep integration with each agent vendor's proprietary session internals.
- Capturing complete stdout/stderr for already-running sessions without cooperation from the tool.
- Cross-platform expansion of the new telemetry beyond current macOS behavior.
- A generalized uninstall/migration UI in this iteration.

## User-Facing Behavior

### Passive Artifacts

After Pawtrol install or upgrade, global home-level settings for Codex, Claude, and Gemini-compatible tooling are inspected. When a supported hook/config location exists, Pawtrol injects a Pawtrol-managed block that updates:

- one summary snapshot
- one rolling log artifact

Passive mode then prefers these artifacts when present. If they are missing, Pawtrol still falls back to process detection and legacy artifact discovery, but the UI should continue to describe that mode as lower-fidelity passive observation.

### Resource Cards

The status panel keeps the current compact rectangular panel and card grouping, but resource cards become more informative:

- `CPU`
  - total CPU percent
  - system percent
  - user percent
  - idle percent
  - filled area sparkline
- `메모리`
  - total memory percent
  - memory pressure
  - app memory
  - wired memory
  - compressed memory
- `저장공간`
  - used percent
  - used / total
  - based on the data volume, not the synthetic root mount
- `배터리`
  - battery percent
  - power source
  - maximum capacity
  - cycle count
  - temperature

If a value cannot be determined on the current machine, the card shows an explicit unknown state instead of hiding the field.

### Loading State

Before first grounded passive artifact data or first local telemetry sample arrives, the panel shows an explicit loading row with a spinner. This remains visible until the data needed by the cards has been populated.

## Architecture

### 1. Artifact Provisioning Layer

Add a provisioning layer responsible for installing and repairing Pawtrol-managed agent artifact wiring.

Responsibilities:

- detect whether Codex, Claude, and Gemini-compatible tooling are present
- resolve each tool's global home-level config/hook root
- inject or update a Pawtrol-owned config block idempotently
- create `~/.pawtrol/agents/<agent>/` directories if missing
- expose install result summaries for onboarding, doctor, and future repair flows

Write destinations:

- `~/.pawtrol/agents/codex/`
- `~/.pawtrol/agents/claude/`
- `~/.pawtrol/agents/gemini/`

Each agent directory will hold:

- `session-summary.json` or `session-plan.md` style snapshot
- `session.log`
- optional metadata describing the source tool and last write time

### 2. Tool-Specific Home Resolution

Artifact discovery already understands `.codex` and `.claude`. Extend it to include Gemini-compatible locations with this precedence:

1. actual detected Gemini/antigravity home/config root
2. `~/.gemini` fallback
3. existing Pawtrol-managed `~/.pawtrol/agents/gemini`

Reads remain broad; writes are standardized to the Pawtrol-managed home layout.

### 3. Hook/Config Injection Strategy

Pawtrol will not attempt to write vendor-native session formats. Instead, it will inject a small Pawtrol-managed hook/config block so that tool activity updates Pawtrol-owned artifacts.

Rules:

- existing user config must remain intact
- Pawtrol block must be clearly marked
- repeated install/upgrade runs must not duplicate the block
- if a tool has no writable or discoverable hook point, Pawtrol still provisions the standard directory and records that the tool is only partially wired

This keeps parsing stable because Pawtrol controls the artifact format it consumes.

### 4. Passive Artifact Discovery

Discovery continues to scan:

- current working directory
- `~/.pawtrol`
- `~/.codex`
- `~/.claude`
- resolved Gemini home or `~/.gemini`
- `~/Library/Application Support/Pawtrol`
- `~/Library/Application Support/Codex`
- `~/Library/Application Support/Claude`
- configured extra paths

Selection policy remains:

- prefer one current summary artifact
- optionally add one current log artifact
- keep stale metadata if current files are absent
- current window remains fifteen minutes

### 5. Resource Sampling

Keep the telemetry source local and lightweight.

- CPU: `top`
- memory: `vm_stat` and current existing sampling logic
- storage: `df -k /System/Volumes/Data`
- battery: `pmset -g batt`

Battery enrichment may require combining existing `pmset` output parsing with additional structured parsing from available local commands, but only if the command is present on standard macOS and fast enough for repeated polling. If a detailed field is absent, do not synthesize it.

### 6. UI Rendering

The panel layout stays compact. No return to the earlier very wide layout.

Changes:

- CPU card sparkline becomes a filled area chart instead of a thin line
- resource cards expose multiple supporting lines, matching the current card style
- storage uses data-volume values only
- battery expands to include the extra metadata fields
- loading row remains above the stat grid and is visible until relevant fields are present

## Data Model Changes

### Passive Artifact Provisioning

Add a model describing:

- detected agent tool
- resolved config root
- resolved Pawtrol artifact directory
- install status: `installed`, `updated`, `skipped`, `partial`, `unsupported`
- optional warning message

### Resource Usage

Extend resource details to carry:

- CPU sparkline samples
- battery maximum capacity
- battery cycle count
- battery temperature

These fields must remain optional so older environments and tests still pass cleanly.

## Error Handling

- If hook/config injection fails for one tool, Pawtrol continues installing others.
- Provisioning errors should be summarized, not silently swallowed.
- If telemetry collection for one card fails, the rest of the cards still render.
- If battery details are unavailable, show the base battery percent and power source only.

## Testing

### Unit Tests

- global root resolution for Codex, Claude, and Gemini
- Gemini actual-root-first, `~/.gemini` fallback behavior
- config/hook injection is idempotent
- Pawtrol block preserves surrounding user config
- storage parsing uses data volume values
- battery parsing for percent, source, max capacity, cycle count, temperature
- CPU sparkline sample accumulation and bounds

### Integration Tests

- passive mode consumes Pawtrol-managed Codex artifact output
- passive mode consumes Pawtrol-managed Claude artifact output
- passive mode consumes Pawtrol-managed Gemini artifact output
- initial loading spinner remains visible before first sample
- CTA behavior continues to work after the panel changes

### Manual Checks

- install or upgrade provisions `~/.pawtrol/agents/*`
- existing agent CLIs still run without user workflow changes
- passive mode shows grounded artifact metadata when the new files are updating
- CPU card uses a filled area sparkline
- battery card shows added metadata on machines where the values exist

## Rollout Notes

This is a behavior-expanding release, so the install/upgrade path needs to be explicit in release notes:

- Pawtrol now provisions global passive artifact wiring
- Pawtrol-managed agent artifacts live under `~/.pawtrol/agents`
- legacy artifact discovery remains supported
- richer system telemetry is currently macOS-focused
