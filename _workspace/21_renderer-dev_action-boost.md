# 21 · renderer-dev · 스킬 "액션" 가시성 강화 (punchy)

피드백 "스킬 액션이 약해 잘 안 보인다" 대응. FX·글로우·✨·스킬 포즈·말풍선을 결정적 파라미터만 키워 발동을 한눈에 읽히게 했다. typecheck PASS, e2e 3 spec PASS, before/after 육안 검증 완료. 결정론·엔진 피드백 0 유지(무작위 시각요소 추가 없음).

## 변경 파일
- `src/renderer/fx/FxLayer.ts` — dust/speedLines/stars/sparkle/bananaThrow/whiff/shockwave 크기·수·지속 상향. **신규 `pop()`**(발동 순간 코어+링 플래시).
- `src/renderer/RaceRenderer.ts` — 글로우 헤일로 크기·밝기 상향, 글로우 지속 연장, `activate` 변형에 `fx.pop` 호출.
- `src/renderer/character/PartsCharacter.ts` — `straying`(스킬) 포즈 **진폭 1.8×·블렌드 0.4 스냅** + **스킬 추진 자세**(root.rotation 전방 숙임).
- `src/renderer/fx/SpeechBubble.ts` — 폰트·패딩·TTL 상향.

## 강화 수치 (before → after)

### FX (FxLayer)
| FX | 항목 | before | after |
|---|---|---|---|
| dust | 개수/반경/ttl | 10 / 4~10 / 0.55s | 14 / 6~15 / 0.7s |
| speedLines | 개수/길이/굵기/ttl/속도 | 4 / 26 / 3 / 0.35s / 220 | 6 / 38~58 / 5 / 0.45s / 300 |
| stars | 개수/폰트/ttl/속도 | 7 / 18 / 0.8s / 46 | 10 / 24~30 / 1.0s / 64 |
| sparkle(✨) | 개수/폰트/반경/ttl | 6 / 15~19 / 32 / 0.8s | 9 / 20~32 / 40 / 1.0s |
| bananaThrow(🍌) | 폰트/ttl/lift | 22 / 0.4s / 70 | 34 / 0.5s / 80 |
| whiff(휙~) | 폰트/ttl | 18 / 0.6s | 24 / 0.7s |
| shockwave(roar) | 링 굵기/grow/ttl | 단일 11 / 11 / 0.6s | **2중 링** 18 / 12 / 0.7s + add 내부링 |
| **pop (신규)** | — | 없음 | 백색 add 코어(r18, grow1.1, 0.24s) + tint 링(r20, w8, grow3, 0.5s) — `activate`에만 |

### 글로우 헤일로 (누가 썼는지 표시 — RaceRenderer)
- before: 외곽 r60 amber α0.9 + 백색 r42 + 링 r62 w5
- after: **외곽 r88 amber α0.55 + r64 진한 amber + 백색 r44 + 링 r90 w7** (더 크고 또렷, 밝은 필드에 안 묻힘)
- 지속: 일반 1.1s→**1.6s**, catwalk 면역창 1.6s→**2.0s**, 릴레이 핸드오프 1.1s→**1.6s** (인지 시간 확보)

### 스킬 포즈 동작 (PartsCharacter, `straying` phase)
- 포즈 델타 진폭 **×1.8**(rot=degree이므로 eagle -34° 날개 젖힘→약 -61°도 범위 내 안전), 블렌드 0.25→**0.4**(브리프한 스킬 창 안에 스냅).
- 전방 스트레치 1.18→**1.26**, **스킬 추진 자세** 신설: `root.rotation = dir*(0.2 + |sin|*0.1)` 라디안(≈13°+ 전방 숙임). fly(독수리)는 호버 유지 위해 제외.
- **회전 단위 함정 준수**: 파트 rot은 도(×1.8 진폭), root.rotation은 라디안(0.2rad). 분리 처리.

### 말풍선 (SpeechBubble)
- 폰트 15→**19**, 패딩 +18/+12 → +24/+16, 라운드 10→12, 테두리 2.5→**3.5**, 꼬리 확대, TTL 1.4s→**1.7s**.

## 시각 검증 (Playwright desktop, before/after Read 육안)
경로: `tests/e2e/__screens__/race-*.png` (현 시드 7 로스터에 펭귄 합류로 발동 프레임 캐릭터는 일부 이동, 연출 평가는 동일 적용).
- **roar(곰6 포효)** — before: 옅은 반투명 단일 hoop, 거의 안 보임 → after: **굵은 2중 링 충격파 + 강한 글로우 헤일로 + 큰 "크아앙!!" 말풍선**. 발동이 명확.
- **zoomies(우다다)** — after: 발동 본인에 큰 amber 글로우 + "우다다다다!!!" 큰 말풍선 + dust/speedLines. 누가 폭주하는지 즉시 식별.
- **catwalk(고양이)** — after: 고양이에 글로우 + "캣워크~ 🐱" 큰 말풍선 + 뒤로 흐르는 큼직한 ✨★ 잔상. 도도한 슬립 또렷.
- **busiest(roar+zoomies+catwalk 동시)** — 최악 적층 프레임. pop 코어를 r26→r18로 1차 캡처 후 하향 튜닝 → 곰 얼굴이 흰 코어에 묻히지 않으면서 충격파·글로우는 강한 균형 확보. 트랙·레인·아이템박스 비가림.
- **reduced-motion 회귀** — 파티클·글로우·pop 전부 `!reducedMotion` 게이트라 0개, 정적 필드 유지(말풍선만 커짐=모션 아님). 회귀 없음.
- 비스킬(start/mid/finish/result/lastlap)·릴레이·auto-scale·조끼 경로 미접촉. 골든 `newcast/` 3장 유지.

## 슬로우모션 — shell 회부 의견
FX/포즈/글로우/말풍선을 키워 정지 프레임에선 충분히 읽힌다. 다만 **실시간 재생**에서 발동 클러스터가 빠르게 지나가면 (특히 본 시드처럼 3스킬 동시 발동) 강화한 연출도 순식간에 스쳐 인지가 짧을 수 있다. 글로우 지속은 1.6~2.0s로 늘려 잔상 시간을 확보했으나, **발동 순간 슬로우모션 지속/강도를 약간 키우면**(RaceController, 셸 소관) pop·shockwave 임팩트 피크가 더 잘 읽힌다. 직접 셸 수정은 범위 밖 — shell-dev 검토 권고(선택).

## content-designer 피드백 (선택)
- 스킬 포즈 델타가 작은 캐릭터(dog: head dx5/tail -16, bear: head dy-3·귀 ±6)는 렌더러 ×1.8로 보완했지만, 데이터 단에서 스킬 포즈를 더 특징적으로(예: 곰 포효 시 머리 크게 젖힘 rot, 강아지 폭주 시 몸 숙임) 주면 ×1.8 없이도 또렷. 합의 시 partmodels에서 조정 가능(현재는 렌더러 증폭으로 충분).

## 회귀/불변
- typecheck PASS. e2e race-visual 3 spec PASS. 결정론(파라미터만 상수 변경, 무작위 0). 엔진 피드백 0.
