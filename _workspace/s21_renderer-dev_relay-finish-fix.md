# s21 renderer-dev — 팀전 릴레이 결승 멈춤 버그 수정

## 증상
팀전 릴레이에서 완주한 앵커(마지막 주자)가 결승선(피니시 테이프)에 그대로 박제되어 멈춤.

## 원인 (렌더러)
`src/renderer/RaceRenderer.ts` renderFrame 메인 루프의 post-finish 분기:
```
if (r.phase === 'finished' && r.finishedAt !== undefined && !config.relay) {
  placeFinished(...); continue;   // 코스트→인필드 산개→환호
}
const tp = track.place(r.progress, ...);  // ← 여기로 떨어진 릴레이 앵커가 결승선에 정지
```
`&& !config.relay` 가드가 **완주한 릴레이 앵커**까지 placeFinished에서 제외 → 결승선 좌표에 정지. 본래 의도("대기 복귀 주자 제외")는 윗줄(~1195)의 `config.relay && r.phase === 'waiting'` 분기에서 이미 처리되고 있었음. 즉 이 가드는 과잉이었다.

## 수정 (src/renderer/만, 1줄 가드 변경)
- post-finish 분기에서 `&& !config.relay` 제거 → 완주한 racer는 릴레이/비릴레이 구분 없이 모두 placeFinished(코스트→산개→환호)를 탄다. 대기(waiting) 주자는 윗줄에서 이미 분기되므로 여기로 새지 않음. 주석으로 "waiting만 위에서 제외, finished는 모두 코스트" 명시.
- placeFinished 자체는 무변경: `track.place(progress%trackLength, ...)`로 크로싱 지점을 잡으므로 릴레이 누적 progress(≈track×1.21)도 결승 코너에 정확히 매핑됨. 랭크 기반 산개(rankFrac)도 그대로 동작. 비릴레이 완주 연출 불변.
- 라이브 앱에서 coast()가 frame+extra를 무제한 advance하므로(RaceController) 앵커들은 시간이 지나며 충분히 코스트·산개됨(캡처의 settle은 1초 스냅이라 코스트 진행 중 상태).

## 검증
- `npm run typecheck` 그린.
- 릴레이(2팀×2명, laps 2) 결승 캡처(showRaceAt 마지막 프레임 + settleFrames). before/after 대조:
  - **BEFORE**(가드 임시 복원): 앵커들(곰5·고슴도치6·거미7·외계인8…)이 피니시 테이프 위에 수직으로 겹쳐 정지 = 버그 재현.
  - **AFTER**(수정): 앵커들이 테이프에서 코스트해 빠져나가 인필드로 산개·환호(원숭이4 우측으로 글라이드, 나머지 랭크순 산개). 정지 없음.
- 비릴레이 완주 회귀 없음: 기존 #33 코스트/산개 동일.
- 임시 훅/스펙·BEFORE 스크린샷 삭제, 트리 깨끗.
- 캡처(현재 남김): `tests/e2e/__screens__/relay-finish-coast.png`, `relay-finish-midcoast.png`, `relay-finish-individual.png`.

## 배포 게이트 추가 검증 (리드 요청 2건)
### 1) 릴레이 결승 시각검증 (필수, 마지막 관문)
- 릴레이(2팀×2명 laps2, 2팀×2명 laps3) 결승까지 캡처 → 앵커가 피니시 테이프에서 코스트해 인필드로 산개/환호, 박제 없음 확인.
- BEFORE(가드 임시 복원): 앵커들 테이프 위 수직 정지 = 버그 재현. AFTER(수정): 산개. 비릴레이 완주 회귀 없음.
- 캡처: `relay-finish-coast/midcoast/individual.png`(laps2), 게이트 캡처 laps3도 곰5·거미7·외계인8 코너 산개 확인.

### 2) race-visual catwalk e2e 단언 갱신 (tests/e2e만, 엔진/데이터 무수정)
- 원인: 캣워크가 반응형이 되어 **개인전 시드7에는 catwalk:activate 미발동**(공격이 와야 회피하며 발동). 시드1~40 프로빙 결과 다수 시드에서 catwalk activate+dodge 동시 발동.
- 수정: `race-visual.spec.ts`에 `CATWALK_SEED=8` 추가. 시드7 골든(start/mid/finish 등)은 그대로 두고(드리프트 방지), catwalk만 시드8에서 별도 시뮬→`catwalk:activate`+`catwalk:dodge` 단언 + `race-catwalk-activate.png` 캡처. 시드7 캡처 루프/곰서명단언(zoomies·banana)은 유지.
- 결과: **race-visual 5/5 그린**. catwalk 캡처는 시드8 282프레임(고양이가 커브 클러스터에서 반응) 렌더 확인.

## 파일
- `src/renderer/RaceRenderer.ts` (가드 1줄 + 주석)
- `tests/e2e/race-visual.spec.ts` (catwalk 단언/캡처를 반응형 시드로 갱신)
