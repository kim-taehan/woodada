# 03 QA — 곰 roar 광역기 확대 변경 최종 품질 게이트

검증일: 2026-06-18 / 대상: bear.ts roar params 확대 + balance.ts 로스터 수정 + FxLayer shockwave 확대

## 품질 게이트 (전부 통과)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 1. typecheck | `npm run typecheck` | PASS — 타입 오류 0 |
| 2. 단위테스트 | `npm run test` | PASS — 26/26, 7 파일 (overtake·prng·scoring·schema·skills·determinism·bias) |
| 3. e2e 시각 | `npx playwright test --project=desktop` | PASS — 8/8 (shell·race-visual·play) |
| 4. 스크린샷 육안 | Read 4종 | PASS — 회귀 없음 |

engine-bias(공정성), engine-determinism, skills, schema, scoring 모두 포함되어 통과.

## 경계면 교차검증

### 데이터↔엔진 — PASS
- `bear.ts` skill.type='roar', params `{range:18, staggerMs:340}` 확인.
- `roar.ts` 핸들러가 `Number(params.range)`, `Number(params.staggerMs)/DT_MS`를 런타임에 읽음 → 새 수치가 실제 반영됨(핸들러 코드 변경 없이도 데이터만으로 적용). braced/finished/teammate 제외 로직 유지.
- 핸들러는 `skills/index.ts` 기본 레지스트리에 등록(테스트 통과로 간접 확인, skills.test.ts 활성 스킬 집합 일치).

### 밸런스 정합 — PASS (margin 주의)
`npx vite-node scripts/balance.ts` (N=3000, 10인 = 5종×2) 실측:
```
win rate: dog 0.295  rabbit 0.244  monkey 0.118  elephant 0.131  bear 0.212
slot wins: 0.163 0.116 0.054 0.068 0.101 0.132 0.128 0.064 0.063 0.112
avg lead changes/race: 8.3
```
- 곰 독주 없음: bear 0.212 « 0.45 상한. roar 확대로 곰이 과해지지 않음.
- 최약체 하한 위: 최약체는 **monkey 0.118** > ~0.10 하한. **PASS이나 버퍼 ≈0.018로 가장 얇음** — engine-dev가 플래그한 monkey 취약 지점 실측 확인. (이전 보고 0.1033 대비 이번 측정 0.118로 오히려 약간 위. 측정은 통과지만 추가 튜닝 시 monkey 우선.)
- 균형: dog 최강 0.295로 독주선 미달, lead changes 8.3로 드라마 유지.

### 엔진↔렌더러 — PASS
- `RaceRenderer.ts:206` `case 'roar:activate'` → `fx.shockwave(self.x, self.y, clock)` + `fx.dust` 연결 살아있음.
- roar.ts가 emit하는 변형은 `variant:'activate'`(→ `roar:activate`로 매핑) → shockwave 그려짐. 끊김 없음.

## 스크린샷 육안 코멘트

- **race-roar-activate.png**: 충격파 링(연한 금색 0xfff0c0, 반경 30→grow 11, width 11)이 곰 주위로 이전보다 넓게 퍼지되 **외곽선 링이라 캐릭터를 가리지 않음**. 곰·코끼리·햄스터(원숭이) 모두 링 아래로 또렷이 보임. 스킬 말풍선·✨·먼지 정상. **occlusion 문제 없음 — 의도대로 더 넓고 더 두꺼움**.
- **race-start.png**: 6인 출발선 정렬·이름표·리더보드 정상. 회귀 없음.
- **race-mid.png**: 중반 클러스터 + roar 글로우 + 중계자막("선두 교체!") + 아이템박스 정상.
- **result.png**: 파란 시상대(원숭이 1·곰 2·토끼 3) + 결과모달 + 추첨매핑("커피 쏘기") 정상.

## 결론
전 게이트 통과, 경계면 정합성 모두 일치, 시각 회귀 없음. **최종 통과.**
단, 밸런스 모니터링 노트: monkey가 5종 중 최약체(0.118)로 하한 버퍼가 가장 얇음 — 추후 밸런스 튜닝 시 monkey를 1순위로.
