# h01 content-designer — 🦔 고슴도치(hedgehog) 추가 (data 영역)

7번째 기본 로스터 캐릭터. 역할 '방해·근접(까칠 방어형 "붙지 마. 진짜.")' — 신규 역할, 로스터 비중복 OK.

## 결정 사항
- **runStyle: `'biped'`** — penguin/bear 선례. 고슴도치 종종걸음은 biped의 정돈된 small-step 다리 교차 + 팔 스윙이 적합. scamper(monkey)는 큰 팔 flail + 몸 squash라 가시 실루엣을 왜곡해서 부적합.
- **renderScale: 0.95** — 작고 옹골진 체형.
- **스킬 type: `'bristle'`** (engine-dev 잠정 계약 확정. 핸들러는 아직 미구현 — 팀리드가 엔진 작업 배정 필요. 키 이름은 이 스펙대로 고정, 수치만 balance-tuner가 추후 튜닝).
- **params(잠정 계약, 키/단위 engine-dev 확정):**
  `{ range: 40, triggerChance: 0.45, pushBack: 10, slowMs: 600, slowMul: 0.6 }`, `cooldownMs: [1500, 2500]`.
  - range/pushBack은 progress 절대 단위(trackLength=1000). 초기 추정 range:6/pushBack:2는 너무 작아 engine-dev 권고로 40/10으로 상향.
  - triggerChance 0~1(rng 서브스트림), slowMul 0~1 곱셈 계수(speed *= slowMul, slowUntil/slowMul 필드 재사용 예정).
  - **recoilBurst:0.4, recoilMs:500 추가** (team-lead 옵션 B — 가시 반동 자기 전진). 발동 성공 시 본인 짧은 부스트. 잠정값, balance-tuner 최종 튜닝.
  - 최종 params: { range:40, triggerChance:0.45, pushBack:10, slowMs:600, slowMul:0.6, recoilBurst:0.4, recoilMs:500 }

## 메커닉 (해결됨)
엔진 SkillContext에 "누가 나를 추월 중인지" 이벤트 입력이 없어(self/all/byId/rng/frame/params/emit/lines/tryDodge/addIceZone뿐) **진짜 이벤트 기반 반응형은 불가**. 채택 메커닉 = "짧은 쿨다운 주기적 자기발동, 바로 뒤(range 내·근접 레인·closing) 추격자 있으면 triggerChance로 밀치기(pushBack)+감속(slowMul/slowMs)". 연출상 '반응형 카운터'로 읽힘. cooldown[1500,2500]이 뒷받침.

**밸런스 해결 (team-lead 결정 = 옵션 B):** '순수 방어'는 본인 전진수단이 없어 승률 0.041 < engine-bias floor 0.1. team-lead 결정으로 **가시 반동 자기 전진** 추가 — 발동 성공 시 본인에게 짧은 부스트(`recoilBurst` for `recoilMs`). '까칠 방어' 정체성 유지하며 floor 현실화. engine-dev 핸들러 보강, 수치는 balance-tuner 최종 튜닝.

## 수정/생성 파일
1. `src/data/characters/hedgehog.ts` — 생성. CharacterData(palette 갈색 가시/베이지 얼굴, lines 까칠 톤).
2. `src/data/partmodels/hedgehog.ts` — 생성. 정면 치비(아래 파츠 구조).
3. `src/data/characters/index.ts` — import + catalog + **defaultCharacterIds에 'hedgehog' (총 7종)**.
4. `src/data/partmodels/index.ts` — import + partModels 등록.
5. `src/shell/screens/SetupScreen.ts` — CHAR_LABEL에 `hedgehog: '🦔'`.
6. `src/main.ts` — DEFAULT_IDS에 'hedgehog' (스크린샷 로스터 7종).

## partmodel 파트/포즈 (renderer-dev 인계)
**파트 (z 순):**
- `spikes` (z0) — **지배적 실루엣**. 갈색 가시 돔(ellipse rx46) + 둘레에 삼각 quill 8개. pivot {0,18}(crown). 어떤 절차 분기에도 안 들어가므로 run 중 정적(가시는 펄럭이면 안 됨 — 의도된 것). skill 포즈에서 scale로 곤두섬.
- `legL`/`legR` (z1) — 베이지 작은 발(ellipse). biped 다리 교차 ±36°.
- `body` (z2) — 가시 돔 아래로 살짝 보이는 베이지 배.
- `armL`/`armR` (z3) — 베이지 짧은 팔. biped 팔 스윙 ±30°.
- `head` (z5) — 베이지 둥근 얼굴(가시 돔 앞에 겹침), 큰 눈, 분홍 주둥이+코. pivot {0,34}.

**포즈 델타 (rot=도, scale=배수):**
- `idle`/`run`: `{}` — biped 절차 애니에 맡김.
- `skill` (가시 곤두 + 웅크림): `spikes{scaleX:1.22,scaleY:1.22,dy:-2}`, `body{scaleY:0.9,dy:3}`, `head{dy:3}`, `armL{rot:30}`, `armR{rot:-30}` — 가시가 확 서고 몸을 웅크려 방어 자세. PartsCharacter의 skilling poseAmp 1.8× + forward thrust가 적용되니 '가시 곤두 카운터'로 읽힘.
- `win`: `spikes{scaleX:1.12,scaleY:1.12}`, `head{dy:-5}`, `armL{-26}/armR{26}` — 가시 자랑스레 부풀.
- `fall`: `head{rot:16}`, `armL{22}/armR{-22}`.

**renderer-dev 참고:** spikes는 어느 runStyle 절차 분기에도 매칭 안 되므로 정적 유지 + 포즈 델타(scale)만 적용됨 — 의도대로 동작. 팔레트 키: base(가시)/point(얼굴·배·팔다리)/outline/cheek/nose. 시각 검증(Playwright)으로 출발/스킬(가시 곤두)/결과 포즈 확인 요망. bristle 스킬 FX(밀치기 + 가시 ✨)는 핸들러 emit('bristle','hit'...) 확정 후 연출 가능.

## QA 인계 (qa-verifier)
- **테스트 갱신 필요:**
  - `schema.test.ts`: KNOWN_SKILL_TYPES에 `'bristle'` 추가, catalog 캐릭터 목록에 hedgehog 추가(7종).
  - `skills.test.ts`: 활성 스킬 집합에 bristle 추가.
  - 단, **bristle 핸들러가 엔진에 등록되기 전까지는 skills 테스트(핸들러 존재/등록 검증)가 실패**할 수 있음 → engine-dev의 핸들러 작업과 동기화 필요. 핸들러 미구현 상태로 typecheck/test 돌리면 type 'bristle'은 SkillType이 (string&{}) 허용이라 typecheck는 통과하지만, 런타임 스킬 레지스트리에 'bristle' 미등록이면 발동 시 무동작 → e2e에서 스킬 FX 안 뜸.
- index/SetupScreen/DEFAULT_IDS 등록 완료.
- typecheck는 engine 핸들러 작업과 일괄.

## 미해결/후속
- bristle 엔진 핸들러 미배정 (engine-dev가 main에 통지함). 핸들러 구현 시 params 키 그대로, 수치 balance-tuner 튜닝.
- 메커닉(연출형 vs 진짜 이벤트형) 팀리드 확인 대기.
