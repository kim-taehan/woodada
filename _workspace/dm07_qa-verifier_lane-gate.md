# dm07 QA — 레인/충돌 변경 최종 게이트

검증 대상: HOME_LANE.exp 1.6→1.0, jitter 0.05→0.07, OVERTAKE.wanderAmp 0.10→0.14,
신규 측면분리(sepRange 3.0 / sepLaneBand 0.14 / sepPush 0.5), skills.test icefield A/B 갱신,
골든 21장 + CATWALK_SEED 8→4 보정. 데스매치 위에 누적(둘 다 커밋 전).

## 4개 게이트 — 전부 PASS

1. **typecheck** — PASS, 에러 0 (tsc --noEmit).
2. **vitest** — PASS, 9파일 62/62. engine-determinism 4/4, engine-bias 7/7(독주 없음 0.45, 14.8~22.4s), engine-deathmatch 5/5(회귀 없음), skills 16/16, relay 10/10, schema/scoring/prng/overtake 통과. 총 107s.
3. **playwright race-visual --project=desktop** — PASS, 6/6 (데스매치 캡처 포함).
4. **스크린샷 육안** — PASS (아래).

## 경계면 교차검증 — 전부 통과

- **레인≠속도**: `laneSpeedFactor`는 항등 `return 1` (`overtake.ts:39`). 측면분리 블록(`overtake.ts:124-136`)은 `target`만 변경 후 단일 `moveToward`로 `self.lane`만 갱신(L138). `self.speed` 미접촉 — 유일한 speed 쓰기는 기존 boxed-in decel(L95, 변경 없음). 불변규칙 유지.
- **결정론(lane 포함)**: 같은 config+seed 2회 시뮬레이트(8캐릭터·3랩) → lane/speed/progress diff = **0**. determinism 단위테스트도 lane을 4자리까지 해시 비교하며 통과.
- **레인 퍼짐 정량**: mid 프레임 3곳에서 lane range 0.80~0.87(밴드 [0.05,0.95] 거의 전폭), distinct lane-bucket 6~7/8. 한 줄 아님.
- **데스매치 회귀**: engine-deathmatch 5/5 + 골든(first/last pile·knockout) 정상.

## 스크린샷 육안 코멘트

- **race-mid**: 8명이 여러 레인 분산(곰 외측~펭귄/원숭이 내측). 스파이더 스킬 글로우+✨, 말풍선/HUD 1~8/LIVE TOP3/자막/아이템박스 전부 정상. 깨짐 없음.
- **race-lastlap**: 좌커브 팩이 레인별 분산, "마지막 바퀴!" 종배너+2/2랩+자막, 고양이 스킬 FX 링 정상.
- **race-curve-left**: 좌커브에서 레인 부채꼴 분산, 스파이더 글로우, 커브 스프라이트 방향 정상.
- **race-roar-hit**: 곰 roar 충격파 링+버스트 FX, 피격 팩 별효과. FX 아래 스프라이트/라벨 온전.
- **race-icefield-activate**: 8명 좌커브 레인 분산, 전 스프라이트/라벨/HUD 정상.
- **race-deathmatch-last-knockout**: "2/5바퀴 💀남은7명", 꼴찌 외계인 탈락 연출+ghost emote+자막. 잔여 팩 레인 분산. 탈락 기능 정상.
- **race-deathmatch-first-pile**: "5/5바퀴 💀남은2명", 선두 pile knockout FX, 외계인 zoomies copy("폭주 copy!"). 라벨/스프라이트/HUD 가독. first 변형 정상.

## 펭귄 얼음
이번 대상 아님. 검증/수정 안 함(지시대로).

## 결론
**4개 게이트 전부 PASS. 경계면 교차검증 전부 통과. 레인 퍼짐 확인, 일반전·데스매치 모두 회귀 없음.** 완료.
