# 06 renderer-dev — 팀 색상 조끼 (Phase 1 §4)

## 구현 방식
몸통(`body`) 파츠의 **base 타원** 위에 팀 색 조끼 타원을 오버레이로 얹었다.
조끼 Graphics를 `body` 파트 Container의 자식으로 넣어, 스윙·스쿼시·기울기 시
몸통과 함께 움직인다(같은 좌표계). 얼굴·눈·귀·다리·꼬리는 원래 색 그대로 — 치비 귀여움 보존.

조끼 지오메트리(몸통 base 타원 `(cx,cy,rx,ry)` 기준):
- 중심 `cy - ry*0.16` (가슴/등 약간 위), 반지름 `rx*0.82` × `ry*0.7`.
- fill = `teamPalette[teamId].fill`, stroke = `.trim` (width 3, 항상 그림).
  → 화이트(#F4F4F4, 트림 #444)·블랙(#2B2B2B, 트림 #DDD)이 배경·외곽선에 안 묻힌다.
- `teamId`가 없거나 4팀 ID가 아니면 조끼 미표시 — 기존 외형 그대로(개인전).
- 회전 단위 함정: 조끼는 파트 변환을 그대로 상속하므로 별도 rot 변환 없음.

## 변경 파일
- `src/renderer/character/PartsCharacter.ts`
  - `teamId?: string` 생성자 인자 추가(5번째, scale 다음).
  - `isTeamId()` 타입가드 + `buildVest(bodyShapes, team)` 헬퍼(상단), `hexToNum`.
  - 파츠 빌드 루프에서 `part.name === 'body'`일 때 조끼 child 추가.
- `src/renderer/RaceRenderer.ts`
  - `new PartsCharacter(model, palette, runStyle, undefined, p.teamId)` — teamId 전달.
- `src/main.ts`
  - 시각 캡처 훅용: `configFor(...,teamIds?)` + `CaptureOpts.teamIds`.
    `showRaceAt({teamIds})`로 팀 배정 프레임을 캡처 가능. (영구 추가, 디폴트 동작 불변.)

## 시각 검증 (Playwright + Read 육안)
임시 스펙으로 캐릭터 1명씩 4팀 배정 → 프레임 40 캡처 후 Read.
- **red / 곰**: 빨강 조끼 가슴에 또렷. 곰 갈색 몸·얼굴·귀·발 보존. 빨강 트랙 대비 보통이나 식별됨.
- **blue / 강아지(측면 갤럽)**: 파랑 조끼 토르소에 선명, 트랙 대비 강함. 꼬리·다리·얼굴 보존, 스쿼시/기울기에 조끼가 함께 움직임 확인.
- **white / 코끼리**: 흰 조끼 + 짙은 #444 트림으로 회색 몸·빨강 트랙 양쪽에서 또렷.
- **black / 토끼**: 검정 조끼 + 밝은 #DDD 트림으로 흰 토끼 몸 위에서 강하게 분리됨.
- 네 색 모두 또렷이 구분, 화이트/블랙도 트림 덕에 명확, 얼굴·귀여움 안 가림.

teamId는 정상적으로 실려 조끼가 떴다(위장 아님).

## 산출물
- 영구 골든 1장: `tests/e2e/__screens__/team-vest.png` (blue/강아지, 측면 조끼 확인용).
- 임시 디버그 스펙·PNG(red/white/black/grouped)는 검증 후 삭제(레포 클린).
- `npm run typecheck` 통과.

## 후속 노트
- content-designer: 빨강 조끼가 빨강 트랙과 대비가 약한 편(식별은 됨). 추후 트랙/배경
  팔레트 조정 또는 빨강 조끼 트림을 더 진하게(현재 #8E2A23) 검토 가능.
- Phase 2 릴레이 렌더러(바통 FX·레그 카운터)는 별도 작업.
