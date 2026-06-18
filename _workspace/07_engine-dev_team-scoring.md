# Phase 1 (엔진) — 팀 스코어링 정합 확인

작성: engine-dev / 2026-06-18
범위: `src/engine/scoring/team.ts` 가 임의 teamId(red/blue/white/black) · 가변 팀 수(2~4)에 올바로 동작하는지 확인. 릴레이(Phase 2)는 건드리지 않음.

## 결론: 소스 변경 없음 (스코어링 경로는 이미 일반화되어 있음)

`teamRankSum`/`teamAce` 는 **고정 teamId 가정도, 고정 2팀 하드코딩도 없다.** 그대로 임의 teamId·가변 팀 수에 동작한다. 회귀 방지용 단위테스트 1개만 추가.

## 근거 (코드 인용)

`src/engine/scoring/team.ts` `teamRanks()` — teamId 로 동적 그룹핑:

```ts
const byTeam = new Map<string, number[]>();
for (const p of config.participants) {
  const team = p.teamId ?? p.id;          // 임의 문자열 teamId 그대로 키로 사용
  const arr = byTeam.get(team) ?? [];
  arr.push(rankOf[p.id]);
  byTeam.set(team, arr);
}
return [...byTeam.entries()].map(([teamId, ranks]) => { ... });  // 팀 수 = Map 크기, 가변
```

- 팀 키는 `p.teamId` 문자열 **그대로**. `'A'/'B'` 같은 리터럴 비교·분기가 어디에도 없다 → `'red'/'blue'/'white'/'black'` 도 동일 경로.
- 팀 목록은 `Map` 엔트리에서 파생 → **팀 수는 1..N 가변**. 정렬은 가변 길이 배열에 대한 `sort` (`team.ts:46`, `team.ts:58`)라 2팀 하드코딩 없음.
- `teamId` 미배정 시 `?? p.id` 로 1인 1팀 폴백 → 개인 참가자가 섞여도 안전.

`src/engine/RaceEngine.ts:285` — 모드의 scoringId 로 전략 선택, 팀 수 무관:
```ts
const strategy = scoring.get(config.scoringId) ?? scoring.get('individual')!;
```
`src/data/modes.ts:10` — `team` 모드 → `scoringId: 'teamRankSum'`.
`src/engine/RaceEngine.ts:92` — `teamId: p.teamId` 가 참가자→RacerState 로 그대로 전달.

엔진 내 teamId 사용처(skills/roar.ts:19, banana.ts:22)도 `r.teamId === self.teamId` 동등 비교만 — 임의 id 일반.

## 추가한 회귀 테스트 (tests/unit/scoring.test.ts)

4팀(red/blue/white/black), 팀당 2명, 골인 p0..p7 시나리오:
- red{1,5}=6, blue{2,6}=8, white{3,7}=10, black{4,8}=12
- 기대 순위 `['red','blue','white','black']`, detail 합산값 검증.
- 목적: 임의 teamId 일반화·가변 팀 수(4팀)의 회귀 방지.

## 자가검증 결과

- `npm run typecheck`: 통과 (에러 0)
- `npx vitest run`: **27 tests / 7 files 전부 통과**
  - scoring.test.ts 5/5 (신규 4팀 테스트 포함)
  - engine-determinism.test.ts 4/4
  - engine-bias.test.ts 2/2

## 변경 파일

- `tests/unit/scoring.test.ts` (테스트 1개 추가) — 소스/엔진 변경 없음.

## 팀 통신

- content-designer/shell-dev: 엔진 스코어링은 `participant.teamId` 가 `red/blue/white/black` 중 하나로 실리기만 하면 추가 작업 없이 팀 랭크합산이 동작함. 모드는 `team`(scoringId `teamRankSum`) 그대로.
- qa-verifier: 스코어링 결정론에 영향 주는 변경 없음(테스트만 추가).
