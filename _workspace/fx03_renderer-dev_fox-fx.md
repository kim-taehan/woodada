# fx03 — 구미호 illusionClone 분신·텔레포트 렌더링/연출 (renderer-dev)

대상: `src/renderer/` 만. 변경 파일 2개:
- `src/renderer/RaceRenderer.ts` (+122)
- `src/renderer/fx/FxLayer.ts` (+56)

## 구현 요약

### 1. 분신(decoy) 렌더 — 반투명 고스트
- `decoyLayer`(charLayer 바로 아래, boxLayer 위)에 매 프레임 `EngineFrame.decoys`를 그림.
- 분신 id별로 **본체 fox와 동일한 `PartsCharacter`**(같은 partmodel/palette/runStyle)를 생성 → run 포즈/애니메이션이 본체와 100% 동일.
- 구별: `ghost.root.alpha = 0.4`(co-fox 인계 메모대로 container 일괄 반투명) + 프레임마다 `0.38±0.08*sin` 깜빡임으로 유령처럼 흔들림(reducedMotion이면 0.4 고정).
- 배치: `track.place(d.progress, lane)` + `travelDir`로 본체와 같은 방식. zIndex = tp.z-1(같은 깊이에서 본체 바로 뒤). 분신 위치를 posById에 등록해 생성 poof가 분신 스폿에 떨어지게 함.
- 분신 id가 사라지면(만료/팝) 해당 PartsCharacter destroy. buildScene/showResult/destroy에서 정리.
- `container.tint`는 PixiJS v8 Container에 없어 푸른 틴트는 적용 안 함(no-op/에러 위험). alpha+깜빡임만으로 충분히 구별됨(아래 육안 확인).

### 2. 연출 FX (FxLayer 신규 2종 + playEvent 4 case)
- `fx.smoke(x,y,tint)`: 보라-회색 마법 연기 + ⭐✨ 글린트 — 분신 생성/텔레포트 도착 poof.
- `fx.cloudPop(x,y,tint)`: 라벤더 링 + 연기 + "퐁!" 태그 — 분신 소멸/흡수.
- `illusionClone:clone`: 본체에 smoke + 각 새 분신 스폿마다 smoke(curDecoys 모듈변수로 전달). (머리 위 "허허…" 버블은 activate가 처리)
- `illusionClone:clonehit`: 피해레이서에 stars+dizzy+cloudPop. ("어?" 버블은 e.line)
- `illusionClone:clonepop`: 보호받은 본체에 cloudPop+sparkle. ("퐁!" 버블은 e.line)
- `illusionClone:teleport`: 도착 스폿(이미 engine이 progress 이동)에 smoke+cloudPop+sparkle+glow. ("스르르…퐁!" 버블은 e.line)

## 시각 검증 (Playwright 캡처 → Read 육안 확인 완료)

스크린샷 경로: `tests/e2e/__screens__/`
- **fox-iso-decoys.png** (seed 10, f810, fox+penguin+bear 격리): **결정적 증거** — 하단 직선에 fox 3마리. "구미호1" 태그 단 본체는 **불투명·진한 주황**, 양옆 분신 2마리는 **반투명**(몸 너머로 트랙 레인선이 비치고 주황이 옅음). 옆의 곰·펭귄은 불투명 풀컬러 → 분신만 see-through임이 분명(전역 디밍 아님).
- **fox-iso-teleport.png** (seed 17, f563): "스르르…퐁!" 버블 + 좌측 커브에 큰 "퐁!" 태그 + 마법 연기 poof → 순간이동 도착 확실히 읽힘.
- **fox-decoys-running.png** (seed 34, full roster): 본체+분신 2마리 측면 9꼬리 fox로 나란히 달림.
- **fox-clonehit.png** (seed 34, f449): "어?" 버블 + 별/dizzy + "퐁!" 충돌 연출.
- **fox-clonepop.png** (seed 4, f640): 곰 roar 충격파가 들어오자 분신이 대신 맞고 "퐁!" 라벤더 팝.
- **fox-clone-spawn.png / fox-teleport.png**: 생성/만료 poof.

회전단위·alpha·좌표 모두 정상(분신이 본체와 동일 포즈로 보이고, 반투명 구별됨).

## 주의 — 내 범위 밖 회귀 1건 (engine/data 소관)
`race-visual.spec.ts`의 `capture key race states`가 `CATWALK_SEED=4`에서 `catwalk:activate` 단언 실패.
원인: fox가 DEFAULT_IDS/로스터에 추가되며 seed 4 충돌 구도가 바뀌어 고양이가 더는 공격받지 않음(엔진 이벤트 생성 문제). **렌더러 변경과 무관**(src/renderer만 수정, 엔진 이벤트에 영향 0). CATWALK_SEED 재핀이 필요 — qa-verifier/co-fox 소관.

