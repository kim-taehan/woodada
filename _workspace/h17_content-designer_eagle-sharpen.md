# h17 content-designer — 독수리 외형 차별화 (vs 펭귄)

사용자: "독수리랑 펭귄이 너무 비슷, 독수리를 더 날카롭게." 둘 다 정면 biped 새라 실루엣이 겹침. 독수리를 사납고 날카롭게 다듬어 구분. 베이비 스키마(2.5등신, 큰 눈)·runStyle(biped)·포즈 키는 유지.

## 수정 파일
1. `src/data/characters/eagle.ts` — palette 강화(맹금류 톤, 대비↑) + `crest` 키 추가.
2. `src/data/partmodels/eagle.ts` — 날카로운 피처로 재설계(파트 이름·포즈 키 유지).

## palette 변경 (펭귄 흑백과 대비)
- base `#6B4F36`→`#5E3F26` (짙은 초콜릿 브라운)
- point `#F1EEE8`→`#F6F2E6` (밝은 크림, 대비↑)
- outline `#3E2D1C`→`#2E2013` (더 어둡고 선명)
- cheek `#E89AA0`→`#E08A86` (덜 사탕같은 blush)
- beak `#F2B33A`→`#F6A81E` (날카로운 골든오렌지 부리/발톱)
- wing `#5A4129`→`#43301D` (몸과 대비되는 더 어두운 깃)
- **crest 신규 `#2A1D12`** (near-black 뾰족 깃/angry brow)

## partmodel 날카로움 포인트
- **크레스트(crest)**: 정수리에서 위/뒤로 솟은 뾰족한 깃 삼각 3개. **head 파트의 첫 shapes로 인라인**(head 원 뒤에 그려짐) → 별도 파트 안 만들고 head bob/포즈를 자동 추적(별도 파트면 biped run의 head dy bob을 못 따라가 머리에서 분리됨 — 그래서 인라인 채택).
- **angry brow**: 눈 위로 부리 쪽으로 각지게 내려오는 어두운 눈썹 2개(crest 색). 사나움의 핵심 큐.
- **부리**: 작은 삼각 → 크고 긴 **후크형 raptor 부리**(끝이 뾰족하게 말림). 펭귄의 작은 삼각과 대비.
- **눈**: 크기 유지(베이비)하되 brow 아래로 약간 내려 배치(눈매 날카롭게). cy -2→4.
- **머리 cap**: 매끈한 둥근 cap → **아래 가장자리가 들쭉날쭉(jagged) 각진 cap**.
- **날개(armL/armR)**: 끝이 둥근 플리퍼 → **뾰족한 flight-feather 팁**(노치 있는 path). 펭귄 플리퍼와 대비.
- **발(legL/legR)**: 직선 발가락 → **굽은 날카로운 talon 발톱**(curved path).
- **꼬리**: 단순 부채꼴 → 끝이 갈라진 **뾰족한 꼬리깃**.

## 포즈 (rot=도) — 키 유지
crest를 head에 인라인했으므로 별도 crest 델타 불필요(head 델타가 crest까지 이동시킴). skill/win/fall 기존 head·arm 델타 그대로.

## renderer-dev 인계
- **파트 이름·개수 변화 없음**(tail/legL/legR/body/armL/armR/head). crest는 head 내부 shape라 새 파트 아님 → 렌더러 절차 분기/RaceRenderer 변경 불필요.
- 새 palette 키 `crest` 추가 → partsFactory가 palette 키를 resolve하므로 자동 적용(확인 권장). 미해결 키면 fallback 동작 확인 부탁.
- 시각검증: 독수리 vs 펭귄 한눈 구분 + 포즈(idle/run/skill/win/fall) 깨짐 없는지 Playwright 캡처 권장.

## 검증 (직접 수행)
- typecheck 통과(eagle 관련 에러 0).
- Playwright 캡처(penguin+eagle 2종, 신선한 dev 서버 5199): **독수리가 펭귄과 한눈에 구분됨** 확인 — 뾰족 크레스트/angry brow/큰 후크 부리/뾰족 날개팁/노란 talon이 또렷, 베이비 큰 눈은 유지(사납지만 귀여움). 임시 spec/스크린샷 삭제.
- 인프라 메모: 5173/5180 dev 서버가 `__woodada` 없는 stale 상태였음 → 5199에 신선 서버 띄워 캡처. (이건 내 변경과 무관, 환경 이슈.)
