# 24 · renderer-dev · 고양이 측면 4족 갤럽 시각검증

## 결론
**고양이 측면 4족 갤럽 OK.** 렌더러 코드 수정 불필요(데이터만으로 정상 동작). typecheck 통과, e2e 3 passed.

## 1. 렌더러 코드 사전 확인 (`src/renderer/character/PartsCharacter.ts`)
- `style === 'gallop'` 분기(L176~191)가 `legL/legR/frontLegL/frontLegR` 네이밍으로 다리 스윙 — cat.ts 신규 네이밍과 일치. far쌍(`legR`/`frontLegR`) 위상 +0.5 지연, frontLeg 쌍 `+swing*42°`(reach), 뒷다리 쌍 `-swing*42°`(push). rot은 도(*DEG L259).
- flip: `this.inner.scale.x = dir`(L265) — 모델은 +x로 작성, 진행방향 통째 미러. 측면 모델에 정확.
- ear/tail auto-stream(L167) — cat은 `earL`+`tail` 보유. 정상. (cat은 `earR` 없음=단일 귀, 분기 영향 없음.)
- gallop pitch(L273): `dir*(0.05+speedNorm*0.06)` 몸 이미 수평이라 약한 기울기.
→ 측면 4족엔 gallop 분기가 그대로 정답. 좌표계도 dog와 동일 프레임이라 inner.y=-55 기준선 정상 안착.

## 2. 캡처 (`npx playwright test race-visual.spec.ts --project=desktop`, 3 passed)
풀로스터(penguin/dog/cat/monkey/eagle/bear, seed 7) 캡처 — 절대경로:
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/race-start.png
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/race-mid.png
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/race-catwalk-activate.png  (고양이 스킬 발동)
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/race-lastlap.png
- /Users/a08368/vscodeProjects/woodada/woodada-v3/tests/e2e/__screens__/race-finish.png

추가로 cat+dog 격리 캡처(임시 spec, 검증 후 삭제)로 다리스윙·flip을 가림 없이 확인 — 가장 결정적 프레임이 좌향 주행 cat/dog 동시 노출(아래 판정 근거). 임시 산출물은 정리 완료(레포 오염 없음).

## 3. 확인 포인트 OK/NG (Read로 육안 확인)
| 항목 | 판정 | 근거 |
|---|---|---|
| 고양이 측면 4족 스윙(정면 2족 잔재 없음) | **OK** | 좌/우향 모두 측면 프로필, 다리 갤럽 교대 스윙. 정면 흔적 없음 |
| 날씬한 슬림 실루엣 | **OK** | 강아지 둥근 배럴보다 확연히 가늘고 길쭉. body rx27/ry19 효과 뚜렷 |
| far 다리 가시성·원근감 | **OK** | far쌍(legR/frontLegR)이 어두운 회색(#838B94)으로 body 뒤에서 보임. near쌍은 base색으로 앞 |
| 진행방향 flip 자연스러움 | **OK** | 우향(우측 직선)·좌향(좌측 직선) 둘 다 머리·꼬리·수염 방향 일치, 얼굴/글자 뒤집힘 없음 |
| 귀여움(큰 눈+하이라이트, 블러시, 도도한 윗눈꺼풀) | **OK** | 큰 아몬드 눈+하이라이트 점, 볼 블러시, 반쯤 감긴 눈꺼풀, 삼각 귀+분홍 안쪽, 수염 fan, 하트 코 모두 식별 |
| 강아지 귀여움 강화 | **OK** | 머리 살짝 커지고 눈 하이라이트/볼 블러시 또렷. 갤럽 측면 실루엣 유지(과장 X) |
| 원숭이·곰·펭귄·독수리 회귀 없음 | **OK** | 펭귄 정면 biped, 원숭이 scamper, 독수리 fly, 곰 정면 chibi(둥근 귀·수염X) 모두 정상. 곰↔고양이 구별 명확 |

## 4. 렌더러 수정 여부
**수정 없음.** 데이터(cat.ts) 변경만으로 gallop 분기가 올바르게 동작. 회전단위/네이밍/좌표 기준선 모두 정합.

## NG / 회부 사항
없음. 데이터·렌더러 모두 통과.
