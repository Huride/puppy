# Pawtrol

Pawtrol은 당신의 AI 코딩 세션을 지켜보는 애완동물입니다.

이름은 `Paw`와 `Patrol`을 합친 말입니다. Codex, Claude Code, Gemini Antigravity, cmux 같은 AI 코딩 에이전트 세션을 순찰하면서 컨텍스트 압박, 토큰 소진 위험, 반복 실패, 개입 타이밍을 귀엽고 직관적인 방식으로 알려줍니다.

Pawtrol은 AI 코딩 세션의 건강 상태를 화면 위의 작은 반려동물로 보여줍니다. <br/>
평소에는 조용히 걷거나 쉬고, 문제가 커질 때는 반려동물이 짖으면서 상태를 알려줍니다.


![Pawtrol 데모: 보리가 AI 코딩 세션을 순찰하고 위험 상태를 알려주는 애니메이션](assets/demo/pawtrol-bori-demo.gif)

## 프로젝트 요약

Pawtrol은 AI 코딩 에이전트를 오래 실행할 때 생기는 불안한 순간을 줄이기 위한 세션 companion 앱입니다.

에이전트가 코드를 수정하고, 테스트를 돌리고, 실패 로그를 반복해서 읽는 동안 사용자는 터미널 전체를 계속 지켜보기 어렵습니다. Pawtrol은 그 흐름을 대신 순찰하면서 지금 세션이 정상인지, 곧 확인해야 하는지, 사람이 바로 개입해야 하는지를 보리의 행동과 상태 팝업으로 알려줍니다.

핵심 경험은 단순합니다. 평소에는 화면 우하단에 보리가 조용히 있고, 문제가 보이면 짧게 짖거나 말풍선을 띄웁니다. 보리를 클릭하면 컨텍스트 사용률, 토큰 ETA, 반복 실패, CPU/메모리, AI 분석 요약을 한 번에 확인할 수 있습니다.

## 작동 방식

Pawtrol은 감시할 CLI 명령을 감싸서 실행합니다. Codex, Claude Code, Gemini Antigravity 같은 에이전트의 출력은 그대로 유지하면서, Pawtrol은 옆에서 로그와 로컬 시스템 신호를 분석합니다.

분석 흐름:

1. 에이전트 stdout/stderr 수집
2. 실패/반복/정체/토큰 ETA/컨텍스트 압박 신호 추출
3. Gemini, OpenAI, Claude 또는 local heuristic으로 세션 상태 분석
4. `normal`, `watch`, `risk`, `intervene` 중 하나로 요약
5. 브라우저 overlay 또는 macOS desktop companion에 보리 상태 반영

## 해커톤 데모 포인트

- `npm install -g pawtrol`로 다른 PC에서도 CLI 설치 가능
- `pawtrol doctor`로 Gemini/Codex/Antigravity 연결 상태 확인
- `pawtrol watch --provider gemini -- ...`로 실제 에이전트 실행 감시
- macOS 앱에서 보리, 상태 팝업, 메뉴바 설정, 자동 업데이트 흐름 확인
- Gemini API가 있으면 AI 분석 메시지 사용, 없으면 local heuristic fallback 사용
- GitHub Releases와 npm registry를 통해 배포 가능한 형태까지 구성

## 왜 만들었나요?

AI 코딩 에이전트는 강력하지만, 장시간 실행하면 지금 세션이 제대로 가고 있는지 한눈에 알기 어렵습니다.

Pawtrol은 이런 순간을 해결하려고 만들었습니다.

- 에이전트가 같은 실패를 반복하는지
- 컨텍스트 윈도우가 얼마나 찼는지
- 현재 속도라면 토큰 여유가 얼마나 남았는지
- CPU/메모리 부하가 커지고 있는지
- 지금은 기다려도 되는지, 사람이 개입해야 하는지

Pawtrol은 raw log와 세션 신호를 분석해 Bori의 상태, 말풍선, 상태 팝업으로 바꿔줍니다.

## 주요 기능

- CLI 에이전트 실행 감시
- 반복 실패와 루프 감지
- 컨텍스트 윈도우 압박 추정
- 토큰 ETA 예측
- CPU/메모리 사용량 표시
- Gemini/OpenAI/Claude 기반 AI 코칭
- API 키가 없을 때 로컬 휴리스틱 분석으로 fallback
- 브라우저 overlay
- macOS 투명 floating desktop companion
- 메뉴바 상태/설정
- Gemini API 키 등록/교체
- Codex 로그인 상태 확인
- Antigravity/Gemini 연결 확인
- 강아지 템플릿 변경
- 집 모드/활동 모드
- 쓰다듬기, 꼬리 흔들기, 짖기 인터랙션
- GitHub Releases 기반 데스크톱 자동 업데이트
- npm registry 배포

## 상태 모델

Pawtrol은 세션을 네 가지 상태로 요약합니다.

