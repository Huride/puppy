# CMUX x AIM Hackathon Guide 정리

원문: [Google Docs](https://docs.google.com/document/d/1fe4_8hlBywThVZ4nyXXho82eS7izX3q4VR5q2tthhTg/edit?tab=t.0)

## 행사 개요

CMUX x AIM Hackathon은 2026년 4월 26일 일요일, 서울에서 오전 8시부터 오후 8시까지 진행되는 AI 해커톤이다. Manaflow, AIM Intelligence, AI Nexus, AttentionX가 주요 후원 및 운영 주체로 참여한다.

주요 트랙은 다음 3개다.

| 트랙 | 설명 |
|---|---|
| Developer Tooling | CLI-first 개발자 도구, 터미널 워크플로, 에이전트 오케스트레이션, 코드 생성, 디버깅 |
| Business & Applications | 하루 안에 AI 기반 제품을 빌드하고 배포 |
| AI Safety & Security | AI 취약점 탐색, 노출, 방어. Red teaming CLI, guardrail pipeline, jailbreak detection, prompt injection scanner, LLM fuzzing 등 |

## 일정

| 시간 | 프로그램 |
|---|---|
| 08:00 | Doors Open, Breakfast |
| 08:30 | Opening |
| 09:00 | Hacking Starts |
| 13:00 | Lunch |
| 18:00 | Submissions Close, Dinner, Round 1 Judging Begins |
| 19:25 | 6 Finalists Announced |
| 19:30 | Final Pitches |
| 20:00 | Winners Announced |

## 후원사

| 후원사 | 요약 |
|---|---|
| [Manaflow](https://manaflow.com/) | Agentic era를 위한 오픈소스 applied AI lab. 대표 제품인 [cmux](https://github.com/manaflow-ai/cmux)는 coding agent를 위한 오픈소스 터미널이다. |
| [AIM Intelligence](https://www.aim-intelligence.com/) | 엔터프라이즈 AI 보안 회사. Stinger(자동 red teaming)와 Starfort(실시간 guardrail)를 통해 text, image, audio, video 전반의 AI 취약점에 대응한다. |
| [AI Nexus](https://ainexus.community) | AI 빌더 커뮤니티 기반 이벤트 에이전시. 전 세계 6개 지역에서 해커톤 및 기술 이벤트를 운영한다. |
| [AttentionX](https://attentionx.org/) | 서울 기반 AI 연구 및 스타트업 그룹. Berkeley, Stanford, KAIST, Google DeepMind 등 학계와 산업계 빌더들이 참여하며 연구, 오픈소스, 실제 제품화를 지향한다. |

## 상금 및 혜택

| 구분 | 상금/혜택 |
|---|---|
| Grand Prize | 3,000,000원 |
| Developer Tooling | 1,000,000원 |
| Business & Applications | 1,000,000원 |
| AI Safety & Security | 1,000,000원 |
| Student Special | $5,000 Azure credits |

## 심사위원

### Track Judges

| 이름 | 요약 | 링크 |
|---|---|---|
| Sejun Kim | E Corp. CEO, socialseed.ing 운영자. AI developer tools, automation workflow, agent-first product에 집중 | [LinkedIn](https://www.linkedin.com/in/combba/) |
| Jun Kim | Aside 공동창업자 겸 CEO. 이전에는 Airbridge(AB180) 초기 멤버 | [LinkedIn](https://www.linkedin.com/in/therne) |
| Kyungseok Hur (허경석) | 베트남 소규모 온라인 셀러를 위한 커머스 플랫폼 PAYAP CEO. Kakao Mobility 사업개발 경험 | [LinkedIn](https://www.linkedin.com/in/kyungseok-hur-b41629117) |
| Sangguen Chang | E Corp. 공동창업자. AI agent, developer tooling, practical AI system 중심의 serial entrepreneur | [LinkedIn](https://www.linkedin.com/in/sgwannabe/) |
| Suho Park | AIM Intelligence Product Manager. Shinhan AI PB 및 B2B AI agent platform Alli 경험 | [LinkedIn](https://www.linkedin.com/in/suho-park-637908194) |
| Kyungsoo Kim | KT Agentic AI Lab Staff AI Product Designer. AI service와 conversational agent UX 설계 | [LinkedIn](https://www.linkedin.com/in/kimkyungsoo) |
| Juhyun Song | KAIST Hacking Lab 보안 연구자. TEE, OS, DBMS 자동 보안 평가 연구 | [LinkedIn](https://www.linkedin.com/in/juhyun-song-267231395/) |
| Dasol Choi | AIM Intelligence Principal Researcher. AI safety evaluation 및 red-teaming 전문가 | [LinkedIn](https://www.linkedin.com/in/dasol-choi-570797261/) |
| Yeeun Kim | KT AI Engineer. MyK Agent의 LLM 기반 agent 개발 및 평가 담당 | [LinkedIn](https://www.linkedin.com/in/yeahrlo) |
| Pia Park | Systems and cryptography engineer. Secure LLM sandbox, security awareness, infra, Rust/Python/TypeScript 경험 | [Website](https://www.piapark.me/), [LinkedIn](https://www.linkedin.com/in/pia-park/) |
| Dan Han (한관엽) | Aleph Lab(YC F25) CEO 겸 공동창업자 | [LinkedIn](https://www.linkedin.com/in/gy-han/) |
| Jiwoo (Chloe) Lee | 연세대/Imperial College London Ph.D. Candidate. 반도체 dopant selection에 ML 적용 연구, 대학원생 커뮤니티 앱 창업 | [LinkedIn](https://www.linkedin.com/in/bagstrap-jiwoo) |
| Taeung Kang | Frontend engineer. Healthcare, platform, community domain에서 UX, 성능 최적화, 시스템 아키텍처 경험 | [LinkedIn](https://www.linkedin.com/in/%EA%B0%95%ED%83%9C%EC%9B%85) |
| Seonmin Lee | defytheodd(d8d) CEO/CAIO. Enterprise AX 프로젝트, AI system integration, Polysona open-source 관련 경력 | [LinkedIn](https://www.linkedin.com/in/lilmgenius/) |
| Vadim Choi | Leviosa AI CTO. Antler Korea Cohort 8, GSC/AngelHack 수상 경험 | [LinkedIn](https://www.linkedin.com/in/vadimtsoi) |

### Final Judges

| 이름 | 요약 | 링크 |
|---|---|---|
| Haon Park | AIM Intelligence CEO | [LinkedIn](https://www.linkedin.com/in/haonpark) |
| Austin Wang | Manaflow Founder & CEO | [cmux.com](http://cmux.com), [manaflow.com](http://manaflow.com), [austinywang.com](http://austinywang.com), [LinkedIn](https://www.linkedin.com/in/austinwang115) |
| Sukone Hong | AttentionX Co-President & Fund General Partner | [AttentionX](https://attentionx.org/), [LinkedIn](https://www.linkedin.com/in/my-name-is-sukone) |

## 장소 및 크레딧

| 항목 | 내용 |
|---|---|
| Location | [모나코스페이스](https://maps.app.goo.gl/St3J8Xf4n5KWvzxbA) |
| Vercel | $30 v0 credits, code: `V0-MANAFLOW`, [v0.app](https://v0.app/) |
| Claude | $25 offer link: [Claude offer](https://claude.com/offers?offer_code=5bd9a20b-2b47-47ba-9e64-b82db0cc01cf) |
| Gemini | 원문에 API key가 포함되어 있으나 민감정보이므로 이 정리본에서는 제외 |
| Venue Wifi | 원문에 네트워크 접속 정보가 포함되어 있으나 민감정보이므로 이 정리본에서는 제외 |

## 채점 기준

### Developer Tooling

CLI-first developer tools, terminal workflow, agent orchestration, code generation, debugging을 중심으로 평가한다.

| Criterion | 1 - Surface | 2 - Functional | 3 - Solid | 4 - Impressive | 5 - Exceptional |
|---|---|---|---|---|---|
| Technical Depth (30%) | Basic wrapper around existing tools, no novel engineering | Working integration with some custom logic | Non-trivial engineering, handles edge cases | Complex architecture, custom protocols or parsers | Novel technical contribution, publication-worthy depth |
| Developer Experience (25%) | Hard to install, confusing UX, poor feedback | Works but has friction; docs are incomplete | Smooth CLI/API, reasonable defaults, helpful errors | Thoughtful ergonomics, great error messages, fast | "This is how it should work." Immediately intuitive |
| Usefulness & Real-World Fit (25%) | Unclear who benefits or when you'd use it | Useful in narrow, specific scenarios only | Solves a real daily pain point for developers | Many devs would reach for this immediately | Fills an obvious gap; hard to unsee it |
| Demo & Presentation (10%) | Hard to follow what the tool does | Shows it works but misses the compelling use case | Concrete demo, explains the value well | Live demo lands; judges want to try it themselves | Story + demo make the case unforgettably |
| Judge's Personal Rating (10%) | Not interesting or compelling to me personally | Somewhat interesting but wouldn't think about it again | Solid idea; I can see the appeal | I'd tell a colleague about this | This genuinely excites me; I want to see it succeed |

### Business & Applications

하루 안에 AI-powered product를 만들고 배포하는 역량을 평가한다.

| 기준 | 1 - 모호함 | 2 - 일반적 | 3 - 명확함 | 4 - 날카로움 | 5 - 설득력 있음 |
|---|---|---|---|---|---|
| 문제 및 시장 명확성 (25%) | 명확한 문제 정의가 없고, 문제를 억지로 찾는 솔루션처럼 보임 | 문제는 존재하지만 너무 넓고, 구체적인 사용자 pain point가 없음 | 문제가 명확하고 대상 사용자를 식별할 수 있음 | 근거가 있는 구체적 pain point와 명확한 ICP가 있음 | 긴급하고 크며 충분히 해결되지 않은 문제를 강한 인사이트로 제시함 |
| 제품 완성도 (20%) | 슬라이드 덱 또는 목업 수준이며 실제 동작 기능이 없음 | 한 가지 정상 경로에서는 동작하지만 거친 부분이 많음 | 핵심 루프가 end-to-end로 동작하고 실제 상황에서 사용 가능함 | 여러 흐름, 오류 상태, 실제 데이터를 처리함 | 오늘 바로 사용자에게 전달할 수 있는 수준이며 24시간 결과물로 인상적임 |
| AI 통합 (20%) | AI가 장식적 요소에 가깝고, AI 없이도 제품이 동작함 | AI가 한 기능을 개선하지만 핵심은 아님 | AI가 제품 경험의 중심에 있음 | AI 없이는 제품이 존재할 수 없고, 새로운 행동을 가능하게 함 | AI가 패러다임을 바꾸며 10배 수준의 개선을 만듦 |
| 비즈니스 실현 가능성 (15%) | 수익화 또는 지속 가능성에 대한 고민이 없음 | "SaaS 요금을 받겠다" 정도의 일반적 아이디어만 있고 구체성이 없음 | 현실적인 unit economics가 포함된 명확한 모델이 제시됨 | GTM, 가격 정책, 경쟁 우위가 다뤄짐 | traction과 성장 가능성에 대해 설득력 있는 근거를 제시함 |
| 데모 및 발표 (10%) | 제품이 무엇을 하는지 따라가기 어려움 | 동작은 보여주지만 설득력 있는 use case를 놓침 | 구체적인 데모로 가치를 잘 설명함 | 라이브 데모가 잘 전달되고, 심사위원이 직접 써보고 싶어짐 | 스토리와 데모가 결합되어 잊기 어려울 만큼 설득력 있음 |
| 심사위원 개인 평가 (10%) | 개인적으로 흥미롭거나 설득력 있게 느껴지지 않음 | 어느 정도 흥미롭지만 다시 떠올릴 정도는 아님 | 탄탄한 아이디어이며 매력을 이해할 수 있음 | 동료에게 이야기하고 싶을 정도임 | 진심으로 기대되고, 성공하는 모습을 보고 싶음 |

### AI Safety & Security

AI 취약점을 찾고, 노출하고, 방어하는 프로젝트를 평가한다. Red teaming, guardrail, jailbreak detection, prompt injection scanner, LLM fuzzing 등이 포함된다.

| Criterion | 1 - None | 2 - Vague | 3 - Defined | 4 - Rigorous | 5 - Expert |
|---|---|---|---|---|---|
| Threat Model & Rigor (30%) | No clear attack or vulnerability being targeted | Identifies a class of risk but no specific threat model | Clear threat scenario with attacker goals and assumptions | Formal or structured threat model; edge cases considered | Publication-quality threat analysis; novel framing |
| Technical Novelty (20%) | Simply implements a well-known attack or defense verbatim | Applies existing technique to a new model/context | Non-trivial modification or combination of known methods | Meaningfully new approach; not obvious from prior work | Original contribution; team discovered something new |
| Effectiveness & Evidence (25%) | Claims made without evidence or reproducible results | A few examples shown; not systematic | Consistent results across multiple test cases | Quantified success rate; benchmarked against baselines | Statistically sound; works across models/conditions |
| Responsible Disclosure & Ethics (5%) | No consideration of misuse potential or disclosure | Aware of risks but no plan to address them | Dual-use discussed; some mitigations proposed | Clear disclosure policy; defensive framing throughout | Model of responsible red-teaming; could be a case study |
| Demo & Presentation (10%) | Hard to follow what the project does | Shows it works but misses the compelling use case | Concrete demo, explains the value well | Live demo lands; judges want to try it themselves | Story + demo make the case unforgettably |
| Judge's Personal Rating (10%) | Not interesting or compelling to me personally | Somewhat interesting but wouldn't think about it again | Solid idea; I can see the appeal | I'd tell a colleague about this | This genuinely excites me; I want to see it succeed |

## 제출 안내

제출 전 확인해야 할 사항:

1. 팀당 하나의 제출만 허용된다. 한 명의 팀원만 제출 폼을 작성해야 하며, 중복 제출은 실격 처리될 수 있다.
2. 제출 마감은 오후 6시 정각이다. 늦은 제출은 인정되지 않을 수 있다.
3. 심사를 위해 현장에 있어야 한다. 최소 한 명의 팀원이 오후 6시 30분부터 시작되는 현장 심사에 참여 가능해야 한다.
4. 제출 전 배포된 데모 링크, GitHub repo URL, 모든 팀원의 이름과 이메일을 준비해야 한다.
5. 제출 항목이 누락되면 실격 처리될 수 있다. 특히 demo link가 중요하며, localhost link는 유효한 demo로 인정되지 않는다.

제출 폼: [Google Forms](https://docs.google.com/forms/d/e/1FAIpQLSeOBwkyvS2aaVz4KwVhviHp30wue4ADqmT6SMUls10tsWwing/viewform?usp=dialog)

## 심사 방식

1. Submissions
   - 참가자는 제출 폼을 통해 프로젝트를 제출한다.
2. Track Round
   - 각 팀은 심사위원에게 비공개 현장 발표를 진행한다.
   - 팀당 발표 3분, 심사위원 평가 2분.
   - 각 트랙의 모든 발표가 끝나면 심사위원이 트랙별 1등과 2등을 선정한다.
   - 선정된 팀은 Finalist Round에 진출한다.
3. Finalist Round (Public Presentations)
   - 진출 팀은 다시 발표한다. 트랙별 2팀, 총 6팀.
   - 전체 청중 앞에서 현장 발표로 진행된다.
   - 팀당 발표 시간은 3분이다.
4. Final Judging & Awards
   - Grand winner와 track winner를 발표한다.

## 규칙

1. 팀당 최대 4명까지 가능하며, 개인 참가도 가능하다.
2. 개인 프로젝트 재사용은 금지된다.
3. 프로젝트는 오후 6시 전에 제출해야 한다.
4. 부정행위나 규칙 위반은 즉시 실격 처리된다.
5. 주최 측은 행사 취지에 어긋나는 프로젝트를 실격 처리할 권리를 가진다.
6. 수상자는 상금을 받기 위해 시상식에 현장 참석해야 한다.
7. 상금 및 혜택 지급은 후원사가 직접 처리하며, 일정은 달라질 수 있다.