---

## 추가 작업 — fox 진행 방향 바라보기 (강아지처럼 좌우 플립)

사용자 피드백: 구미호가 측면 치비인데 진행 방향을 안 봄(오벌 아래=→, 위=←).

원인: `PartsCharacter.update`의 측면 미러는 `runStyle === 'gallop' || 'glide'`일 때만 `inner.scale.x = dir`. fox의 `runStyle: 'sly'`는 빠져 있어 항상 +x(오른쪽)만 봄. 게다가 `sly`는 leg-cycle 분기도 없어 biped 기본으로 떨어져 front legs가 숨겨짐(`scaleX=scaleY=0`).

수정 (`src/renderer/character/PartsCharacter.ts`, 렌더러 전용, +14/-6):
1. `style` 정규화: `runStyle === 'sly'` → 애니메이션상 `'gallop'`로 매핑(4다리 측면 갤럽 + 틸트 그대로 적용). reducedMotion이면 기존대로 'biped'.
2. 미러 조건에 `sly` 포함: `sideView = gallop || glide || sly` → `inner.scale.x = sideView ? dir : 1`. raw runStyle로 판정해 정지 프레임(reducedMotion)도 올바른 방향을 봄.

시각검증(Read 육안): `tests/e2e/__screens__/`
- fox-facing-bottom-right.png: 아래 직선에서 fox 머리=오른쪽, 9꼬리=왼쪽 뒤로 트레일(→ 방향 정주행). ✓
- fox-facing-top-left.png: 위 직선에서 fox 머리=왼쪽으로 플립, 9꼬리=오른쪽 뒤로(← 정주행). ✓
- dog-facing-top-left.png 대조: 강아지도 동일하게 왼쪽 봄 → fox가 dog와 완전히 같은 거동.
- 부수효과: fox가 이제 갤럽 4다리로 달림(front legs 숨김 버그도 해소).

주의(co-fox 조율): 이 플립은 `runStyle === 'sly'`(=src/data/characters/fox.ts, co-fox 파일)에 의존. 리셰이프 때 runStyle을 'sly'에서 바꾸면 플립이 깨짐 — 'sly' 유지 부탁(또는 바꿀 거면 알려주면 렌더러 조건 갱신).

---

## fox 리셰이프 v2 재캡처 (co-fox 리셰이프 후 — 여우다움 + 진행방향 둘 다 확인)

co-fox 리셰이프(쐐기형 머리·긴 주둥이·흰 마스크·슬림 몸통·큰 귀) 반영. src/data 변경은 co-fox, 나는 렌더만(이번엔 코드 변경 없음 — 캡처/검증만). typecheck clean.

캡처(Read 육안 확인), tests/e2e/__screens__/:
- **fox-reshape-v2.png** (seed 21 f863, fox 단독 클로즈업): 여우로 명확히 읽힘 — 길고 가는 주둥이+끝 작은 코, 쐐기형 타원 머리, 주둥이 아랫면 흰 마킹(여우 마스크), 뒤로 쫑긋한 큰 귀, 슬림 몸통+가는 다리, 9꼬리 부채. "돼지" 둥근 느낌 사라짐. (보너스: 아래 반투명 분신도 함께 보여 ghost alpha가 새 모델에서도 정상.)
- **fox-v2-bottom-right.png** (아래 직선 →): 새 모델 머리=오른쪽, 9꼬리 왼쪽 뒤 트레일.
- **fox-v2-top-left.png** (위 직선 ←): 새 모델 머리=왼쪽으로 플립.

결론: (a)여우다움 OK (b)진행방향 플립 OK — 새 partmodel에서도 둘 다 정상.

---

## fox-reshape-v2 통합 캡처 (리셰이프 + fennec 팔레트 최종)

co-fox가 partmodel 리셰이프 + characters/fox.ts 팔레트를 사막여우(fennec)로 교체 완료:
base #DEB887(샌드버프), point #F5DEB3(밀빛 크림), cheek #E8A87C(살구), tailTip #FFFAF0.

통합 캡처(Read 육안), tests/e2e/__screens__/ (주황 팔레트 구버전 덮어씀):
- fox-reshape-v2.png(클로즈업): (a)여우 형태 OK(쐐기 머리·긴 주둥이·큰 귀·흰 마스크·9꼬리), (c)사막여우 샌드색 OK(주황 아님), (b)머리 오른쪽(→).
- fox-v2-bottom-right.png(아래 직선 →): 머리 오른쪽.
- fox-v2-top-left.png(위 직선 ←): 머리 왼쪽으로 플립.

결론: (a)(b)(c) 3축 모두 통과. 렌더러 코드 변경 없음(캡처/검증만). typecheck clean.
(d 분신 간격은 별건 — eng-fox bodyLenUnits 15→~57 반영 대기 중.)