- `normal`: 세션이 정상적으로 진행 중
- `watch`: 곧 확인하면 좋은 상태
- `risk`: 컨텍스트, 토큰, 반복 실패 위험이 커진 상태
- `intervene`: 지금 사람이 직접 개입하는 편이 좋은 상태

기본 상태에서는 보리가 조용히 있습니다. 알림이 필요한 상황에서만 말풍선이 나타납니다.

## 설치

### CLI 설치

Pawtrol은 npm registry에 배포되어 있습니다.

```bash
npm install -g pawtrol
pawtrol doctor
```

전역 설치 없이 바로 실행할 수도 있습니다.

```bash
npx -y pawtrol@latest doctor
```

현재 배포 확인:

```bash
npm view pawtrol version bin
```

검증된 버전:

```bash
npx -y pawtrol@0.1.1 doctor
```

### macOS 데스크톱 앱 다운로드

최신 macOS 앱은 GitHub Releases에서 받을 수 있습니다.

```text
https://github.com/Huride/puppy/releases/latest
```

릴리스에는 다음 파일이 포함됩니다.

- `Pawtrol-<version>-arm64.dmg`
- `Pawtrol-<version>-arm64-mac.zip`
- `latest-mac.yml`
- blockmap files

패키징된 앱은 GitHub Releases를 기준으로 자동 업데이트를 확인합니다.

### 로컬 개발 실행

```bash
git clone https://github.com/Huride/puppy.git
cd puppy
npm install
npm run app
```

동일한 실행 alias:

```bash
npm start
npm run run:dev
npm run app:dev
```

### 로컬 CLI 링크

저장소를 clone한 상태에서 전역 CLI로 연결하려면:

```bash
npm install
npm install -g .
pawtrol doctor
```

## 요구사항

- Node.js와 npm
- macOS: 현재 floating desktop companion 기준
- 선택: Codex CLI
- 선택: Gemini API key
- 선택: OpenAI API key
- 선택: Anthropic API key

API 키가 없어도 Pawtrol은 로컬 휴리스틱 분석으로 동작합니다.

## 인증 및 연동

Pawtrol은 로그인 방식을 하나만 고르면 그 방식에 맞는 LLM을 자동으로 사용합니다. 선택한 방식은 `.env.local`의 `PAWTROL_PROVIDER`에 저장됩니다.

### 한 번만 로그인하기

```bash
pawtrol login gemini --key "$GEMINI_API_KEY"
pawtrol login openai --key "$OPENAI_API_KEY"
pawtrol login claude --key "$ANTHROPIC_API_KEY"
pawtrol login antigravity --key "$GEMINI_API_KEY"
pawtrol login codex
```

API 키 기반 로그인은 현재 작업 디렉터리의 `.env.local`에 키와 `PAWTROL_PROVIDER`를 저장합니다. 키 값은 출력하지 않습니다.

Codex 로그인은 Codex CLI의 로그인 흐름을 사용합니다. Pawtrol은 Codex 토큰을 직접 읽지 않습니다. OpenAI API 키가 있으면 OpenAI 분석을, 없으면 local heuristic 분석을 사용합니다.

기존 `pawtrol auth ...` 명령도 호환용으로 유지됩니다.

### 로그인 상태 확인

```bash
pawtrol doctor
pawtrol auth codex --status
pawtrol auth antigravity --status
```

예상 출력에는 provider 키 설정 여부, 활성 로그인 provider, 추천 모델, Codex 로그인 상태, Antigravity/Gemini readiness가 포함됩니다.

### 로컬 smoke check

clone한 저장소에서는 다음 명령으로 로컬 연동 상태를 한 번에 확인할 수 있습니다.

```bash
npm run auth:check
```

실제 Gemini API 요청까지 확인하려면:

```bash
PAWTROL_AUTH_LIVE=1 npm run auth:check
```

## CLI 사용법

### 에이전트 명령 감시

```bash
pawtrol watch --provider auto -- codex exec "fix failing tests"
pawtrol watch --provider gemini -- codex exec "fix failing tests"
pawtrol watch --provider heuristic -- node scripts/demo-agent.mjs
```

Pawtrol은 감시 중인 명령을 그대로 실행하면서 stdout/stderr를 관찰합니다. 실행 중에는 local overlay URL을 출력합니다.

```text
Pawtrol overlay: http://localhost:8787
```

CLI-only 방식으로 사용할 때는 이 URL을 브라우저에서 열면 됩니다.

### Provider 선택

```bash
pawtrol watch --provider auto -- codex run "fix failing tests"
pawtrol watch --provider gemini --model gemini-3-flash-preview -- codex run "fix failing tests"
pawtrol watch --provider openai --model gpt-5.2 -- codex run "fix failing tests"
pawtrol watch --provider claude --model claude-sonnet-4-5 -- claude "fix failing tests"
pawtrol watch --provider heuristic -- node scripts/demo-agent.mjs
```

