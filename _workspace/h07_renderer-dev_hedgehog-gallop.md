# h07 renderer-dev — 고슴도치 측면 네발(gallop) 시각검증 (팀리드 지시)

## 결과
content-designer의 gallop 측면 재설계를 현재 코드(engine-dev의 병렬 bristle 레인조건 제거 포함)에 대해 재검증. **렌더러 코드 변경 없음** — dog/cat과 동일한 gallop 규약(파트 이름 front/rear·near/far, FARLEG, `inner.scale.x = dir` 미러)을 따르므로 기존 gallop 분기가 그대로 처리. typecheck 통과, 단위 43/43, race-visual 5/5, 육안 확인 완료.

(참고: 직전 h06에서 이미 1차 검증했고, 팀리드 지시로 현재 코드 기준 재확인. 데이터/엔진 변경 후에도 회귀 없음.)

## 팀리드 체크포인트 — 전부 통과
1. **측면 네발 갤럽 / dog·cat과 baseline·스케일 일관**: ✅ solo f30(하단 직선)에서 다른 갤럽 캐릭과 동일 트랙라인·스케일(`CHAR_SCALE * perspective` 동일 파이프라인). 낮게 엎드린 4족.
2. **등을 따라 가시 줄 = 측면 실루엣**: ✅ 갈색 가시 mantle + 위로 솟은 quill이 등~정수리 topline을 따라 뻗음. dog/cat과 구분되는 고슴도치 정체성 명확.
3. **진행방향 미러(inner.scale.x=dir)**: ✅ 하단 직선(우측)=머리 오른쪽 / 우측 곡선·상단 직선(좌측 진행)=머리 **왼쪽**으로 미러. 위 직선에서도 머리가 진행방향을 봄. 가시는 항상 등 위 유지(뒤집혀 배 밑으로 안 감).
4. **4족 갤럽 사이클 / 깨짐·회전단위 이상 없음**: ✅ frontLegL·R reach + legL·R push-back 사이클 구동. 사라짐/실루엣 깨짐/과회전 없음.
5. **skill 가시 곤두 포즈(측면)**: ✅ bristle 발동 시 가시 quill 버스트 FX + "따끔! 붙지 마!" 말풍선 + 가시 곤두 포즈(spikes scale up) + 하단 자막 "가시에 찔린 추격자 뒤로 톡! ㅋㅋ". 측면 rig에서 잘 읽힘. (engine 병렬 레인조건 제거 후에도 FX/이벤트 계약 정상 발화.)

## 확인 스크린샷 (임시 캡처 후 삭제 — 경로 기록용)
검증 시 생성: `__screens__/hh-verify-solo-f30.png`(우측 진행), `-solo-f420.png`(좌측 진행/미러), `-pack.png`(스타트 클러스터), `-skill.png`(bristle). 임시라 삭제했고, 영구 골든은 `race-visual.spec.ts` 컷(`race-start`/`race-mid`/`race-busiest` 등)에 고슴도치 측면 rig으로 반영됨.

## 산출/인계
- 렌더러 소스 변경 없음. 데이터(content-designer)·엔진(engine-dev) 변경만으로 정상 동작.
- typecheck OK / vitest 43/43 OK / race-visual 5/5 OK.
- 골든 스크린샷은 고슴도치 측면 gallop으로 갱신됨 — 의도된 변경(회귀 아님). qa-verifier 최종 게이트 가능.
