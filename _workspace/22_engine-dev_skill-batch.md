# 22 · engine-dev · 스킬 3종 변경 배치 (고양이/독수리/펭귄)

## 결과 요약
- `npm run typecheck` ✅ · `npm run test` ✅ (41/41) · 결정론·릴레이·스코어링·overtake 회귀 0.
- 비대상 경로(zoomies/banana/roar 동작, 결정론, 릴레이, 스코어링) 불변. banana/roar는 면역 헬퍼 호출만 `ctx.tryDodge`로 교체.
- 모든 신규 무작위성은 시드 Rng 서브스트림(`skill:<id>` → `fork('dodge:'+frame)`, divebomb는 attacker substream). 드로 순서 의존 없음.

## 변경 파일
**엔진**
- `src/engine/types.ts` — `SkillRuntime` 갱신(immuneUntil 제거 → dodgeUntil/dodgeChance/dodgeFrame/dodgeRoll), `IceZoneState` 신설, `EngineFrame.iceZones` 추가.
- `src/engine/skills/types.ts` — `SkillContext`에 `tryDodge(target)`, `addIceZone(zone)` 추가.
- `src/engine/skills/dodge.ts` — **신설**(immunity.ts 대체). 확률 회피 헬퍼.
- `src/engine/skills/catwalk.ts` — 면역 → 확률 회피 창.
- `src/engine/skills/divebomb.ts` — **신설**(snatch.ts 대체).
- `src/engine/skills/icefield.ts` — **신설**(flood 미구현 대체).
- `src/engine/skills/banana.ts`, `roar.ts` — `isDisruptImmune` → `ctx.tryDodge`.
- `src/engine/skills/index.ts` — snatch 제거, divebomb·icefield 등록(flood 미존재).
- `src/engine/skills/immunity.ts`, `snatch.ts` — **삭제**.
- `src/engine/RaceEngine.ts` — IceZone 내부 상태 + `addIceZone`/`tryDodge` ctx 주입 + `applyIce`(advance 내) + iceZones 스냅샷/만료 + 아이템 슬립 확률 회피 연동.

**데이터**
- `src/data/characters/cat.ts` — type 유지(catwalk), params `{windowMs:1500, slipBoost:0.16, dodgeChance:0.6}`.
- `src/data/characters/eagle.ts` — type `snatch`→`divebomb`, params `{range:70, stunMs:700, selfRiskChance:0.5, diveBurst:0.9, diveBurstMs:800}`, line `급강하!! 🦅`.
- `src/data/characters/penguin.ts` — type `flood`→`icefield`, params `{zoneLength:130, durationMs:3200, slowFactor:0.85, boostFactor:1.05, aheadOffset:40}`, 빙판 테마 lines.
- `src/data/schema.ts` — `SkillType` 유니온 `snatch`/`flood` → `divebomb`/`icefield`.

**테스트**
- `tests/unit/schema.test.ts` — KNOWN_SKILL_TYPES = zoomies,catwalk,banana,divebomb,roar,icefield; catalog에 penguin 추가(기존 누락 수정).
- `tests/unit/skills.test.ts` — 활성 집합 갱신, catwalk 확률회피·0/1 경계, divebomb hit/self-botch/whiff, icefield boost/slow/위치/지속, 결정론.

## 밸런스 (params 소폭 제안 — 과튜닝 금지)
spec 제시값 그대로면 **펭귄이 독주**해서(boost 1.25 + slow 0.6 = self-boost 루프, 6인 로스터 승률 0.72, 슬롯 0.36 > 0.45 룰 위반) 두 값을 낮췄음:
- penguin `slowFactor 0.6→0.85`, `boostFactor 1.25→1.05` (다른 param·로직 동일).
- eagle divebomb은 순수 방해(앞 레이서 스턴)라 **자기 순위 상승이 없어 구조적으로 약함**(어떤 range/stun/cooldown 튜닝으로도 0.07~0.08 천장). 50/50 도박 설계를 살리려 **성공 시 자기 전진 버스트**(`diveBurst`/`diveBurstMs`) 추가 — 도박의 보상이 생겨 eagle이 실제로 이길 수 있게 됨.

