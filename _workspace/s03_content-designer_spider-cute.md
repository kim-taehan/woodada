# s03 content-designer — 거미 디자인 더 귀엽게 (외형만)

요청: 기능/스킬/엔진 무수정, 외형(팔레트 + 파츠모델)만 더 밝고 귀엽게. 어두운 보라(`#4A3B66`) 칙칙함 해소.

수정 파일 (src/data/ 만):
- `src/data/characters/spider.ts` — palette
- `src/data/partmodels/spider.ts` — 파츠 색/디테일

## 팔레트 before → after
| key | before | after | 의도 |
|---|---|---|---|
| base | `#4A3B66` (어두운 보라) | `#9B7FD4` (밝은 파스텔 라벤더) | 칙칙함 제거, 화사하게 |
| point | `#8A6FB0` | `#D6C5F5` (소프트 라일락) | 배 무늬가 또렷이 보이게 |
| outline | `#241A38` (거의 검정) | `#5A4488` (소프트 플럼) | 시커먼 윤곽 완화 |
| cheek | `#E89AA0` | `#FF9EB4` (로지 블러시) | 볼터치 화사하게 |
| leg | (없음) | `#7B62B8` 신규 | 다리를 검정 윤곽 대신 친근한 라일락으로 |
| web | `#E8ECF2` | `#F2F0FA` | 거의 동일, 살짝 라일락 틴트. 거미줄 FX 가독성 유지 |

`leg`는 Palette가 open schema(`[k: string]`)라 추가 가능. 다리 path stroke가 `outline`→`leg`로 바뀌어 부드러워짐.

## 파츠 변경점 (partmodels/spider.ts)
- 다리 8개 전부 stroke `outline`→`leg`, strokeW 3→3.4 (앞다리 3.4→3.8). 앞다리 끝 sticky tip을 `web` 작은 원(r2.6)→`point` 둥근 발(r3.4)로: 끈끈이 가시 대신 통통한 발.
- body: 배 무늬 opacity 0.85→불투명 + rx/ry 14→15, 윗부분에 `HI` 광택 하이라이트 추가.
- head: 큰 눈 r9→r10, 하이라이트 r3→r4 + 작은 보조 반짝이 2개 추가(베이비 스키마 또렷). 윗 보조눈을 검정→`leg` 라일락(beady black 제거). 볼터치 rx/ry 키우고 opacity 0.7→0.85. 입을 꺾인 송곳니 path → 부드러운 미소 곡선(Q)으로.

회전 단위(도/라디안) 미변경, 포즈 델타 무수정 — 애니메이션/결정론 영향 없음.

## 검증
- `npm run typecheck` 통과.
- Playwright 캡처(임시 spec `spider-cute-tmp.spec.ts`로 spider/dog/cat 경주, 캡처 후 spec 삭제):
  - after 풀보드: `_workspace/shots/spider-after-60.png`
  - after 근접 크롭: `_workspace/shots/spider-after-crop.png`
  - before 참고(기존): `tests/e2e/__screens__/abduct-reel-p0.png`, `abduct-reel-p5.png`
- 육안 결과: before는 어두운 보라 + 검정 다리 = 칙칙한 거미 덩어리. after는 밝은 라벤더 둥근 머리/몸, 큰 반짝이는 눈 + 하이라이트, 또렷한 라일락 배, 분홍 볼터치, 부드러운 라일락 다리. 확실히 더 밝고 귀여움. 파츠 깨짐/누락 없음, 거미줄 실크 가독성 유지, 거미 정체성(둥근 보라 + 다리 + 실크) 유지.

## 역할/실루엣 비중복
색만 라이트닝 — 실루엣(둥근 단일 몸통 + 다리 여러 개)과 역할(abduct 거미줄 견인)은 그대로라 다른 로스터와 안 겹침.
