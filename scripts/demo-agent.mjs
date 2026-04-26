const lines = [
  "[codex] reading src/auth/session.ts",
  "[codex] running npm test auth.spec.ts",
  "FAIL auth.spec.ts: refresh token expires too early",
  "[codex] editing src/auth/token.ts",
  "FAIL auth.spec.ts: refresh token expires too early",
  "[codex] editing src/auth/token.ts again",
  "Token ETA: 12m",
  "FAIL auth.spec.ts: refresh token expires too early",
];

for (const line of lines) {
  console.log(line);
  await new Promise((resolve) => setTimeout(resolve, 1200));
}
