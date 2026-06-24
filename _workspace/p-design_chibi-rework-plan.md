# 디자인 개선 계획 — 측면 캐릭터 다듬기 (계획만, 확정)

## 결론
스타일 전환 없음. 모두 **측면 유지**하고 디테일만 다듬어 또렷·귀엽게.

| 캐릭터 | 현재 | 할 일 |
|---|---|---|
| 🐶 개 | 측면 gallop | 유지 + 다듬기 |
| 🐱 고양이 | 측면 gallop | 유지 + 다듬기 |
| 🦅 독수리 | 측면 glide ("진짜 새") | 유지 + 다듬기 |
| 🦔 고슴도치 | 측면 gallop | 변경 없음 (귀여움 확정) |

runStyle 변경 없음. 대부분 **partmodel 아트만** 손본다.
예외: 독수리 **날개 펄럭임**은 `PartsCharacter.ts`의 `glide` 분기(시간 기반 날개 애니메이션) 변경.
주의: 파트 `rot`=도(degree), `root.rotation`=라디안.

## 캐릭터별 다듬기 포인트

### 🐶 개 (src/data/partmodels/dog.ts)
- 측면 비율 정리: 머리 약간 키우고 눈 동그랗게(치비 인상↑).
- 펄럭이는 귀·살랑 꼬리 가독성.
- 다리 스윙 진폭(run 포즈 델타) 자연스럽게 — 과하거나 모자라지 않게.

### 🐱 고양이 (src/data/partmodels/cat.ts)
- 측면 비율 정리: 뾰족 귀·동그란 눈·가는 꼬리 또렷.
- 다리 스윙·등선 다듬기. catwalk 발동 포즈 도도하게.

### 🦅 독수리 (src/data/partmodels/eagle.ts + PartsCharacter.ts glide) — 가장 애매했던 핵심
- 비율 정리: 머리/부리/몸통/날개 대비 또렷하게(지금 흐릿한 게 애매함 원인).
- 부리·눈썹 각 더 날카롭게(사나운 인상).
- 비행 중 다리접기 디테일 또렷.
- 날개 윤곽 가독성↑.
- **날개 펄럭임 추가**: 지금은 날개 펼친 채 고정(글라이드). `PartsCharacter.ts`의 `glide` 분기에서 날개 파트 `rot`을 시간(sin)으로 진동시켜 펄럭이게. 진폭/속도는 너무 빠르지 않게(우아한 활공+간헐 펄럭 느낌). 파트 rot=도(degree) 주의. (이건 partmodel뿐 아니라 렌더러 코드 변경 → renderer-dev 담당, 시각검증 필수.)
- "진짜 새" 측면 콘셉트는 보존.

## 작업 주체
- content-designer: 위 partmodel 아트 다듬기(개·고양이·독수리).
- renderer-dev: Playwright 캡처 후 **육안 검증**(측면이 또렷하고 귀여운지). 렌더러 변경은 새 경주 시작 시 반영.
- qa-verifier: partmodel 변경으로 **골든 스크린샷 깨짐 → 새 모습 확인 후 리베이스**. 엔진 무변경 → determinism/balance 영향 0.

## 검증 기준
- `npx playwright test race-visual.spec.ts --project=desktop` → __screens__ 캡처 Read 육안.
- 개·고양이가 측면에서 또렷·귀엽고, 독수리가 또렷·날카로운지.
- 결정론/밸런스 불변(아트만 변경).

## 상태
계획 확정. 구현은 사용자 승인 시 착수.
