---
name: woodada-build
description: 우다다 동물 경주 게임의 멀티영역 작업을 에이전트 팀(engine-dev·renderer-dev·content-designer·qa-verifier)으로 조율하는 오케스트레이터. 캐릭터 추가, 새 스킬, 렌더러/연출 변경, 밸런스 튜닝, 전체 검증처럼 engine·data·renderer·qa가 얽히는 작업에 사용. "캐릭터 추가/만들어줘", "새 동물/스킬", "연출 바꿔줘", "밸런스 맞춰줘", "전체 검증/품질게이트", 그리고 후속 표현("다시/재실행/업데이트/수정/보완/이어서/방금 거 개선") 시 트리거. 단순 단일파일 질문·읽기는 직접 응답 가능.
---

# woodada-build — 우다다 빌드 오케스트레이터

귀여운 동물 경주 추첨 게임(Vite + TS + PixiJS v8, 물리엔진 없음). engine·data·renderer·qa 4개 경계가 얽히는 작업을 **에이전트 팀**으로 조율한다.

**실행 모드: 에이전트 팀 (기본).** 팀원은 SendMessage로 직접 통신하고 TaskCreate로 작업을 공유하며 자체 조율한다.

**모델 분배 (한도 절약):** Agent 호출 시 작업 성격으로 모델을 나눈다.
- **Sonnet** — 기계적·저위험: 등록/라벨/index 와이어링, 데이터 값 조정, 문서·테스트 목록 갱신, 스크린샷 캡처 실행 (예: content-designer의 파츠 등록·테스트 갱신).
- **Opus** — 복잡·위험: 엔진 코어 로직(결정론·스킬 핸들러·스코어링·추월), 밸런스 추론, 새 설계, 회귀를 냈던 까다로운 영역 (예: engine-dev의 스킬 구현).
- 한 에이전트가 두 성격을 겸하면 더 위험한 쪽 기준으로 Opus.

## 팀 구성
| 에이전트 | 영역 | 비고 |
|---|---|---|
| `content-designer` | `src/data/` 캐릭터·파츠·이름·모드·팀 | 역할 비중복, 베이비 스키마 |
| `engine-dev` | `src/engine/` 스킬·결정론·스코어링·밸런스 | 엔진 순수성 수호 |
| `renderer-dev` | `src/renderer/` Pixi·연출·FX | **시각검증 필수** |
| `shell-dev` | `src/shell/` 화면·RoomStore·DOM UI | 엔진/렌더러 소비만, 직렬화 상태 |
| `balance-tuner` | 개인/팀/릴레이 모드 승률 조율 (`skill.params`만) | 독주 방지, engine-bias 게이트 |
| `qa-verifier` | typecheck+unit+e2e, 경계면 교차검증 | 점진적 QA, 스크린샷 육안 |

상세 역할·통신 프로토콜은 `.claude/agents/<name>.md` 참조.

## Phase 0: 컨텍스트 확인
워크플로우 시작 시 실행 모드를 결정한다:
- `_workspace/` 존재 + 사용자가 부분 수정/개선 요청 → **부분 재실행** (해당 에이전트만 재호출, 이전 산출물 읽고 개선점만 반영)
- `_workspace/` 존재 + 새 입력 → **새 실행** (기존 `_workspace/`를 `_workspace_prev/`로 이동)
- `_workspace/` 미존재 → **초기 실행**

## Phase 1: 작업 분류 (라우팅)
요청을 워크플로우로 분류하고 필요한 에이전트만 팀에 넣는다:

| 요청 유형 | 주도 | 협업 | 패턴 |
|---|---|---|---|
| **캐릭터 추가** | content-designer | engine-dev(새 스킬 시) → renderer-dev → qa-verifier | 파이프라인 + 점진 QA |
| **새 스킬만** | engine-dev | content-designer(params) → qa-verifier | 생성-검증 |
| **렌더러/연출** | renderer-dev | qa-verifier(시각검증) | 생성-검증 |
| **밸런스 튜닝** | balance-tuner | engine-dev(로직 보강 필요 시)·qa-verifier(bias) | 모드별 측정→조정→재측정 루프 |
| **UI/화면/모드 흐름** | shell-dev | content-designer(데이터)·engine-dev(설정 필드) | 데이터→셸→렌더러 파이프라인 |
| **전체 검증** | qa-verifier | — | 단독 게이트 |