**balance.ts(5종, 펭귄 제외, N=3000)**
| | dog | cat | monkey | eagle | bear |
|---|---|---|---|---|---|
| before(snatch/면역) | ~0.32 | ~0.19 | ~0.12 | ~0.12 | ~0.19 |
| after | 0.291 | 0.216 | 0.118 | 0.155 | 0.220 |
독주(>0.45) 없음, 약체(<0.1) 없음, avg lead changes 7.8.

**6종 로스터(bias 테스트, N=1200)**: dog 0.263 / cat 0.164 / bear 0.159 / monkey 0.104 / eagle 0.134 / penguin 0.176. 모든 슬롯 [0.025,0.183]·모든 캐릭터 [0.1,0.6] 게이트 통과.

> 주의: `scripts/balance.ts`의 `ids` 배열은 penguin을 포함하지 않음(5종×2). 펭귄 밸런스는 위 6종 진단으로 확인. 로스터 반영하려면 ids에 penguin 추가 필요(스코프 외라 미변경).

---

## renderer 인계 명세 (3종 이벤트/상태)

### 1) catwalk dodge — `targetId = 고양이`
확률 회피로 바뀌었지만 **이벤트 형태는 동일**: 회피 성공 시 방해 출처가 `{ variant:'dodge', targetId:<고양이 id> }`를 emit. type은 출처별(`banana`/`roar`/`divebomb`/`item`). 점프·냥펀치 연출 트리거는 그대로 `variant==='dodge' && targetId===cat`로 가능. **실패 시엔 dodge 안 옴**(스턴 정상 적용)이므로 "냐옹 회피"는 성공 프레임에만. 더 이상 `racer.skill.immuneUntil` 없음 → 글로우 창 표시는 `racer.skill.dodgeUntil`을 보면 됨.

### 2) divebomb — activate / hit / self-botch 구분
- `{ variant:'activate' }` — 발동(표적 유무 무관, 헛스윙도 activate만).
- `{ variant:'hit', targetId }` 에서:
  - `targetId !== racerId` → **명중**(표적 스턴). 깃털·강타 FX는 targetId 위에.
  - `targetId === racerId` → **자폭**(독수리 본인이 처박힘). 자폭 연출은 racerId(=독수리) 위에. (별도 variant 없이 self-targeting으로 구분.)
- `{ variant:'dodge', targetId }` — 고양이가 급강하를 회피(스턴 무효). 위 catwalk dodge 경로.
- 성공 시 독수리는 `phase:'straying'` + `skill.burst`(diveBurst)로 잠깐 가속하니 스피드라인 연출 가능.

### 3) icefield — `EngineFrame.iceZones` (신규 프레임 상태)
ItemBoxState와 같은 패턴. 매 프레임 `frame.iceZones: IceZoneState[]` 노출(활성 구역만):
```ts
interface IceZoneState {
  id: string;            // 안정 id (ice0, ice1…) — 스프라이트 매칭용
  startProgress: number; // 0..trackLength, 한 바퀴 기준 시작점(랩 wrap 가능)
  length: number;        // 구역 길이(engine units, 트랙 길이 단위)
  activeUntil: number;   // 만료 프레임(페이드아웃 타이밍)
  ownerId: string;       // 깐 펭귄 racerId
}
```
렌더러는 트랙(progress→화면) 매핑으로 `[startProgress, startProgress+length)` 구간을 빙판 텍스처로 그리면 됨. **wrap 처리**: `start+length > trackLength`면 `[start, trackLength)` + `[0, start+length-trackLength)` 두 조각. 만료 시 다음 프레임부터 배열에서 사라짐(페이드는 `activeUntil` 기준 미리). penguin.palette에 `water`/얼음 틴트 색 있음(빙판 색은 디자이너와 조율). 발동 이벤트는 `{ type:'icefield', variant:'activate', racerId:<펭귄> }`.

## renderer-dev 후속 작업 플래그 (스코프 외, 인계)
- `src/renderer/fx/commentaryLines.ts`·`RaceRenderer.ts`·`FxLayer.ts`에 `snatch:*` 키/주석 잔존 → `divebomb:*`로 교체 필요(엔진은 더 이상 snatch emit 안 함). icefield activate·iceZones 빙판 연출, divebomb self-botch 연출 신규 필요.
- 테스트는 통과하나(렌더러는 string-keyed라 typecheck 영향 없음) **연출은 비어 있음** — renderer-dev가 채워야 함.
