# h05 content-designer — 🦔 고슴도치 측면 네발(gallop) 재설계

사용자 요청: "엎드려서(네발로 낮게) 달리는" 고슴도치. runStyle biped(정면 치비) → **gallop(측면 네발)**, 파츠모델 측면 프로필 전면 재설계. 스킬/params/lines/palette 키는 유지(역할 그대로).

## 수정 파일
1. `src/data/characters/hedgehog.ts`
   - `runStyle: 'biped'` → `'gallop'`. 주석 "측면 네발 갤럽, 등을 따라 가시"로 갱신.
   - palette 주석만 측면 기준으로(base=등 가시, point=얼굴/배/다리). 색값·스킬·params·lines 변경 없음.
2. `src/data/partmodels/hedgehog.ts` — 측면 프로필 네발로 전면 재작성(정면 버전 폐기).

## 갤럽 적합성 / 파트 이름 규약 (dog.ts·cat.ts + PartsCharacter gallop 분기 대조 확정)
렌더러 gallop은 **측면 프로필**(`inner.scale.x = dir`로 +x 바라보게 그리고 진행방향에 맞춰 미러). 다리 파트 이름 규약 = dog/cat과 동일:
- **front pair**: `frontLegL`(근측, z3) / `frontLegR`(원측, z1·darker). gallop 분기 `isFrontLeg` → 앞으로 reach/tuck (rot ±42°).
- **rear pair**: `legL`(근측, z3) / `legR`(원측, z1·darker). gallop 분기 → push back (rot -42°).
- 원측 페어(`legR`/`frontLegR`)는 `far` 위상 오프셋 + FARLEG(`#D9C29E`, cream보다 한 톤 어둡게) 색으로 깊이감. 근측은 point(cream).
- `body`: gallop 분기에서 extension 시 가로 stretch. `head`: dy bob. → 둘 다 포함, pivot dog/cat 감각.
- `tail`: 스트림 sway(±22°) 적용됨 → 작은 꼬리 nub이 살짝 흔들림(OK). `earL`은 **의도적으로 생략**(고슴도치 정체성은 귀가 아니라 가시; ear 스트림 sway 불필요).
- `spikes`: **어느 runStyle 절차 분기에도 매칭 안 됨** → run 중 정적 유지(가시는 펄럭이면 안 됨, 의도된 것), 포즈 델타(scale)만 적용.

## 측면 실루엣 / 가시 배치
- 방향: 머리=오른쪽(+x), 꼬리=왼쪽(-x). dog/cat과 동일 좌표계.
- `head`(z4): 작은 cream 둥근 머리 + 앞으로 뾰족한 주둥이(snout path) + 까만 코끝(nose circle) + 큰 눈 1개(측면) + 볼터치. 베이비 비율.
- `body`(z2): 낮고 둥근 cream 몸 + 배.
- `spikes`(z1, 몸 뒤): **등 위~정수리를 따라 줄지은 갈색 가시** — 측면 고슴도치 정체성. 둥근 가시 mantle(ellipse) + 위로 솟은 삼각 quill 5개(뒤→앞/정수리). pivot {-2,18}(등 중앙)에서 scale로 곤두섬.
- 다리 4개(원/근 페어) 짧고 통통.

## 포즈 (rot=도, scale=배수)
- `idle`/`run`: `{}` — gallop 절차 애니.
- `skill`(가시 곤두+웅크림): `spikes{scaleX:1.2,scaleY:1.28,dy:-3}`, `body{scaleY:0.92,dy:3}`, `head{dy:4,rot:8}`, `tail{rot:-12}` — 등 가시 확 서고 몸 낮춤. PartsCharacter skilling poseAmp 1.8× + gallop forward pitch 적용.
- `win`: `spikes{scale ~1.1}`, `head{dy:-5}`, `tail{rot:-20}`.
- `fall`: `head{rot:16}`, `tail{rot:18}`.

## renderer-dev 인계
- 파트 이름: tail, spikes, legR, frontLegR, body, legL, frontLegL, head. (front/rear·near/far 규약 dog/cat과 동일.)
- spikes 정적 + 포즈 scale 곤두 의도. 팔레트 키: base(가시)/point(얼굴·배·다리)/outline/cheek/nose. FARLEG는 partmodel 로컬 const.
- **시각 검증 필수**(gallop 측면 + 가시 측면 실루엣): Playwright로 출발/스킬(가시 곤두)/마지막바퀴/결과 캡처. inner.scale.x=dir 미러로 트랙 상/하단·곡선에서 방향 맞게 도는지 확인.
- 스킬 FX(가시 밀치기)는 engine bristle 핸들러 emit 그대로(메커닉/params 변경 없음).

## QA / 기타
- 스킬 type/params/등록/로스터 7종 변경 없음 → schema/skills 테스트 추가 갱신 불필요(이전 h01에서 완료분 유지).
- typecheck/시각은 renderer 단계서 일괄.
- 밸런스(recoilBurst/recoilMs)·승률은 이번 변경과 무관(runStyle은 엔진 미참조). 영향 없음.
