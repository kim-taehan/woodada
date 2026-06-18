# 통합 캐릭터 로스터 문서 작성 — 완료 요약

## 산출물
- `docs/character-roster.md` (단일 파일, 캐릭터별 별도 파일 없음)

## 작업 내용
6종(dog·cat·monkey·eagle·bear·penguin) 데이터를 읽어 한 문서로 정리.
- 맨 위: 로스터 요약 표(이모지·이름·역할·스킬·한 줄) + 능력치 모델 설명.
- 캐릭터별 상세 섹션 4항목: 이미지/렌더링, 스킬, 대사, 능력치.
- 맨 아래: 쿨다운·핵심 수치 한눈 비교표.

## 읽은 파일 (읽기 전용, 코드 미수정)
- `src/data/characters/{dog,cat,monkey,eagle,bear,penguin}.ts`
- `src/data/partmodels/{dog,cat,monkey,eagle,bear,penguin}.ts` + `types.ts`
- `src/engine/skills/{zoomies,catwalk,banana,divebomb,roar,icefield}.ts`
- `src/engine/RaceEngine.ts` (baseSpeed 모델 확인)

## 정확성 검증 포인트
- baseSpeed: `RaceEngine.ts:142`에서 `r.range(1.3, 1.5)` 균등 지터 + 프레임 지터(SPEED_JITTER). 캐릭터별 고정 능력치 없음을 문서에 명시. 차별화 = renderScale·스킬·쿨다운.
- 모든 params 숫자·쿨다운·대사·palette·renderScale은 데이터 원본 값 그대로(추측 없음).
- 스킬 동작 요약은 각 핸들러 주석+로직 기준.
