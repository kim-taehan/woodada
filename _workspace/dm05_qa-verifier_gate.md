# 데스매치 모드 — 최종 품질 게이트 (qa-verifier)

검증일: 2026-06-22 / 검증자: qa-verifier (독립 재실행, 자가보고 미신뢰)

## 게이트 결과 요약
| 게이트 | 결과 | 수치 |
|---|---|---|
| 1. typecheck | **PASS** | tsc --noEmit 에러 0 |
| 2. vitest 전체 | **PASS** | 9 파일 / 62 테스트 전부 통과 (deathmatch 5 포함) |
| 3. playwright (desktop) | **PASS** | 6/6 통과, 데스매치 캡처 포함 |
| 4. 스크린샷 육안 | **PASS** | 4종 + 회귀 2종 육안 확인 |

## 게이트 1 — typecheck: PASS
`npm run typecheck` 에러 0.

## 게이트 2 — vitest: PASS (62/62)
신규 `engine-deathmatch.test.ts` 5 테스트 통과. 회귀 없음:
- engine-determinism 4, engine-bias 7, relay 10, skills 16, schema 3, overtake 4, scoring 7, prng 6.
- 결정론·일반전/팀전/릴레이 전부 그린.

## 게이트 3 — playwright desktop: PASS (6/6)
death-match 스펙(race-visual.spec.ts:178) 통과. 기존 골든(capture key race states, coast scatter, lap counter, FX proof, reduced-motion) 회귀 없음.

## 게이트 4 — 스크린샷 육안 확인
### race-deathmatch-first-knockout
- HUD: "2/5 바퀴", "💀 남은 7명" 정상 표시.
- 탈락 직후 1명(고슴도치6, 직전 선두). 자막 "선두 고슴도치6, 박수받으며 퇴장입니다 짝짝" + 머리위 "잘한 게 죄야..." 바블 + ✨ sparkle/하트 → 환호 감정 일치.
- 살아있는 레이서(곰5·강아지2·외계인8·고양이3 등) 계속 트랙 주행. 우측 순위판·LIVE TOP3 정상.

### race-deathmatch-first-pile (PASS)
- HUD "5/5 바퀴", "남은 2명". 탈락자 다수가 **트랙 중앙에 가로 1열**로 정렬(고슴도치·원숭이·곰·외계인·펭귄·거미) — placeEliminated() 의도대로.
- 환호 바블("뿌웅!", 하트/✨). 생존 2명(강아지2·고양이3)만 트랙 주행. first=환호 일치.

### race-deathmatch-last-knockout (PASS)
- HUD "2/5 바퀴", "남은 7명". 탈락 1명(고양이3, 직전 꼴찌). 자막 "마지막 주자 고양이3, 조용히 트랙을 떠납니다..." + "잘 가, 친구들..." 바블 + 💦 땀방울 → 좌절 감정 일치.
- 선두 고슴도치6 등 생존자 트랙 주행 중.

### race-deathmatch-last-pile (PASS)
- HUD "5/5 바퀴", "남은 2명". 탈락자 6명 **중앙 가로 1열**(고양이·곰·고슴도치·외계인·거미·강아지) 모두 💦 땀 → 좌절 감정 일치.
- 생존 2명(원숭이4·펭귄1)만 트랙. last=좌절 일치.

### 회귀 골든 (PASS)
- race-start / race-mid: 일반전 표준 트랙·레이서·순위판 정상. 데스매치 HUD("남은 N명"/💀) 누출 없음.

## 경계면 교차검증 (코드 확인)
1. **셸→엔진 매핑** (store.ts:163 resolvedElimination): 팀모드 또는 'none' → undefined, 'first'/'last' → 그대로 passthrough. 계약 일치.
2. **엔진 victim 선택** (RaceEngine.ts:680-692): first=최대 progress(선두) 탈락, last=최소 progress(꼴찌) 탈락, 동률은 procKey 결정론 tie-break. eliminationOrder 1-based 증가(1=먼저탈락).
3. **엔진→렌더러 소비** (RaceRenderer.ts:968-1002 placeEliminated): config.elimination==='first'→happy(환호/sparkle), 아니면 sad(땀). eliminationOrder=1이 leftmost. 순서·감정 분기 엔진 의미와 일치(육안 결과로도 교차 확인됨).
4. **일반전 무회귀**: config.elimination 미설정 시 applyEliminations 즉시 return(RaceEngine.ts:668), isRaceFinished 분기(:576)도 통과. overtake/active-count 필터는 'eliminated' phase 추가만 — 기존 'finished'/'waiting'과 동일 취급이라 일반전 경로 불변.

## 발견 문제
없음. 4개 게이트 전부 PASS, 경계면 정합 확인, 회귀 없음.
