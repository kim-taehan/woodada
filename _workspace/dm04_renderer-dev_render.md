# dm04 — renderer-dev: 데스매치(탈락) 렌더러/연출

개인전 '데스매치' 모드의 렌더러/연출. 엔진·데이터 계약(동결)을 소비만 함.

## 소비한 동결 계약
- `frame.events`의 `{ type:'eliminate', variant:'out', racerId }` — 탈락 프레임에 발생.
- `RacerState.phase==='eliminated'`, `eliminationOrder?`(1-based), `eliminatedAt?`.
- `config.elimination`: `'first'`(선두탈락) | `'last'`(꼴찌탈락) | undefined(일반전).
- shell-dev가 `src/main.ts`의 simulate/showRaceAt에 `opts.elimination` 캡처훅, `RaceController`에 탈락 슬로우모션을 이미 추가해 둠.

## 변경 파일
### src/renderer/RaceRenderer.ts
1. **중앙 가로 누적** — `placeEliminated()` 신규(placeFinished를 본떠 가로 정렬로 변형).
   - `track.geo.cx/cy` 기준, eliminationOrder 순(1=좌측)으로 가로 1열, rowSpan은 탈락 인원에 비례(커브 회피). order 홀짝으로 2행 살짝 스태거.
   - 탈락 지점(`track.place(progress,...)`)에서 중앙 슬롯으로 `easeOutCubic` 슬라이드인(secs=(frame-eliminatedAt)/60, COAST_SECS 재사용).
   - 메인 그리기 루프(`for r of frame.racers`)에 `r.phase==='eliminated'` 분기 추가(finished 분기 직후). 살아있는 레이서는 기존대로 트랙 주행.
   - `elimTotal`(이번 프레임 eliminated 수)을 루프 전에 1회 계산해 행 폭 + HUD에 사용.
2. **감정 분기** — settled(k>0.85) 후 `PartsCharacter.update({phase})`에 first→'celebrate', last→'dejected'. 중앙에서 감정 유지(first: sparkle/heart 샤워, last: 가끔 sweat).
3. **eliminate:out 이벤트 연출** — `playEvent()` switch에 케이스 추가. 머리 위 말풍선 spawn + first=sparkle+heart, last=sweat+dizzy+dustSlump.
4. **남은 N명 HUD** — `survivorText`("💀 남은 N명") 랩 카운터 아래. buildScene에서 elimination이면 생성, 프레임마다 `fieldCount - elimTotal`로 갱신, 결과/리사이즈 경로에 처리 추가.
5. 자막 분기 — 이벤트 자막 루프에 `elimOut`이면 `eliminationLine(...)`, `commentary.say(line, clock, force=true)`(once-per-lap 헤드라인이라 이전 스킬 자막에 안 묻히게 강제).

### src/renderer/fx/commentaryLines.ts
- `eliminationLine(mode, name, seed)` — dm02 실황 풀(first 7 / last 7) {n} 토큰화.
- `eliminationBubble(mode, seed)` — dm02 머리 위 말풍선 풀(각 4).

### tests/e2e/race-visual.spec.ts
- `death-match: centre knock-out pile + first/last emotion` 테스트 추가. laps=5, seed=7. 모드별로 첫 `eliminate:out`(+6 프레임) 캡처 + 종료 직전(totalFrames-2) 중앙 누적 캡처.

## 시각 검증 (Read로 육안 확인 완료)
- `tests/e2e/__screens__/race-deathmatch-first-knockout.png`: 선두 고슴도치 탈락, "잘한 게 죄야…" 버블 + heart/sparkle 환호, 하단 "선두 고슴도치6, 박수받으며 퇴장입니다 짝짝짝", "남은 7명", 랩 2/5.
- `race-deathmatch-first-pile.png`: 탈락 6명 중앙 가로 1열 환호, 생존 2명 주행, "남은 2명".
- `race-deathmatch-last-knockout.png`: 꼴찌 고양이 탈락, "잘 가, 친구들…" + 💧 좌절, 하단 "마지막 주자 고양이3, 조용히 트랙을 떠납니다…", "남은 7명".
- `race-deathmatch-last-pile.png`: 탈락자 중앙 가로 1열, 여럿 💧 좌절, 생존 2명(원숭이/펭귄) 주행, "남은 2명", 결승 스코어보드 1등=생존자 원숭이.

중앙 가로 정렬·eliminationOrder 순서·환호/좌절 감정·말풍선/하단자막 톤·남은인원 HUD 모두 정상 확인.

## 캡처 타이밍 메모 (회귀 아님)
`RaceController.seek(target)`는 `engine.frameIndex < target`까지만 step → 마지막 렌더는 frameIndex-1 (엔진 step이 snapshot 후 frame++ 하므로). 정확한 탈락 프레임을 잡으려면 `eventFrame+N`(여기선 +6)로 시킹해야 함. 기존 캡처들은 이미 오프셋 사용 중이라 무관.

## 게이트
- `npm run typecheck` → 통과(에러 0).
- `npx playwright test race-visual.spec.ts --project=desktop` → 6 passed(기존 5 + 데스매치 1). 기존 골든(race-mid 등) 회귀 없음.

---

## 추가 패스: 선두탈락(first) 순위 배지 (team-lead 요청)