> 단일 영역·소규모면 팀을 구성하지 말고 해당 에이전트 1명만 서브에이전트로 호출(오버헤드 절약). 2개 이상 영역이 얽힐 때만 팀.

## Phase 2: 팀 실행

### 워크플로우 A — 캐릭터 추가 (대표 케이스)
순차 의존이 있으므로 파이프라인 + 각 단계 직후 점진 QA:
1. **content-designer**: CharacterData + PartModel + index/라벨/DEFAULT_IDS 등록. 역할 비중복 확인. 새 스킬 type이면 params 명세를 engine-dev에 전달.
2. **engine-dev** (새 스킬일 때만): 핸들러 `skills/<type>.ts` + 등록. 기존 type 재사용이면 건너뜀.
3. **qa-verifier** (점진): 여기서 schema/skills 테스트 + typecheck 즉시 실행.
4. **renderer-dev**: 새 치비가 귀엽게 그려지는지 Playwright 캡처 후 육안 확인.
5. **qa-verifier** (최종): 전체 게이트 + 경계면 교차검증 + 스크린샷 육안.

### 워크플로우 B — 밸런스 튜닝
engine-dev가 `npx vite-node scripts/balance.ts`로 승률 측정 → 독주(>0.45)/약체(<0.18) 발견 시 `skill.params`만 조정 → 재측정 비교 → qa-verifier가 `engine-bias` 통과 확인. 과한 정밀 튜닝 지양.

### 워크플로우 C — 렌더러/연출
renderer-dev가 변경 → **반드시** `race-visual.spec.ts` 캡처 후 Read로 육안 → qa-verifier가 회귀(골든) 확인.

### 워크플로우 D — 전체 검증
qa-verifier 단독: typecheck → test → e2e → 스크린샷 육안 → 요약.

## Phase 3: 데이터 전달 프로토콜
- **태스크 기반**(조율): TaskCreate로 의존 관계·진행 추적.
- **파일 기반**(산출물): `_workspace/{NN}_{agent}_{artifact}.md`. 최종 코드만 `src/`에 출력, 중간물은 `_workspace/` 보존(감사 추적).
- **메시지 기반**(실시간): 경계면 변경 통지(새 스킬 type, 새 SkillEvent.variant 등).

## Phase 4: 에러 핸들링
- 에이전트 1회 재시도 후 재실패 → 해당 결과 없이 진행하되 최종 보고에 누락 명시.
- 테스트 실패는 책임 에이전트에 구체적 회부(파일·라인·로그). 결정론 깨짐 → engine-dev, 시각 깨짐 → renderer-dev.
- 상충 데이터는 삭제하지 않고 출처 병기.
- **품질 게이트 미통과 시 완료로 보고 금지.** 특히 렌더러 변경은 스크린샷 육안 확인 없이는 미완료.

## Phase 5: 실행 후 피드백
완료 후 사용자에게 한 번 기회를 준다: "결과나 팀 구성에서 바꾸고 싶은 점이 있나요?" 피드백 유형별 반영: 결과물 품질→해당 에이전트, 역할→에이전트 정의, 순서→이 오케스트레이터, 트리거 누락→description. 변경은 `CLAUDE.md`의 하네스 변경 이력에 기록.

## 테스트 시나리오
- **정상 흐름**: "고양이 캐릭터 추가해줘(스킬: 잠깐 멈춰서 그루밍하다 폭발 대시)" → Phase0 초기실행 → Phase1 캐릭터추가 분류 → content-designer가 데이터+파츠(새 스킬 type 'groom') → engine-dev가 핸들러 → qa점진검증 → renderer-dev 캡처/육안 → qa최종 → 통과 보고.
- **에러 흐름**: renderer-dev 스크린샷에서 캐릭터가 안 보임 → 회전단위(도/라디안) 의심 회부 → 1회 수정 후 재캡처 → 그래도 실패면 현황과 함께 보고(완료 처리 금지).
