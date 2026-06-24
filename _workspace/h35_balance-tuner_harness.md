# h35 — balance-tuner: 밸런스 하니스 정식화 (#4)

브랜치: polish/engine-improvements. 문제: 밸런스 측정을 매번 임시 스크립트로 수동 실행 → 정식 dev 도구로.

## 한 일

`scripts/balance.ts`를 **개인/팀(동질)/릴레이 × 바퀴수 {1, 3, 10}** 매트릭스를 한 번에 출력하도록 재작성(기존 4개 측정 함수를 laps·N 파라미터화로 일반화, 출력은 기존 스타일 유지·표로 정리). dev 도구(스크립트)일 뿐 unit test 아님 — 기존 vitest 무관.

각 셀 출력: 캐릭터별(또는 팀별) **win%** · **fair×**(공정선 대비 배수, 1.00=공정) · **평균등수**(낮을수록 좋음) · **last%**(꼴찌 비율). 개인전 행엔 독주지표(winner led frac, lead-changes/race)와 floor/DOMINATES 경고 플래그. 펭귄-스택 회귀 체크는 1바퀴 고정으로 보존(로스터 7종 반영해 C_mixed를 eagle/bear/hedgehog로 갱신).

결정론 유지(시드 0..N-1). N은 바퀴수별: 1바퀴 3000 / 3바퀴 1500 / 10바퀴 400(10바퀴는 ~10배 길어 작게). maxFrames = 60*40*laps로 10바퀴도 항상 완주.

### CLI 플래그 (옵션)
- `npx vite-node scripts/balance.ts` — 전체 매트릭스(3×3 + 회귀체크)
- `--dist` — 개인전 등수 히스토그램(1~7등) 추가
- `--laps 10` — 특정 바퀴수만
- `--n 500` — 표본 수 오버라이드(모든 바퀴 공통)

## 샘플 출력 (발췌)

```
──────── LAPS = 10 ────────
  INDIVIDUAL · laps=10 · N=400  (fair win=14%, fair avgRank=4)
              win%   fair×   avgRank  last%
    monkey    24%    1.66×   3.15     1%
    cat       12%    0.84×   3.86     13%
    eagle     19%    1.30×   4.10     21%
    bear      12%    0.82×   4.16     17%
    penguin   11%    0.73×   4.18     13%
    hedgehog  12%    0.81×   4.25     17%
    dog       12%    0.84×   4.30     19%
    runaway: winner led 0.351 of race, 27.6 lead-changes/race

  RELAY · homogeneous 3-member · legs=10 · N=400  (fair win=14%)
    monkey    30%    2.12×   2.88     1%    ← 릴레이 독주(알려진 미해결)
    ...
──────── REGRESSION CHECKS ────────
  TEAM rank-sum · penguin-stack vs mixed (3 teams ×3, laps=1, N=3000)
    A_pengStack 36%   B_mixed 30%   C_mixed 34%
```

매트릭스가 드러낸 현황(참고, 이번 작업은 도구화라 튜닝 안 함):
- 원숭이: 릴레이 전 바퀴서 1.4~2.1× 독주(기존 안티스택 후에도). 개인전은 바퀴 늘수록 강해짐(1.43×→1.66×).
- 독수리: 전 모드 last% 21~26%로 높음(자폭 양극화, 구조적).
- 팀 rank-sum: dog/eagle 저조(0.4~0.6×), penguin/hedgehog 강세 — h22에서 보고한 스프레드와 일치.

## 변경 파일

- `scripts/balance.ts` — 전면 재작성(모드 함수 laps/N 파라미터화 + 매트릭스 러너 + CLI 플래그 + fair×/avgRank/last% 표). 임시 하니스(_multilap.ts 등) 불필요해짐.

## 검증

- `npx vite-node scripts/balance.ts` → 매트릭스 정상 출력(위). `--dist`/`--laps`/`--n` 플래그도 정상 동작 확인.
- `npm run typecheck` → clean (tsconfig include는 src/tests지만 vite-node 실행은 정상; 타입 오류 없음).
- 어떤 테스트도 이 스크립트를 import하지 않음 → vitest 무관(engine-bias 등 green 유지).

## 비고

- 개인전 셀을 기존 "6종×2(슬롯 공정성)"에서 **"7종×1(캐릭터별 평균등수 직접)"**로 일반화함. 슬롯 공정성 신호는 빠졌지만 그건 `engine-bias` 유닛 게이트(#3에서 laps {1,3,10} 파라미터화됨)가 담당하므로 도구 중복 불필요. 필요하면 후속으로 슬롯 분해 옵션 추가 가능.
