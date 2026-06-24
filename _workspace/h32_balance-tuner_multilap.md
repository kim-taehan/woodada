# h32 — balance-tuner: 멀티랩(10바퀴) 개인전 조율

요청: 10바퀴 개인전 분포 평탄화(원숭이↓·독수리 꼴찌↓·펭귄↑), 단판(1바퀴) 게이트(44/44, engine-bias floor/ceil/slot/no-runaway) 절대 유지. 팀/릴레이 보류. skill.params만.

측정: 임시 하니스 `scripts/_multilap.ts`(7종×1, laps=10, maxFrames=60*400, seed 0~N, 등수분포 집계) 추가→측정→**삭제 완료**. 1바퀴는 기존 `scripts/balance.ts` + `vitest`로 가드.

## 결론 요약

- **채택 (skill.params만)**: monkey banana hitStunMs 1200→1050·dodgeChance 0.06→0.10 / eagle divebomb selfRiskChance 0.47→0.42 / penguin icefield boostFactor 1.03→1.06.
- **단판 게이트 44/44 green 유지**(최우선 충족). 전원 floor 위, 독주 없음.
- 10바퀴: 원숭이 독주 크게 완화(2.65→3.1x), 펭귄 약체 해소(4.49→~4.1, 1등 5%→13%). **독수리 꼴찌(~30%)는 params로 거의 못 잡음 — 구조적, engine-dev 회부**(아래).

## 10바퀴 분포 (N=100, 사용자 시드범위와 동일) — 전 → 후

평균등수(공정선 4.0) / 1등% / 꼴찌%

| 캐릭터 | before | after |
|---|---|---|
| 🐒 monkey | 2.65 / 32% / **0%** | **3.17 / 29% / 3%** |
| 🐶 dog | 3.95 / 16% / 11% | 3.84 / 15% / 14% |
| 🐱 cat | 4.09 / 14% / 17% | 3.93 / 7% / 9% |
| 🐻 bear | 4.11 / 13% / 11% | 4.06 / 15% / 13% |
| 🐧 penguin | 4.49 / **5%** / 18% | **4.12 / 13% / 12%** |
| 🦔 hedgehog | 3.98 / 7% / 9% | 4.45 / 4% / 16% |
| 🦅 eagle | 4.73 / 13% / **34%** | 4.43 / 17% / **33%** |

(N=300 안정 측정도 동일 경향: monkey 3.08, penguin 3.90(1등16%), eagle 4.43(꼴찌28%), 나머지 3.85~4.33.)

분포 폭(평균등수 최고−최저): **2.08 → 1.28**로 수축. monkey·penguin 목표 달성. 독수리 평균은 4.73→4.43으로 개선됐으나 꼴찌%는 거의 불변.

## 1바퀴(단판) 분포 — 게이트 가드 (N=3000)

| | before | after |
|---|---|---|
| penguin | 0.159 | 0.187 |
| eagle | 0.146 | 0.166 |
| cat | 0.176 | 0.164 |
| dog | 0.146 | 0.141 |
| hedgehog | 0.129 | 0.125 |
| monkey | 0.129 | 0.113 |
| bear | 0.132 | 0.109 |

전원 floor(0.1) 위·ceil 아래, no-runaway 유지. `engine-bias` 3/3 green.

## 변경한 param (전 → 후)

- **monkey** (`src/data/characters/monkey.ts`): hitStunMs 1200→1050, dodgeChance 0.06→0.10. (cooldown 불변 — 변경 시 engine-determinism 깨짐, h18 기확인.)
- **eagle** (`src/data/characters/eagle.ts`): selfRiskChance 0.47→0.42. (stunMs·diveBurst 등 불변.)
- **penguin** (`src/data/characters/penguin.ts`): boostFactor 1.03→1.06 (펭귄 자기 빙판 가속만 강화, slowFactor 0.80 불변 → 타 캐릭 피해 안 늘림).

## 트레이드오프 (수치 근거 — team-lead 판단용)

1. **monkey를 10바퀴 공정선(±0.6=3.4↑)까지 못 내림** — 현재 3.08~3.17. 더 내리려 hitStunMs를 1000으로·dodge↑ 하면 **단판 monkey가 floor(0.1) 밑/턱(0.0975~0.1)으로 떨어져 engine-bias FAIL**. 단판 게이트 최우선이라 1050에서 멈춤. 즉 단판 floor와 10바퀴 평탄화가 monkey에서 부분 충돌 — 현 지점이 양립 최선.

2. **eagle 꼴찌 ~30%는 params로 해결 불가 (구조적)** — selfRiskChance가 유일 레버인데, 낮추면 꼴찌%가 줄기보다 **자폭→승리로 전환되어 1등%가 오르며 재양극화**(0.38: 꼴찌29%/1등20%, 0.42: 28%/16%, 0.47: 31%/14%). 평균은 좋아지나 "win-or-last" 양극화 자체는 안 풀림. stunMs↓(720→580)도 시도 → 공격력만 깎여 오히려 악화(4.43→4.63). 진짜 탈양극화엔 **divebomb 핸들러의 자폭 페널티 완화**(예: 자폭 시 풀스턴 대신 약한 감속, 또는 멀티랩 자폭 빈도 상한)가 필요 — engine 로직 영역.
   → **engine-dev 회부 권고**: 자폭(실패) 시 페널티를 stunMs 전량이 아닌 일부로(예: 자폭 전용 selfStunMs 파라미터 신설) 분리하면, 공격력 유지한 채 꼴찌%만 낮춰 멀티랩 양극화를 풀 수 있음.

## 검증

- `npx vitest run` → **44/44 통과** (engine-bias floor/ceil/slot/no-runaway + determinism + stats + relay + skills).
- `npm run typecheck` → clean.
- 임시 하니스 `scripts/_multilap.ts` 삭제 완료.
- 팀/릴레이는 보류(미측정·미조정).