Provider key:

```bash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

`--provider auto`는 `PAWTROL_PROVIDER`에 저장된 로그인 provider를 우선 사용합니다. 저장된 provider가 없거나 키가 없으면 Gemini, OpenAI, Claude, local heuristic 순서로 사용 가능한 provider를 선택합니다. `--model`을 넘기지 않으면 provider별 추천 모델을 사용합니다.

현재 기본 추천 모델:

- Gemini: `gemini-3-flash-preview`
- OpenAI: `gpt-5.2`
- Claude: `claude-sonnet-4-5`
- Heuristic: `local-heuristic`

### Plan share

```bash
pawtrol watch --provider gemini --share-plan -- codex run "fix failing tests"
```

이 명령은 `.pawtrol/session-plan.md`를 생성합니다. Codex, Gemini Antigravity, 다른 코딩 에이전트가 이어받을 수 있는 세션 요약입니다.

## 데스크톱 앱

```bash
npm run app
```

데스크톱 앱은 작은 투명 Electron companion window를 띄우고, deterministic demo agent를 자동 실행합니다. 브라우저에서 `localhost`를 직접 열 필요가 없습니다.

macOS 메뉴바의 `Pawtrol > 로그인/연동`에서 로그인 방식을 하나만 고르면 됩니다.

- Gemini API
- OpenAI API
- Claude API
- Codex CLI 로그인
- Gemini Antigravity

최초 실행 시 사용할 수 있는 로그인 방식이 없으면 설정 안내가 표시됩니다. 패키지 앱에서 저장한 API 키는 앱 번들 내부가 아니라 앱 데이터 디렉터리에 저장됩니다.

예:

```text
~/Library/Application Support/Pawtrol/.env.local
```

## 보리 인터랙션

보리는 상태에 따라 다르게 움직입니다.

- 기본 상태: 아무 말 없이 걷거나 쉬기
- 주의 상태: 말풍선으로 조용히 알림
- 위험 상태: 짖는 애니메이션과 함께 개입 요청
- 클릭: 상태 팝업 열기
- 짧게 드래그/쓰다듬기: 꼬리 흔들기와 반응 문구
- 오른쪽으로 밀기: 집 모드
- 집 클릭: 활동 모드로 복귀
- 메뉴바: Bori, Nabi, Mochi 템플릿 변경

## 상태 팝업

강아지를 클릭하면 상태 팝업이 강아지 위로 표시됩니다. 팝업에는 다음 정보가 포함됩니다.

- 현재 봐야 할 문제 작업
- 컨텍스트 사용률
- 토큰 ETA
- 반복 실패 횟수
- CPU 사용률
- 메모리 사용률
- AI 요약
- 추천 다음 행동

## 브라우저 데모

```bash
npm run watch:demo
```

출력된 overlay URL을 브라우저에서 열면 됩니다.

```text
http://localhost:8787
```

demo agent는 반복되는 auth test failure와 token ETA를 deterministic하게 출력하므로, Pawtrol의 상태 변화와 팝업을 안정적으로 확인할 수 있습니다.

## 프로젝트 구조

```text
src/cli.ts                 CLI entrypoint
src/cli-options.ts         CLI argument parser
src/auth/setup.ts          Gemini/Codex/Antigravity auth helpers
src/coach/                 LLM provider, prompt, heuristic coach
src/session/               signal extraction, resources, plan share, watcher
src/server/overlay-server.ts
src/overlay/               browser overlay UI and Bori animation
src/desktop/               Electron desktop app, menu bar, updater
scripts/auth-check.mjs     local auth smoke check
scripts/demo-agent.mjs     deterministic demo agent
tests/                     unit and integration tests
```

## 배포

### npm 배포

Pawtrol은 npm package `pawtrol`로 배포됩니다.

```bash
npm install -g pawtrol
```

현재 npm 배포 버전은 `0.1.1`입니다.

### GitHub Release

GitHub Release에는 macOS 앱 산출물이 포함됩니다.

```text
https://github.com/Huride/puppy/releases/latest
```

패키지 앱은 GitHub Releases를 통해 자동 업데이트를 확인합니다.

### 새 릴리스 만들기

GitHub repository secret에 `NPM_TOKEN`이 있어야 합니다.

```bash
npm version patch
git push origin main
git push origin v0.1.2
```

`v*` 태그가 push되면 GitHub Actions release workflow가 실행됩니다.

Workflow가 수행하는 일:

- 테스트 실행
- `pawtrol` npm publish
- macOS 앱 빌드
- GitHub Release artifact 업로드
- Electron auto-update metadata 생성

## 현재 배포 상태

- npm package: `pawtrol@0.1.1`
- CLI command: `pawtrol`
- GitHub Release: `v0.1.1`
- macOS artifact: `Pawtrol-0.1.1-arm64.dmg`
- 자동 업데이트: GitHub Releases 기반
