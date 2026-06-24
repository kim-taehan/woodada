# 06 — balance-tuner: 개인전 승률 평탄화

목표: 6명 개인전 승률을 공정선(1/6 ≈ 0.167) ±5%p 안으로 수렴. params만 조정.

## 결과 (개인전, N=3000)

| 캐릭터 | before | after | Δ |
|---|---|---|---|
| 🐶 dog | 0.238 | 0.177 | ↓ |
| 🐱 cat | 0.238 | 0.172 | ↓ |
| 🐧 penguin | 0.166 | 0.186 | ≈ |
| 🐻 bear | 0.131 | 0.155 | ↑ |
| 🐒 monkey | 0.128 | 0.158 | ↑ |
| 🦅 eagle | 0.099 | 0.151 | ↑↑ |

분포 폭 0.151–0.186 (3.5%p span) — 전원 ±5%p 안. 모두 floor 위.

런어웨이 건강성 유지: lead changes 9.7 (불변), winner led 0.498 (≈0.501), peak gap 0.073, 1→2위 37.6f.

## 변경한 params (전 → 후)

**dog** (zoomies):
- burstMin 0.5 → 0.42, burstMax 1.1 → 0.92, burstMs 520 → 470
- (strayChance 0.32, strayLane 0.45 불변)

**cat** (catwalk):
- windowMs 1500 → 1350, dodgeChance 0.6 → 0.52, slipBoost 0.16 → 0.11

**eagle** (divebomb):
- stunMs 700 → 720, selfRiskChance 0.5 → 0.47, diveBurst 0.9 → 0.92, diveBurstMs 800 → 850
- (range 70 불변. "도박형" 역할 보존: 여전히 ~47% 자폭 리스크)

monkey·bear는 직접 손대지 않음 — dog/cat 하향으로 자연 상승해 목표 안으로 들어옴.

## 튜닝 루프

1. R1: dog↓, cat↓, eagle↑(공격적: selfRisk 0.42, burst 1.0/950ms) → eagle 0.213로 오버슈트(새 독주).
2. R2: eagle 리스크 일부 복원(selfRisk 0.47, burst 0.92/850ms) → 0.151 안정권. 나머지 전원 수렴.

## 검증

- `npx vitest run` → 43/43 통과. **engine-bias 게이트(floor 0.1, ceil 0.6, slot-fairness, no-runaway) 통과.**
- `npm run typecheck` → clean.
- 팀전/릴레이 회귀: 새로 깨진 것 없음. 단 homogeneous 팀전/릴레이에서 monkey가 강함(team 0.312, relay 0.454) — 바나나가 동질 팀에서 스택되는 **기존 성질**이며 이 작업(개인전) 목표 밖. 개인전 평탄화를 희생하면서까지 쫓지 않음. 별도 팀/릴레이 조율이 필요하면 후속 작업으로.
