# Passive Companion File Integration Design

## Summary

Pawtrol keeps passive process detection, but stops implying that it has full session visibility when it does not. The passive companion gains a file-based signal layer that reads one recent summary artifact and, when needed, one supporting log artifact. The status panel becomes a narrower rectangular layout with a two-column stat grid and direct macOS action CTAs.

This design also tightens packaged macOS window behavior to reduce ghosting by disabling dynamic interactive bounds and keeping packaged companion behavior more static than development mode.

## Goals

- Keep passive detect mode for already-running Codex/Claude sessions.
- Improve passive mode with file-based context when available.
- Make passive mode explicitly lower-fidelity than `pawtrol watch -- <command>`.
- Show users what Pawtrol is observing, when it was last updated, and how trustworthy it is.
- Add direct CTAs to relevant macOS tools/settings.
- Reduce packaged macOS ghosting and hit-area instability.

## Non-Goals

- Attaching to arbitrary existing TTY/PTTY sessions.
- Deep per-app native integrations with Codex or Claude Desktop internals.
- Full multi-file log aggregation across a user's home directory.
- Replacing `watch` mode as the preferred precise coaching path.

## Observation Modes

### Watch Mode

`pawtrol watch -- <command>` remains the high-confidence path. It reads real stdout/stderr and may compute context, repeated failure, token ETA, and next-action guidance with high confidence.

### Passive Mode

Passive mode remains process-detection first. It now adds file-based artifacts:

1. One summary artifact, highest priority
2. One log artifact, optional supporting source

If neither is available, Pawtrol stays in passive-local mode and says so explicitly.

## Artifact Discovery

### Search Scope

Pawtrol searches only:

- current working directory subtree
- fixed home-directory app paths
- user-provided extra paths from env and config

It does not scan the whole home directory.

### Default Home Paths

Initial default paths:

- `~/.pawtrol`
- `~/.codex`
- `~/.claude`
- `~/Library/Application Support` subdirectories for Codex/Claude/Pawtrol integration data where present

### User-Provided Paths

Additional paths are accepted from:

- env var
- app config file

Both sources are merged.

### Recency Rule

Only artifacts modified in the last 15 minutes are considered current.

If the best artifact is older than 15 minutes:

- it may still be surfaced as `stale`
- coaching confidence is reduced
- recommendation wording becomes conservative

## Artifact Types

Supported formats:

- Markdown summary files
- JSON snapshots
- plain text logs

Priority:

1. Summary artifact
2. Supporting log artifact

When multiple candidates exist:

- pick the single most relevant recent summary artifact
- optionally add one recent log artifact
- do not aggregate unbounded files

## Normalized Passive Snapshot

Artifacts are parsed into a normalized snapshot with optional fields:

- source type
- source path
- updated timestamp
- detected provider/app kind
- recent task name
- repeated failure key/count
- context estimate
- token ETA estimate
- recent changed file/test hints
- confidence level
- stale flag

Any field not grounded in artifacts stays unknown.

## Metric Rules

### Context

- show real value only if grounded in artifact data
- otherwise show `unknown`
- explain why unknown

### Token ETA

- show only if explicitly derivable from artifact/snapshot data
- otherwise show `unknown`

### Repeated Failure

- show only if a repeated failure pattern is grounded in summary/log evidence
- otherwise show `unknown` or `none` based on evidence

### Confidence

Confidence is derived from source quality:

- `high`: watch mode
- `medium`: recent summary artifact with supporting evidence
- `low`: passive-local or stale-only evidence

## Passive Coaching Rules

Passive mode must not pretend to have full session understanding.

When only process detection exists:

- present process/resource awareness only
- recommend switching to watch mode for precise guidance

When summary/log artifact exists:

- use only grounded fields
- keep recommendations conservative
- avoid precise file/test claims unless directly supported

## Status Panel UI

### Layout

Use a narrower rectangular panel than the current long horizontal layout.

Structure:

1. Header with title and status badge
2. One short summary line
3. Two-column stat grid
4. Recommendation block
5. CTA row/section

### Stat Grid

Display as two items per row:

- context
- token ETA
- repeated failure
- observation source
- last updated
- confidence

Each stat block is a compact rectangle with:

- label
- value
- short hint

### Unknown and Stale Presentation

- `unknown` is shown directly, not hidden
- `stale` gets a visible marker and lowered-confidence hint

## CTA Behavior

Add direct actions:

- `활성 상태 보기` -> Activity Monitor
- `저장공간 보기` -> System Settings > General > Storage
- `네트워크 환경 보기` -> System Settings > Network
- `연동 파일 위치 열기`
- `watch 모드 실행 방법 보기`

Preferred behavior:

- utility apps when that is the clearest destination
- System Settings panes otherwise

## Packaged macOS Behavior

To reduce ghosting and hit-area instability in packaged macOS builds:

- disable interactive window shape
- disable dynamic interactive bounds resizing
- keep a slightly larger but stable companion window frame

Development mode may remain more dynamic for iteration, but packaged behavior prioritizes stability over tight clipping.

## Data Contracts

Overlay state metadata grows to include:

- observation mode
- provider/model labels
- observed agent kinds
- source label
- updated-at label
- confidence label
- stale flag

These fields are optional and should degrade safely.

## Testing

### Unit

- artifact recency filtering
- summary vs log selection priority
- unknown metric fallback rules
- stale confidence downgrade
- passive-local coaching wording
- packaged macOS shape/bounds policy

### Integration

- passive mode with no artifacts
- passive mode with recent summary artifact
- passive mode with stale artifact
- status panel metadata rendering
- CTA command routing

### Manual

- packaged macOS build no longer leaves obvious ghost trails during normal idle behavior
- multiple monitors still support dragging
- passive mode clearly says when it is not performing precise session diagnosis
- file-based passive mode shows fresher, more specific hints when artifacts exist
