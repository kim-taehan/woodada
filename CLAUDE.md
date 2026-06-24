# CLAUDE.md — 우다다 (woodada)

귀여운 동물들이 원형 트랙을 달려 순위를 정하는 **동물 경주 추첨 게임** (사다리 게임의 동물 경주판).
Vite + TypeScript + PixiJS v8. 물리엔진 없음(규칙 + 시드 PRNG).

## 명령어
```bash
npm run dev        # 개발 서버 (http://localhost:5173, 점유 시 5174)
npm run typecheck  # tsc --noEmit (커밋 전 필수)
npm run test       # Vitest 엔진 단위테스트
npm run e2e        # Playwright 시각 검증 (시스템 Chrome 사용: channel 'chrome')
npm run build      # 프로덕션 번들
npx vite-node scripts/balance.ts   # 밸런스 하니스(승률·역전 횟수 출력)
```

## 아키텍처 (계약 우선 — 절대 깨지 말 것)
```
src/engine/    순수 시뮬레이션. DOM/Pixi/window import 0. 입력=(설정+시드) → 출력=프레임/순위.
src/renderer/  PixiJS 전용. EngineFrame을 그리기만. 시뮬레이션에 피드백 X.
src/transport/ RoomTransport 추상화 (v1: LocalTransport).
src/shell/     DOM UI: setup→countdown→race→result.
src/data/      데이터 주도 콘텐츠 (characters/, partmodels/, modes, names).
tests/unit/    Vitest   tests/e2e/  Playwright(스크린샷은 __screens__/)
```
엔진은 `progress`(전후) + `lane`(0=인코스~1=아웃코스, 연속값)만 안다. 트랙 모양·화면은 렌더러 책임이며 시뮬레이션에 영향 없음.

## 불변 규칙 (어기면 버그/테스트 실패)
- **엔진 순수성**: `src/engine/`에 DOM/Pixi/`Math.random()` 금지. 모든 무작위성은 `engine/prng.ts`의 시드 `Rng`로만. 스킬·아이템은 안정 라벨로 `rng.fork('skill:'+id)` 등 서브스트림 사용(드로 순서 의존 금지).
- **결정론**: 같은 (config + seed)는 동일한 경주를 재생. 단위테스트(determinism)·골든 스크린샷이 이에 의존.
- **회전 단위 함정**: `PartsCharacter`에서 파트 `rot`는 **도(degree)** (`*DEG`로 변환). 다리/팔 스윙 진폭은 수십 도 단위. 한편 `root.rotation`(전체 기울기)은 **라디안**. 헷갈리면 애니메이션이 안 보이거나 과함.
- **레인**: 레이서마다 `homeLane`을 흩뿌리고 wander로 누빔. **레인은 속도에 영향 없음**(인코스 쏠림 방지). 추월=위빙, 양옆 막히면 감속.
- **밸런스는 보류 중**: 정밀 승률 튜닝 대신 느슨한 공정성 테스트(`engine-bias`: 모든 캐릭터/슬롯이 이길 수 있고 아무도 독주 안 함)만 유지. 스킬 수치는 `CharacterData.skill.params`로 빼서 추후 튜닝.

## 캐릭터 추가 방법 (데이터 주도, 스펙 §2.4)
1. `src/data/characters/<id>.ts` — `CharacterData` (palette, runStyle, renderScale?, skill{type,cooldownMs,params}, lines).
2. `src/data/partmodels/<id>.ts` — `PartModel` (idle 파츠 + 포즈 델타). 정면 치비 기준(강아지만 측면).
3. 두 index에 등록: `data/characters/index.ts`(catalog + `defaultCharacterIds`), `data/partmodels/index.ts`.
4. `src/shell/screens/SetupScreen.ts`의 `CHAR_LABEL`에 이모지.
5. **새 스킬이면** `src/engine/skills/<type>.ts` 핸들러 + `skills/index.ts` 등록. 기존 type 재사용이면 데이터만.
6. 영향받는 테스트 갱신: `tests/unit/schema.test.ts`(KNOWN_SKILL_TYPES, catalog 목록), `skills.test.ts`(활성 스킬 집합).
7. `src/main.ts`의 `DEFAULT_IDS`(시각 캡처 로스터)에 넣으면 스크린샷에 등장.

