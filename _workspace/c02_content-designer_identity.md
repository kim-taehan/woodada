# c02 content-designer: 캐릭터 정체성(직선/곡선) 반영

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/data/characters/dog.ts` | speed·power 삭제, cornering: 1 유지 (주석 정리) |
| `src/data/characters/penguin.ts` | speed·power 삭제, cornering: 2 추가 |
| `src/data/characters/bear.ts` | speed·power 삭제, cornering: 2 추가 |
| `src/data/characters/monkey.ts` | speed·power 삭제, cornering: 3 추가 |
| `src/data/characters/alien.ts` | speed·power 삭제, cornering: 3 추가 |
| `src/data/characters/cat.ts` | speed·power 삭제, cornering: 4 추가 |
| `src/data/characters/fox.ts` | speed·power 삭제, cornering: 4 추가 |
| `src/data/characters/hedgehog.ts` | speed·power 삭제, cornering: 5 추가 |
| `src/data/characters/spider.ts` | speed·power 삭제, cornering: 5 유지 (주석 정리) |
| `docs/guide/character-guide.md` | 능력치 설명 speed/power → 직선/곡선 교체, 각 캐릭터 스탯 줄 교체, 구미호 섹션 추가, 한눈에 보기 표 직선/곡선 열 추가 |

## cornering 배정 결과

| 캐릭터 | cornering | 직선 (6-c) | 곡선 (c) |
|---|---|---|---|
| dog | 1 | 5 | 1 |
| penguin | 2 | 4 | 2 |
| bear | 2 | 4 | 2 |
| monkey | 3 | 3 | 3 |
| alien | 3 | 3 | 3 |
| cat | 4 | 2 | 4 |
| fox | 4 | 2 | 4 |
| hedgehog | 5 | 1 | 5 |
| spider | 5 | 1 | 5 |

## 표시 변경 위치

- **SetupScreen.ts**: 캐릭터 스탯 막대 없음 — 변경 불필요.
- **docs/guide/character-guide.md**: 
  - 상단 설명 블록: "속도/파워" → "직선/곡선" 설명으로 교체
  - 한눈에 보기 표: 직선/곡선 열 추가 + 구미호 행 추가
  - 각 캐릭터 섹션: `🏃 속도 / 🛡️ 파워` → `📏 직선 / 🔄 곡선` 스타 표시로 교체

## 직선/곡선 파생식

```
직선 = 6 - cornering   (cornering 1 → 직선 5, cornering 5 → 직선 1)
곡선 = cornering       (1~5 스케일 그대로)
```

공정성: cornering이 낮을수록 직선 구간에서 이득, 곡선 구간에서 손실. 거리가중 합산 시 한 바퀴 합이 0이 되어 전체 평균 페이스는 동일(엔진이 보장).
