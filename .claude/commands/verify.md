---
description: 우다다 전체 검증 (타입체크 + 단위테스트 + e2e 시각검증)
---

이 프로젝트의 품질 게이트를 순서대로 실행하고 결과를 요약해줘:

1. `npm run typecheck` — 타입 오류 0 확인
2. `npm run test` — Vitest 단위테스트 (엔진 결정론·공정성·추월·스킬·스코어링)
3. `npx playwright test --project=desktop` — Playwright 시각검증

그리고 `tests/e2e/__screens__/`의 핵심 스크린샷(race-mid, race-start, result, 스킬 발동 프레임)을
실제로 Read로 열어 **눈으로 확인**하고, 깨진 부분이 있으면 보고해줘 (캔버스는 이미지로만 검증 가능).

실패가 있으면 원인과 수정안을 제시하고, 전부 통과하면 통과 사실만 간단히 보고해줘.