### 변경 (src/renderer/RaceRenderer.ts)
- `RacerView`에 `rankBadge: Text | null` 필드 추가. 뷰 생성 리터럴에 `rankBadge: null`.
- `placeEliminated()` 말미: **first 모드 + settled**일 때만 머리 위(이름표 −66보다 위, −96*depthScale)에 `${order}등` 라벨(금색, 1=가장 먼저 탈락=1등). 배지는 lazily 생성해 charLayer에 추가(비탈락전 레이스는 생성 안 함), 매 프레임 위치/스케일/zIndex(110000+y, 이름표 위) 갱신. settled 전(슬라이드인)·last 모드에선 `visible=false`로 숨김.
- 정렬: 기존 `frac=(order-1)/(slots-1)`로 order 1=leftmost가 이미 보장됨 → 왼쪽부터 1등→N등. 전원 'celebrate' 환호 유지(기존 로직 그대로).
- 라이프사이클: `charLayer.removeChildren()` + `views.clear()`로 다음 buildScene 시 자동 정리(태그/글로우와 동일 관용구, 별도 destroy 불필요).

### 시각 검증 (Read 육안 확인)
- `race-deathmatch-first-pile.png`: 중앙 가로 1열 위에 "1등"(좌, 고슴도치)→"2등"→"3등"→…→"6등"(우, 거미) 배지가 왼쪽부터 순위대로 표시. 전원 환호(celebrate + sparkle/heart). 생존 2명은 트랙 주행, "남은 2명".
- `race-deathmatch-first-knockout.png`: 탈락 직후 슬라이드인 중이라 settled 전 → 배지 미표시(의도대로). "잘한 게 죄야…" 버블 + 환호 FX + 하단 자막 정상.
- `race-deathmatch-last-pile.png`: 꼴찌탈락은 배지 없음 확인(이름표만, 💧 좌절 유지). 스코프대로 last 무변경.

### 게이트(재확인)
- `npm run typecheck` → 통과.
- `npx playwright test race-visual.spec.ts --project=desktop` → 6 passed. 기존 골든 회귀 없음.

---

## 추가 패스: 엔진 레인 거동 변경 시각검증 (team-lead 요청)

엔진 변경(HOME_LANE.exp 1.6→1.0, jitter↑, wanderAmp 0.10→0.14, overtake.ts 측면분리 추가)은 engine-dev가 끝냄. 렌더 코드 변경 없음 — 시각검증 + 골든 정리만 수행. tuning.ts/overtake.ts에서 exp:1.0·jitter:0.07·wanderAmp:0.14·lateral separation(lower id 안쪽/higher id 바깥 푸시) 적용 확인.

### 시각 검증 (Read 육안 확인, 풀 로스터 8명 일반 개인전)
- `race-mid.png`(seed7): 상단 직선에서 곰(아웃)·펭귄/원숭이/강아지(중간 어깨싸움 클러스터)·고슴도치/고양이(인)·거미/외계인이 여러 레인(인~아웃)에 세로로 퍼져 달림. 한 줄 아님.
- `race-lastlap.png`(seed7, 2랩): 좌커브/하단 직선에 racers가 반경별 분산. "마지막 바퀴!" 배너·종·자막 정상.
- `race-curve-left.png`: 고양이 진행방향(왼쪽) 측면 페이싱 정상 + 레인 분산 + 펭귄/원숭이/곰 어깨싸움. 포개짐이 측면으로 갈라짐.
- `race-roar-hit.png`(6명): 포효 충격파·dizzy·버블·캐릭터 전부 정상(깨짐 없음), 레인만 재배치.
- `race-start.png`: 프레임0이라 출발선에 모임(wander 전개 전, 정상).

→ 결론: 여러 레인(~0.2~0.8)에 퍼져 어깨싸움하며 달림 + 포개짐이 측면 분리됨 확인. 연출/캐릭터 깨짐 없음.

### 골든 갱신 & e2e 픽스
- 골든 21장 갱신(M): race-{start,mid,finish,busiest,lastlap,curve-top,curve-left,finish-scatter,reduced-motion,zoomies-activate,banana-activate/hit/dodge,roar-activate/hit,icefield-activate/laid,penguin-slide,cat-icehop-apex/low,catwalk-activate}. 모두 레인 분포 변화로 인한 의도된 위치 재배치(캐릭터/FX/HUD 정상). 진짜 회귀 없음.
- untracked PNG(abduct-reel-*, dodge-*, lane-intro-* 등)는 이전 세션 산출물(mtime 08:24/11:16)로 이번 run(16:18)과 무관 — 손대지 않음.
- e2e 픽스 1건(tests/e2e/race-visual.spec.ts): `CATWALK_SEED` 8→4. 레인 변경으로 seed8에선 고양이가 더 이상 공격받지 않아 catwalk activate/dodge 미발생 → 테스트 실패. DEFAULT_IDS 순서로 스캔해 catwalk가 나는 최소 시드 4로 리핀(seed7 골든과 분리 유지). 렌더 회귀 아님, 결정론 시프트 픽스처 보정.

### 게이트
- `npm run typecheck` → 통과(에러 0).
- `npx playwright test race-visual.spec.ts --project=desktop` → 6 passed.
