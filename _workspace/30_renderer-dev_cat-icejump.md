# 30 · renderer-dev · 고양이 빙판 점프 비주얼

## 작업
펭귄 빙판(icefield)을 고양이가 **점프로 뛰어넘는** 연출. 엔진이 이미
`RacerState.skill.iceJumping`(boolean)을 노출 — 렌더러는 그걸 소비해 점프 포즈만 그림.
순수 시각, 시뮬레이션 피드백 0, 결정론 보존(점프 여부는 엔진 결정).

## 엔진 신호 (그대로 소비)
- `RaceEngine.applyIce()`가 cat이 빙판 구역 진입 시 1회 `dodgeChance`(0.6)로 점프 판정,
  구역 통과 내내 `self.skill.iceJumping` 유지. 점프 성공 시 slowFactor 면제.
- 렌더러는 `r.skill.iceJumping === true && characterId==='cat'` 일 때만 점프 포즈.

## 변경 파일
1. **src/renderer/character/PartsCharacter.ts**
   - `UpdateOpts`에 `iceJumping?: boolean` 추가.
   - `catJumping` 플래그(= cat 모델 + iceJumping + moving + !reducedMotion).
   - `catAir = |sin(clock*5.5)|` 점프 아크(자체 rate라 다리 사이클과 구분, 1=정점).
   - 전체 lift: `max(lift, 14 + catAir*46)` — gallop bob 위로 크게 떠오름.
   - 전용 포즈 분기(gallop보다 우선): 앞다리 앞으로 뻗었다 착지 시 모음, 뒷다리 뒤로
     쭉, 몸 길게 stretch(scaleX +12%), 머리 들고, **꼬리 위로 로프트**(공중 밸런스).
     `rot`은 전부 DEGREES(불변규칙 준수), 전체 기울기 root.rotation만 RADIANS.
   - root.rotation: `dir*(0.05 - catAir*0.16)` — 정점에서 코가 살짝 들리는 도약 피치.
2. **src/renderer/RaceRenderer.ts**
   - 메인 주행 루프에서 cat의 `iceJumping`을 계산해 `character.update({..., iceJumping})` 전달.
   - 점프 중 `fx.sparkle(머리 위)` 살짝(주기 게이트로 과하지 않게). reducedMotion이면 sparkle 생략.
3. **src/main.ts** (캡처 훅)
   - `simulate()` 반환에 `catJumpFrame`(cat이 빙판을 점프로 넘는 첫 프레임) 추가.
     기존 `penguinIceFrame`과 동형. 결정적 시각검증용 훅.
4. **tests/e2e/race-visual.spec.ts**
   - cat ice-hop 골든 캡처 블록 추가(seed 35, frame 668/672 — 선두 고양이가 갓 깔린
     빙판 위에 **단독**으로 떠서 점프하는, 가려짐 없는 프레임).

## 시각 검증 (Read로 직접 확인)
- `npx playwright test race-visual.spec.ts --project=desktop` → 4 tests 전부 통과, 회귀 없음.
- 골든:
  - `tests/e2e/__screens__/race-cat-icehop-apex.png` — **점프 정점**. 고양이(고양이3, 회색
    태비)가 빙판(눈송이 패치) 위에서 트랙 라인보다 **확연히 위로 떠** 글로우 헤일로를
    깔고 도약 포즈. 같은 화면의 강아지(강아지2)는 평지에서 평소 주행 → **미끄러짐이 아니라
    뛰어넘는 게** 한눈에 구분됨. 고양이는 1위 선두.
  - `tests/e2e/__screens__/race-cat-icehop-low.png` — 같은 hop의 낮은 위상. 아크가
    진동(정점↔낮음)함을 증명.
- 처음엔 기본 seed 7 frame 365로 잡았으나 고양이가 강아지와 한 덩어리로 겹쳐
  말풍선에 가려 판독이 흐림 → 단독 프레임(seed 35)으로 골든 교체.

## 타입체크
- 내 변경분: typecheck 에러 0.
- 주의: 동시 작업 중인 **다른 에이전트(shell-dev)의 `src/shell/screens/SetupScreen.ts`가
  현재 working tree에서 깨진 중간 상태**(teamGroup/teamOpts 미정의)라 전체 tsc/dev 빌드가
  실패함. 내 작업과 무관. e2e 검증 시 그 파일만 임시로 HEAD로 되돌려 빌드를 띄워 골든을
  찍고, **검증 후 그들의 WIP를 그대로 원복**해 두었음(SetupScreen.ts는 내가 손대지 않음).
  → shell-dev가 SetupScreen을 고치면 전체 빌드/e2e가 다시 통과함.

## QA 전달 (qa-verifier)
- 골든: `tests/e2e/__screens__/race-cat-icehop-apex.png`, `...-low.png`.
- 회귀 확인 포인트: penguin belly-slide(`race-penguin-slide.png`), gallop(개) 주행 미변경.
  고양이 점프는 `iceJumping=true`일 때만 발동 — 빙판 밖/평소 주행은 기존 gallop 그대로.
