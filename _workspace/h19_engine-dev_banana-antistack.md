# h19 — engine-dev: 바나나 안티스택 면역창 (banana anti-stack immunity)

요청: 릴레이 원숭이 독주(monkey 0.338, ~2x) 해소. 진단(balance-tuner): 3랩 누적 **순차 스택**(스턴 풀린 직후 팀원이 같은 표적 재스턴). banana hit 후 짧은 면역창으로 재피격 차단.

## 구현

- `src/engine/types.ts` SkillRuntime에 `bananaImmuneUntil?: number` 추가(직렬화 OK).
- `src/engine/skills/banana.ts`:
  - 후보 필터에 `frame >= (r.skill.bananaImmuneUntil ?? 0)` 추가 → 면역 중인 표적 제외(다음 표적 선택 or whiff).
  - hit 처리 시 `target.skill.bananaImmuneUntil = frame + stunFrames + immuneFrames` 설정. `immuneFrames = (params.immuneMs ?? 900)/DT_MS`.
  - 기존 'stunned' 제외(동시 중첩 방지)는 유지. 새 무작위 없음(결정론 유지).
- `src/data/characters/monkey.ts` params에 `immuneMs: 900` 추가(balance-tuner 튜닝 레버; 핸들러 fallback 900과 일치).
- 스코프 최소: banana만. 다른 스턴 스킬 일반화 안 함(지시대로).

## 검증

- `npm run typecheck`: 통과.
- `npx vitest run`: **43/43 통과**(determinism "경주 길이" 단언 포함 — 면역창이 길이에 문제 안 줌).

## 밸런스 재측정 (N=3000) — 전 → 후

| 모드 | 항목 | before | after |
|---|---|---|---|
| 개인 | monkey | ~0.139 | **0.134** (floor 위, ±5%p 안) |
| 개인 | 전체 | 0.130~0.159 | 0.127~0.165 (수렴 유지, 독주 없음) |
| 팀 rank-sum | monkey | 0.148 | 0.148 (변화 없음) |
| **릴레이** | **monkey** | **0.338** | **0.338 (변화 없음 — 목표 미달)** |

개인/팀은 영향 거의 없음(의도대로). **그러나 릴레이 독주는 해소되지 않음.**

## ⚠️ 핵심 발견: 진단된 메커니즘이 시뮬레이션과 불일치

릴레이 300경주 계측:
- banana hit ≈ 3032회(경주당 ~10회), 면역 대상 racer 15종.
- **면역창 내 재피격 시도 = 0회.**

즉 면역창은 정상 작동하나(재피격 0), **애초에 "스턴 풀린 직후 같은 표적 순차 재스턴"이 시뮬에서 일어나지 않는다.** 릴레이는 핸드오프마다 주자가 교체(progress=0 리셋)되어 "같은 표적"이 유지되지 않으므로, 순차 same-victim 스택은 발생하지 않음. → 원숭이 릴레이 독주(0.338)의 진짜 원인은 순차 재스턴이 아니라 **다른 요인**(예: monkey의 banana가 매 레그 새 표적을 광범위하게 방해해 상대 팀 누적 손실↑, 또는 릴레이 스코어링/레그 구조와의 상호작용)으로 보임.

## 권고 (임의 과튜닝 안 함)

- 요청된 면역창은 **정확·무해(개인/팀 무영향, 결정론·테스트 통과)**하게 들어갔고, 향후 진짜 순차 스택이 생겨도 막아준다. 유지 권장.
- 단 **릴레이 독주는 이 메커닉으로 해결 안 됨** — 진단 재검토 필요. balance-tuner/팀리드 결정 사안:
  1. monkey 릴레이 한정 약화(릴레이에서 cooldown↑ 또는 hitStun↓ — 단 개인 floor 주의), 또는
  2. 릴레이 스코어링/레그 누적 구조에서 disruptor 이득이 증폭되는지 별도 분석, 또는
  3. 면역창을 "팀 전체가 던진 바나나"에 대해 누적 차단하는 더 강한 안티스택(스코프 확장 — 팀리드 승인 필요).
- 면역창을 무작정 늘려도(immuneMs↑) 재피격이 0이라 릴레이 수치는 안 내려감 → 의미 없는 과튜닝이므로 하지 않음. immuneMs는 900 유지.

## 통지

- 렌더러/콘텐츠 영향 없음(이벤트 계약 불변, banana variant 그대로). bananaImmuneUntil은 엔진 내부 상태.
