# h28 content-designer — eagleProfile(샘플3) production 정식 반영

사용자가 샘플3(측면 "진짜 새")를 선택 → production 독수리로 이관. (탐색 샘플 _workspace/eagle-samples.ts의 eagleProfile → src/data 정식.)

## 합의 (renderer-dev)
- **runStyle 새 값 `'glide'` 채택.** 측면 프로필이라 진행방향 좌우 미러(inner.scale.x=dir) 필요하지만 4발 다리 사이클은 금지(난다). glide = 측면 미러 ON + 다리 사이클 OFF + 틸트 글라이드(앞 ~11° + 약한 lift + 완만 bob, flap 없음). 렌더러에 glide 분기는 renderer-dev가 추가, 기존 front-facing 'fly' 특수처리는 제거 예정.
- schema runStyle은 string, 테스트에 KNOWN_RUNSTYLE 검증 목록 없음 → **'glide' 추가에 schema/test 변경 불필요**(qa 협의 불필요했음).
- 파트 이름은 샘플 그대로.

## 수정 (production)
1. `src/data/partmodels/eagle.ts` — 정면 치비 → **측면 프로필 리그**로 전면 교체.
   - 파트(z순): `tail`(z0, -x 꼬리깃) / `legR`(z0, 원측 다리·FARLEG #B07814 darker) / `body`(z2, 유선형+크림 가슴) / `legL`(z1, 근측 talon 다리) / `wingL`(z3, 근측 접은 날개·노치 깃, flutter 대상) / `head`(z5, +x 향함, crest+어두운 정수리+무거운 brow ridge+눈+긴 후크부리+cere 점).
   - 좌표: 머리 우측(+x), 꼬리 좌측(-x). 깊이 색 로컬 const: TALON #D9981A, FARLEG #B07814.
2. `src/data/characters/eagle.ts` — **runStyle 'biped' → 'glide'** + 주석. divebomb params/이벤트 계약(activate/hit/dodge) **불변**(밸런스 튜닝값 stunMs720/selfRiskChance0.47/diveBurst0.92/diveBurstMs850 그대로). palette 키 동일(cheek는 이제 미사용이나 무해해 유지 — 외과적).

## 포즈 (측면 기준, rot=도, +x=진행방향)
- idle `{}`, run `{}` (glide 절차 애니에 맡김 — 다리 정적, 틸트/호버).
- skill(divebomb=폴짝 박치기 lunge): `head{dx:8,dy:2}`, `body{dx:4,dy:-3}`, `wingL{rot:-16}`, `tail{rot:10}` — 머리부터 앞으로 들이박고 살짝 뜸.
- win: `head{dy:-5}`, `wingL{rot:-22}`, `tail{rot:-8}`.
- fall: `head{rot:18}`, `wingL{rot:24}`, `tail{rot:16}`.

## renderer-dev 인계
- PartsCharacter에 'glide' 분기 추가(측면 미러 + 틸트/호버, 다리 정적, flap 없음; wingL/tail 미세 스트림은 renderer 판단). 기존 'fly' 분기 정리.
- divebomb FX의 측면 정합(머리 lunge 방향 = 진행방향) 확인.
- eagle 포트레이트(docs/img/eagle.png)/골든 스크린샷 갱신.

## 검증
- typecheck 전체 0 에러. 파트/포즈 스키마 적합.
- 시각검증은 renderer glide 분기 작성 후 일괄(측면 미러가 트랙 상/하단·곡선에서 방향 맞는지, 박치기 lunge가 앞으로 나가는지).
- production 반영이므로 신중히: divebomb 밸런스/계약·등록·다른 캐릭 무영향. 샘플 파일(_workspace/eagle-samples.ts)은 그대로 둠(이력).
