# s12 · engine-dev · 외계인 빙판(icefield) 슬로우 면제 (비행)

## 요구
외계인은 UFO로 떠다니므로 펭귄 `icefield` 빙판 슬로우를 **완전 면제**(가속 아님, 무영향)받아야 한다. 펭귄(가속)·다른 비펭귄(감속)은 그대로. id 하드코딩 금지 — 데이터 트레잇으로.

## 트레잇 이름 & 적용부
- **트레잇**: `CharacterData.airborne?: boolean` (신설, `src/data/schema.ts`). 의미: "트랙에 닿지 않고 떠/날아다님 → 지면 환경 효과(빙판 등) 면제". 기본 false.
- **데이터**: `src/data/characters/alien.ts`에 `airborne: true` 추가. (palette/스킬은 미변경 영역 — 다른 에이전트 동시작업 존중)
- **엔진 적용부**: `src/engine/RaceEngine.ts` `applyIce()` — 존을 찾고 ⭐스타 면역 체크 직후, 종(species) 분기 **이전**에:
  ```ts
  if (config.characters[self.characterId]?.airborne) return; // 떠 있으니 접촉 없음
  ```
  엔진은 이미 `config.characters[self.characterId]`를 여러 곳에서 읽으므로 동일 패턴. id 하드코딩 0, 순수 결정론적 분기(Rng/Math.random 미사용).

## 불변 규칙 준수
- 엔진 순수성·결정론 유지: 면제는 데이터 트레잇을 읽는 결정론 분기일 뿐. `engine-determinism.test.ts` 4개 통과.
- mimic으로 외계인이 icefield를 복사해도 영향 없음(복사는 존을 *까는* 행위, 면제는 존 *안에서의 효과* — 직교).
- icefield/alien 외 다른 스킬·캐릭터 로직 미변경.

## 테스트
`tests/unit/skills.test.ts`에 "icefield: the airborne alien is exempt from the slow" 추가:
- **(1) 집계 A/B**: 같은 시드들을 `airborne:true`(면제) vs `airborne:false`(접지) 두 카탈로그로 재생, 외계인 최종 progress 합 비교 → `exemptTotal > groundedTotal`(슬립 제거는 항상 도움). **스탯 튜닝 불변**을 위해 A/B 양쪽 모두 외계인 mimic 비활성(cooldown [1e9,1e9])·speed/power 고정 → 유일 차이는 `airborne` 하나 → 빙판 접촉만이 발산 원인(트래픽/발동 노이즈 제거).
- **(2) 라이브니스**: 면제런에서 같은 존 안의 비펭귄·비외계인은 여전히 슬립(step<1.2) → 면제는 외계인 한정, 존은 실제 활성. (외계인 자체엔 per-frame 바닥 단언 안 함 — 트래픽/캐치업으로 빙판과 무관하게 step이 내려갈 수 있으므로 ice 배수 제거는 (1)의 집계로 측정.)
- 기존 펭귄 가속·비펭귄 감속 케이스, 고양이 점프 케이스 그대로 통과.

## 검증 결과
- `npm run typecheck`: 통과.
- `npx vitest run tests/unit/skills.test.ts`: 13/13 통과(airborne 새 테스트 포함).
- `npx vitest run tests/unit/engine-determinism.test.ts`: 4/4 통과.

## 밸런스 (중요 — 면제는 의미 있는 버프)
면제 적용 후 외계인이 과해짐(`scripts/balance.ts --laps 1`, N=3000):

| 모드 | before(면제 전) | after(면제·무튜닝) |
|---|---|---|
| INDIVIDUAL | 13% (1.03×) | **19% (1.52×)**, runaway 0.458→0.468 |
| TEAM rank-sum 2-pairs | ~13% | **30% (2.37×)** ← 최대 문제 |
| RELAY | ~13% | 18% (1.45×) |

→ `engine-bias.test.ts` "every start slot ... laps=1" 천장 초과(외계인 슬롯 171 > 165).
- **레버 분석**: scanRange는 무력(350→250 변화 0) — 강함은 mimic이 아니라 빙판 면제 자체. 실효 레버는 speed/cooldown.
- **balance-tuner에 위임**: 멀티모드 오프셋(cooldown/speed)으로 정상화 진행 중. (테스트를 스탯 불변으로 만들어 너프해도 airborne 게이트가 안 깨지게 선처리 완료.)

## 변경 파일
- `src/data/schema.ts` — `airborne?: boolean` 추가
- `src/data/characters/alien.ts` — `airborne: true`
- `src/engine/RaceEngine.ts` — `applyIce` 면제 분기 1줄
- `tests/unit/skills.test.ts` — airborne 면제 테스트 1개

## qa-verifier 플래그
- 결정론 영향 없음(순수 분기). 골든 스크린샷 영향 없음.
- 밸런스 최종 수치는 balance-tuner 보고 반영 후 확정.
