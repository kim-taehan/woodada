# s13 renderer-dev — 16명 붐비는 개인전 가독성 (말풍선·FX 정리 + 자막 폭주 억제)

## 목표
최대 16명 개인전에서 머리 위 말풍선·FX 글로우/✨·하단 자막이 겹쳐 뭉개지고 자막이 너무
빨리 바뀌는 문제를 **렌더러 연출로만** 완화. 소규모(≤6명) 필드 룩은 그대로 보존.

## 핵심 신호: crowdEase (이미 존재하던 crowding 재사용)
`RaceRenderer.ts`에 이미 있던 `crowding(fieldSize)` (0 at FIELD_MIN=6 → 1 at FIELD_MAX=16, smoothstep)
를 `buildScene`에서 `crowdEase`로 보관하고 모든 가독성 댐퍼의 게이트로 사용.
- 필드 ≤6 → crowdEase=0 → **모든 경로가 기존과 동일** (소규모 룩 불변, byte-identical 확인됨).
- 필드는 `fieldSizeOf(cfg)` (릴레이는 활성 팀 수, 그 외 헤드카운트) — 기존 함수 그대로.
- (브리핑의 `racersOnTrack()`는 실제로 존재하지 않았음. 대신 동등한 `fieldSizeOf`/`crowding` 사용.)

## ① 말풍선·FX 정리

### 동시 말풍선 개수 제한 — `fx/SpeechBubble.ts`
- `setMaxConcurrent(n)` 추가. spawn 시 cap 초과분은 **가장 오래된 것부터 destroy** (최신 우선).
- 임계값(`RaceRenderer.buildScene`): `crowdEase>0 ? round(10 - 6*crowdEase) : Infinity`
  - 소규모 → ∞ (제한 없음, 기존 동일), 16명(crowdEase=1) → **최신 4개만** 유지.
- per-owner 중복 교체 로직은 그대로(한 캐릭터는 항상 1개).

### FX 강도 인원 비례 축소 — `fx/FxLayer.ts`
- `setIntensity(v)` 추가. 파티클 알파를 매 프레임 `intensity` 배. `baseAlpha`를 spawn 시 캡처해
  중복 곱 없이 일관 적용. **fade 파티클은 기존 `1-k` 룩 유지**(×intensity만), non-fade는 `baseAlpha×intensity`.
- 임계값: `fx.setIntensity(1 - 0.55*crowdEase)` → 16명에서 알파 ~0.45배. crowdEase=0 → 1.0 (불변).

### 글로우 헤일로 축소 — `RaceRenderer.renderFrame`
- 스킬 글로우 알파 `×(1 - 0.5*crowdEase)`, 반경 스케일 `×(1 - 0.2*crowdEase)`.
  16명에서 알파 절반·약간 더 타이트. crowdEase=0 → 식이 기존과 동일.

## ② 자막 폭주 억제 — `fx/Commentary.ts`
- `say(text, now, force=false): boolean`로 변경. **레이트리밋 + 중복 제거**:
  - 현재 라인이 `MIN_HOLD`(1.4s) 안 지났으면 신규 일반 라인 **드롭**(타이머 리셋 안 함).
  - **완전 동일 라인**은 무시(중복으로 타이머 리셋 방지).
  - `force=true`(마지막 바퀴 종소리 announce)는 hold 무시 → 우선 라인 항상 표출.
- `RaceRenderer`: 이벤트 라인은 기존대로 `saidThisFrame` 클레임(선두교체가 양보) 유지하되 실제
  스왑은 CommentaryBar가 리밋. `triggerLastLap`의 say는 `force:true`로 호출.
- 주: 레이트리밋은 인원수 무관(전역). 작은 필드에서도 자막이 덜 깜빡여 읽기 좋아짐(브리핑 ② 취지).

## 검증
- `npm run typecheck` ✅ 통과.
- e2e `race-visual.spec.ts --project=desktop` 5/5 ✅ (골든은 픽셀 assert 없음, 시각 캡처 방식).
- **임시 캡처 스펙으로 before/after 16-busiest/mid/late + 4-busiest/mid 비교(육안)**:
  - 16명 busiest: before는 클러스터 위 금/백색 글로우 돔 + 말풍선 4개 완전 겹침 → 캐릭터 안 보임.
    after는 글로우가 흐려·타이트해져 펭귄/체커기/개별 캐릭터가 비치고, 말풍선 cap(최신 4)으로 벽 방지. **명확히 덜 뭉개짐.**
  - 16명 late: 곰 포효가 터져도 글로우 도배 없이 거미/펭귄/곰/외계인/고슴도치 개별 식별 가능, 자막 1줄 또렷.
  - 4명 busiest: **before와 byte-identical**(cmp 확인) — 작은 필드 FX/글로우/말풍선 경로 완전 불변.
  - 4명 mid: 캐릭터 풀사이즈·글로우 풀강도·자막 또렷. (자막 라인만 레이트리밋으로 달라짐, 읽기 양호.)
  - 기본 8명 로스터(`race-zoomies-activate`): crowdEase≈0.1로 글로우 ~5% 미세 감광(체감 무) — 회귀 없음.
- 임시 스펙/캡처는 검증 후 삭제(레포 정리). 캡처 재현은 `window.__woodada.simulate/showRaceAt`에
  `characterIds`로 16/4인 로스터 전달.

## 변경 파일 (모두 src/renderer/)
- `src/renderer/RaceRenderer.ts` — crowdEase 보관, 말풍선 cap/FX intensity 설정, 글로우 감광, say 주석.
- `src/renderer/fx/SpeechBubble.ts` — `setMaxConcurrent` + cap 적용.
- `src/renderer/fx/FxLayer.ts` — `setIntensity` + baseAlpha 기반 알파 스케일.
- `src/renderer/fx/Commentary.ts` — MIN_HOLD 레이트리밋 + 중복 제거 + force.

## 제약 준수
- `src/renderer/`만 변경. 엔진/데이터/셸/결정론/밸런스/캡처 훅 불변.
- 회전 단위 함정 무관(알파/스케일만 건드림).
- 방금 다른 renderer 작업(원숭이/고양이/외계인 멘트)의 `RaceRenderer.ts`·`commentaryLines.ts`
  변경 위에 얹음 — `commentaryLines.ts`는 건드리지 않음.
- (참고: 작업 트리의 `src/engine/*`·`tests/unit/skills.test.ts`·`alien.ts` 변경 및 그
  `sawExemptionMatter` 단위테스트 실패는 동일 브랜치에서 진행 중인 #9 icefield 면제 작업 것으로,
  본 렌더러 작업과 무관.)