캐릭터 후보·스킬 아이디어 카탈로그: `docs/animal-skill-catalog.md`.

## 현재 로스터 & 역할 (겹치지 않게)
| 캐릭터 | 역할 | 스킬 type | 패시브 |
|---|---|---|---|
| 🐶 강아지 | 부스트·변칙 | `zoomies` | 스턴 회복 (스턴 시 50% 단축) |
| 🐰 토끼 | 변칙 (자기발목) | `nap` | - |
| 🐒 원숭이 | 방해·저격 | `banana` | 아이템 잔머리 (shell/fart/swop, lightning→star 40%) |
| 🐘 코끼리 | 방어 (탱크) | `brace` | - |
| 🐻 곰 | 방해·광역 | `roar` | 몸통 밀치기 (접촉 시 상대 아웃코스 밀어냄) |
| 🦔 고슴도치 | 뒤 추격 방어자 | `bristle` | 역전 특화 (꼴등일수록 최대 10% 속도 부스트) |
| 🦊 여우 (구미호) | 치사한 은밀러 | `illusionClone` | 작은 표적 (원거리 방해 15% 회피) |

### 상호 보안 시너지
- **고슴도치**: 뒤에서 추격할 때 강함 (역전 특화) + 뒤 등수 주기적 저격 (2~3 초마다)
- **여우**: 선두/중위권 유지 (역전 없음) + 원거리 방해 일부 회피 + 분신 교묘 사용

## 시각 검증 (스펙 §13 — 필수)
프론트엔드/렌더러를 바꾸면 **Playwright로 캔버스를 스크린샷 찍어 눈으로 확인**한 뒤 완료로 친다.
- `npx playwright test race-visual.spec.ts --project=desktop` → `tests/e2e/__screens__/`에 출발/스킬발동/마지막바퀴/결과 등 캡처.
- 캔버스는 접근성 트리로 못 보므로 반드시 이미지로 확인. 렌더러 변경은 **새 경주 시작 시** Pixi 씬이 생성되어 반영됨.
- 결정적 캡처 훅: 브라우저 `window.__woodada.simulate()` / `showRaceAt(frame, opts)` (main.ts).

## 연출/게임성 메모
- 스킬 발동 시: 큰 FX + 머리 위 말풍선 + **슬로우모션**(RaceController) + **사용자 글로우·✨**(누가 쓰는지 표시).
- 하단 **실황 중계 자막**(병맛 톤, `renderer/fx/commentaryLines.ts`), 트랙 **랜덤 아이템 박스**(부스트/미끄덩), 멀티랩 **랩 카운터 + "마지막 바퀴!" 배너 + 종소리**, 결과는 **파란 필드 시상대 + 깝치기**.

## 하네스: 우다다 빌드

**목표:** engine·data·renderer·qa 경계가 얽히는 작업을 전문 에이전트 팀으로 조율해 계약 위반 없이 빌드/검증한다.

**트리거:** 캐릭터/스킬 추가, 렌더러·연출 변경, 밸런스 튜닝, 전체 검증처럼 2개 이상 영역이 얽히는 작업 요청 시 `woodada-build` 스킬을 사용하라(후속 "다시/수정/보완" 포함). 단일 파일 질문·읽기는 직접 응답 가능. 빠른 수동 트리거로 슬래시 커맨드 `/add-character`·`/balance`·`/verify`도 유지된다.

**구성:** 에이전트 `.claude/agents/`(engine-dev·renderer-dev·content-designer·qa-verifier), 오케스트레이터 `.claude/skills/woodada-build/`.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-17 | 초기 구성 (4 에이전트 + 오케스트레이터) | 전체 | 하네스 신규 구축 |
| 2026-06-18 | shell-dev 에이전트 추가 | agents/shell-dev.md, woodada-build | 셸/DOM UI 경계 담당 부재(팀전 UI 작업 중 발견) |
| 2026-06-18 | balance-tuner 에이전트 추가 | agents/balance-tuner.md, woodada-build | 밸런스를 engine-dev에서 분리, 개인/팀/릴레이 교차 조율 전담 요청 |
| 2026-06-22 | 모델 분배 규칙 도입 (기계적=Sonnet, 복잡·위험=Opus) | woodada-build | 주간 사용 한도(특히 Opus 캡) 절약, 기계적 작업은 품질차 미미 |
