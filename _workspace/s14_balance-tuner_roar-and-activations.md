# s14 · balance-tuner · 곰 포효 범위 확대 + 발동횟수 측정

## A. 곰 포효(roar) 범위 확대

**변경:** `src/data/characters/bear.ts` skill.params `range: 22 → 28` (staggerMs 430 유지, cooldown 유지)

탐색: 22(기존) → 45(과함) → 32(hedgehog 과억제) → **28(채택)**.
- range=45: 곰 laps=1 20%(1.63×)로 독주 직전 + hedgehog 7%로 과억제 → 기각.
- range=32: 곰 적정이나 hedgehog laps=3 0.58×까지 끌어내림 → 기각.
- range=28: 곰을 floor 위로 끌어올리면서 hedgehog 보존, 누구도 독주 안 함 → 채택.

### 곰 개인전 승률 (before → after)

| laps | before win% (fair×) | after win% (fair×) |
|---|---|---|
| 1  | 13% (1.04×) | 16% (1.24×) |
| 3  | 9%  (0.73×) | 13% (1.03×) |
| 10 | 11% (0.84×) | 14% (1.08×) |

곰의 고질적 약점(특히 laps=3 0.73×, 장거리 floor 근접)이 모든 랩수에서 floor 위로 개선됨. 광역이 주변 무리를 더 제대로 쓸어 "광역다운"이 됨.

### 부수 영향 (after, 개인전)
- laps=1: 최고 bear/alien 16%·15%, 최저 hedgehog/dog 10% — 독주 없음, floor 위.
- laps=3: 최고 spider 18%, 최저 dog 8% — bear 정상화, hedgehog 9%(0.73×) 보존.
- laps=10: bear 14%(1.08×), hedgehog는 기존부터 약한 장거리 약체(0.48×)이나 roar 변경이 주원인 아님(baseline 0.62×).
- 팀전 homogeneous 2-pair에서 bear 1.90×는 전원-곰 팀이 아군 면제로 포효를 누적하는 비현실적 스트레스 구성 아티팩트(alien도 1.72×로 동급). 개인전·릴레이는 독주 없음.

## B. 캐릭터별 평균 스킬 'activate' 발동 횟수 / 경주 (개인전 8종 필드, 측정용 임시 계측, 코드 되돌림 완료)

variant==='activate'만 카운트(hold/dodge/hit 제외). roar 광역도 발동 1회.

| char     | laps=1 | laps=3 | laps=10 |
|----------|--------|--------|---------|
| dog      | 3.25   | 9.39   | 30.84   |
| cat      | 3.61   | 10.50  | 34.60   |
| monkey   | 5.21   | 14.60  | 47.44   |
| bear     | 3.58   | 10.39  | 34.01   |
| penguin  | 2.04   | 6.32   | 21.30   |
| hedgehog | 1.77   | 4.80   | 15.14   |
| spider   | 3.65   | 10.28  | 32.90   |
| alien    | 7.03   | 20.38  | 66.94   |

(N: laps=1→3000, laps=3→1500, laps=10→400. 발동횟수는 baseline range=22 측정값 — 쿨다운 미변경이라 range=28에서도 동일.)

- 발동 빈도는 캐릭터 쿨다운 길이에 좌우됨. alien(mimic)이 압도적 최다, hedgehog 최소, 곰은 중위권.
- 곰 range 확대는 쿨다운을 안 건드렸으므로 발동 빈도 불변(타격 범위만 확대).

## 검증
- `npx vitest run tests/unit/engine-bias.test.ts` → 7/7 통과 (laps=1/3/10 캐릭터·슬롯 공정 + no-runaway).
- `npm run typecheck` → 통과.
- 측정용 임시 스크립트(scripts/_activations_tmp.ts) 삭제 완료. 커밋 대상은 `bear.ts` params 한 줄뿐.
