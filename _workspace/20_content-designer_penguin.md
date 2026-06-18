# 20 · content-designer — 🐧 펭귄 추가 (6번째 캐릭터)

데이터 + 파츠모델 + 등록만 수행. 스킬 핸들러(engine), FX(renderer)는 다른 에이전트.

## 변경/신설 파일
| 파일 | 변경 |
|---|---|
| `src/data/characters/penguin.ts` | 신설 — CharacterData |
| `src/data/partmodels/penguin.ts` | 신설 — PartModel (정면 치비, biped) |
| `src/data/characters/index.ts` | catalog + defaultCharacterIds + export에 penguin 추가 |
| `src/data/partmodels/index.ts` | partModels에 penguin 등록 |
| `src/shell/screens/SetupScreen.ts` | CHAR_LABEL에 `penguin:'🐧'` (한 항목만) |
| `src/main.ts` | DEFAULT_IDS: 중복 `bear` 슬롯 → `penguin` (6슬롯 유지, 스크린샷 로스터) |

## 역할 비중복 (확인)
| 캐릭터 | 역할 | type |
|---|---|---|
| 🐶 강아지 | 부스트·변칙 | zoomies |
| 🐱 고양이 | 회피·면역·슬립 | catwalk |
| 🐒 원숭이 | 방해·저격 | banana |
| 🦅 독수리 | 순위 강탈(다이브) | snatch |
| 🐻 곰 | 광역 스턴·방해 | roar |
| 🐧 **펭귄** | **지역 물바다·팀 인지 감속(함정형 광역, 팀 구분)** | **flood** |

펭귄 역할은 "구역 함정 + 팀/자기 면제"라는 점에서 기존 어느 역할과도 겹치지 않음.
- snatch=1:1 순위강탈, roar=주변 즉시 스턴, banana=단발 함정(팀 무관) 과 구분.
- flood는 **지속 구역**을 깔고 **팀 소속**으로 영향 대상을 가르는 게 고유점.

## engine-dev 인계 — `type: 'flood'` 핸들러 명세
`src/engine/skills/flood.ts` 신설 + `skills/index.ts` 등록 필요.

### params (penguin.ts 확정 형태)
```ts
skill: {
  type: 'flood',
  cooldownMs: [5000, 8000],
  params: { zoneLength: 130, durationMs: 3200, slowFactor: 0.55 },
}
```
- `zoneLength: 130` — 물바다 구역의 progress 길이(트랙 단위). 발동 위치(보통 펭귄 전방/현재 위치) 기준으로 이 길이만큼의 구역.
- `durationMs: 3200` — 구역이 트랙에 유지되는 시간.
- `slowFactor: 0.55` — 영향받는 동물의 속도 배수(0.55 = 45% 감속).

### 동작 의도 (팀 인지)
- 구역 안에 들어온 **상대 팀** 레이서: 속도 × `slowFactor`.
- **같은 팀 + 펭귄 자신**: 속도 유지(면제).
- **개인전(팀 없음)**: 펭귄 자신만 면제, 나머지 전원 감속.
- 결정론 준수: `rng.fork('skill:flood:'+id)` 등 안정 라벨 서브스트림. 위치/지속은 params에서.

## renderer-dev 인계 — 펭귄 파츠/팔레트
- `partModelId: 'penguin'`, `runStyle: 'biped'` (뒤뚱뒤뚱 — legL/legR 교대 + armL/armR 플리퍼 스윙).
- 파츠(z순): tail(0) · legL/legR(1, 오렌지 물갈퀴 삼각) · body(2, 검정 등 + 큰 크림 배) · armL/armR(3, 짧은 검정 플리퍼) · head(5, 검정 캡 + 흰 얼굴마스크 + 큰눈 + 오렌지 삼각부리).
- 플리퍼를 `armL/armR`로 둔 이유: biped 핸들러가 arm을 스윙하므로 별도 코드 없이 뒤뚱 연출됨.
- 팔레트 키: base(#2B3540 검정), point(#F4F1EA 흰), outline(#161C24), cheek(#F2A6B6), **beak(#F2972F 오렌지 부리+발)**, **water(#5BC8E8 물바다 FX 틴트용)**.
- flood FX: `palette.water`(#5BC8E8)를 구역 틴트/물웅덩이 색으로 활용 가능.

## qa-verifier 인계 — 갱신 필요 테스트
flood 미등록 상태에서 아래가 실패하는 것은 정상(engine/qa가 처리):
- `tests/unit/schema.test.ts:4` `KNOWN_SKILL_TYPES`에 `'flood'` 추가 필요.
- `tests/unit/schema.test.ts:20` catalog 목록에 `'penguin'` 추가 → `['bear','cat','dog','eagle','monkey','penguin']`.
- `tests/unit/skills.test.ts` — flood 활성 스킬 검증 케이스 추가는 engine 핸들러 완성 후.

## 자가검증
- `npm run typecheck` → **0 errors** (penguin 데이터/파츠 타입 통과).
