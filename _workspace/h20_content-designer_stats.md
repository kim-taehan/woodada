# h20 content-designer — speed/power 스탯 도입 (A안, 공정 추첨 유지)

동물별 정체성 스탯. speed=순항/초반 페이스, power=몸싸움·추월 저항. 반비례(합≈6, 작은 델타)로 공정성 유지. 승률은 engine-bias 게이트 + balance-tuner가 보장.

## 합의된 필드 계약 (engine-dev)
- `CharacterData`에 `speed?: number`, `power?: number` 추가. **옵셔널**(미지정 시 엔진이 3=중립으로 간주 → 하위호환·점진적용).
- 스케일 **1~5 정수**, 중앙값 3, 캐릭터당 **speed+power ≈ 6**(반비례).
- 엔진 매핑(참고, 데이터는 몰라도 됨): d=(stat-3)/2 ∈[-1,1]. speed→baseSpeed 소폭 편향, power→피격(slow/pushback/stun) 길이 경감 + 막힘감속 완화. 델타 작게. 엔진은 RaceConfig.characters[id]로 읽음(엔진 순수성 유지, data import 안 함).

## 7종 배정값 (정체성 기반, 합=6)
| 캐릭터 | speed | power | 근거 |
|---|---|---|---|
| 🐶 강아지 | 5 | 1 | 우다다 마스코트, 최고 순항·초반 폭주, 트래픽에 약함 |
| 🐱 고양이 | 4 | 2 | 날쌘 닷지형, 강아지보다 약간 단단 |
| 🐒 원숭이 | 3 | 3 | 장난·올라운드 중립 |
| 🦅 독수리 | 4 | 2 | 도박 박치기 — 빠르고 공격적(3/3 대신 4/2: 돌격 정체성) |
| 🐧 펭귄 | 2 | 4 | 뚱뚱·빙판 버티기, 잘 안 밀림 |
| 🐻 곰 | 1 | 5 | 탱크, 최저 순항·최고 저항 |
| 🦔 고슴도치 | 2 | 4 | 가시 방어, 느리지만 단단 |

## 수정/생성 파일
- `src/data/schema.ts` — CharacterData에 speed?/power? + 설명 주석.
- `src/data/characters/{dog,cat,monkey,eagle,penguin,bear,hedgehog}.ts` — 각 speed/power + 1줄 근거 주석. renderScale 뒤·skill 앞에 배치.
- `tests/unit/schema.test.ts` — 신규 테스트: 7종 모두 speed/power 정의됨, 1~5 정수, |합-6|≤1(반비례). 통과 확인.

## 검증
- 단위테스트 schema.test.ts 3/3 통과(신규 포함).
- typecheck: **내 파일(schema/characters/test) 에러 0**. 단, RaceEngine.ts에 `powerEffectScale` 미사용 에러 1건 — engine-dev WIP 배선분(내 변경 아님, 엔진 마무리 시 해소).

## engine-dev 인계
- 필드명 `speed`/`power`, 1~5 정수, 합≈6, 옵셔널+기본3 — 합의대로 적용 완료. 7종 배정값 위 표대로. 엔진 배선 마무리 + WIP typecheck 에러 정리 부탁. 최종 수치 미세조정은 balance-tuner.
- qa-verifier: schema.test.ts 갱신 완료(별도 갱신 불필요). 전체 typecheck/test는 engine 배선 완료 후 일괄 게이트.
