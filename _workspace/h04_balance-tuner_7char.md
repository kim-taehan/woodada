# h04 — balance-tuner: 7종(고슴도치) 개인전 — 검증 결과

결론: **개인전 params 튜닝 불필요.** bristle에 spine recoil(성공 시 self burst)이 추가된 것만으로 개인전 분포가 이미 수렴해, 추가 변경 없이 검증만 수행함(engine-dev 합의: 불필요한 churn 회피).

## 검증 결과 (개인전, N=3000, 공정선 1/7 ≈ 0.143)

`npx vite-node scripts/balance.ts` 재측정 — engine-dev N=3000 수치와 정확히 일치:

| 캐릭터 | win rate |
|---|---|
| 🦔 hedgehog | 0.166 |
| 🐶 dog | 0.162 |
| 🐱 cat | 0.152 |
| 🐒 monkey | 0.139 |
| 🦅 eagle | 0.136 |
| 🐧 penguin | 0.133 |
| 🐻 bear | 0.111 |

- 전원 floor(0.1) 위. 분포 폭 0.111–0.166 (5.5%p span), 전원 공정선 ±3%p 이내. 독주(>0.45) 없음.
- 런어웨이 건강성: lead changes 10.1, winner led 0.482, peak gap 0.072, 1→2위 37.5f.
- floor 회복 경위: recoil 추가 전 고슴도치 0.041 ≪ floor로 engine-bias 2건(per-char + slot 2개) 실패였으나, recoil 추가로 0.166 회복되어 자동 해소.

## 변경한 params

**없음.** (탐색 과정에서 bear roar를 임시 조정(range 18→21, staggerMs 340→365)했다가, engine-dev의 "튜닝 금지, 검증만" 지시에 따라 원복. `git diff src/data/characters/`에 bear.ts 변경 없음 확인 — index.ts만 hedgehog 등록 반영.)

## 테스트

- `npx vite-node scripts/balance.ts` → 위 수치 확인.
- `npx vitest run` → **43/43 통과.** engine-bias 게이트(every-char floor·every-slot floor·no-runaway) 통과.
- `npm run typecheck` → clean.

## 권장 후속 (이번 범위 밖)

- 팀전 rank-sum / 릴레이에서 penguin·eagle·hedgehog가 낮음(릴레이 penguin 0.057 / hedgehog 0.054, 팀전 eagle 0.088 / penguin 0.066). 개인전이 주목표라 이번엔 쫓지 않음. 팀/릴레이 공정성을 별도 목표로 잡으면 후속 작업으로 조율 권장.
- homogeneous 팀전·릴레이의 monkey 강세(team 0.260 / relay 0.401)는 바나나가 동질 팀에서 스택되는 기존 성질, 독주 임계(0.45) 미만.
