# h06 renderer-dev — 고슴도치 측면 네발(gallop) 렌더 시각검증

## 결과
content-designer의 gallop 측면 재설계(`runStyle 'biped'→'gallop'`, partmodel 측면 4족 전면 재작성)를 시각검증. **렌더러 코드 변경 없음** — dog/cat과 동일 gallop 규약(파트 이름 front/rear·near/far, `inner.scale.x = dir` 미러)을 그대로 따르므로 기존 gallop 분기가 처리. typecheck 통과, 단위 43/43, race-visual 5/5, 가시 측면 실루엣 + 방향 미러 육안 확인 완료.

## 확인 사실
- `src/data/characters/hedgehog.ts`: `runStyle: 'gallop'` 적용 확인. 스킬 type/params/lines/palette 불변(역할·bristle FX 그대로).
- `src/data/partmodels/hedgehog.ts`: 측면 프로필. 파트 = tail / spikes / legR·frontLegR(원측, FARLEG `#D9C29E`) / body / legL·frontLegL(근측, point) / head(+x). dog/cat gallop 분기가 frontLeg reach(±42)/legL·R push-back(-42)/body stretch/head bob를 모두 구동.
- `spikes`는 어느 절차 분기에도 안 들어감 → run 중 정적, skill 포즈 scale로만 곤두섬(의도대로). `tail`은 스트림 sway(±22) 적용(작게 흔들림, OK). `earL` 생략 — 문제 없음.

## 시각 검증 (Playwright, 임시 캡처 후 삭제)
solo 고슴도치를 오벌 한 바퀴 샘플 + 풀 로스터 bristle:
- **하단 직선(우측 진행, f30)**: 머리/주둥이 +x(오른쪽), 꼬리 -x, **갈색 가시가 등 위로** 줄지어 솟음. 낮은 4족 갤럽. dog/cat과 구분되는 가시 측면 실루엣 명확.
- **우측 곡선(f320)**: 진행방향 따라 **좌측으로 미러** — 머리 왼쪽, 가시 여전히 등 위. `inner.scale.x = dir` 정상.
- **상단 직선(좌측 진행, f420)**: 머리/주둥이 왼쪽, 가시 등 위 유지. 미러 일관·정확(가시가 뒤집혀 배 밑으로 가지 않음).
- **skill(bristle, 풀 로스터)**: 가시 quill 버스트 FX + "따끔! 붙지 마!" 말풍선 + 가시 곤두 포즈, 하단 자막 "가시에 찔린 추격자 뒤로 톡! ㅋㅋ". 측면 rig에서도 정상.
- **win(결승선)**: 가시 자랑스레 puff(win 포즈 spikes scale) + 머리 듦 + 다리 깝치기. 측면 실루엣 깨짐 없음.

판정: **gallop 측면 렌더 정상. 가시가 등 위로 제대로 뻗고, 트랙 상/하단·곡선 방향 미러 모두 맞음. 깨짐/회전단위/파트이름 오류 징후 없음.**

## QA 인계 (qa-verifier)
- typecheck OK, vitest 43/43 OK, race-visual 5/5 OK.
- 스킬 type/params/등록/로스터 7종 변경 없음 → schema/skills 테스트 추가 갱신 불필요.
- bristle FX/commentary는 이전 h03 작업 그대로 유효(이벤트 계약 불변). 렌더러 소스 무변경.
- 골든 스크린샷(`__screens__/`)은 고슴도치 측면 rig으로 갱신됨 — 의도된 변경(회귀 아님).
