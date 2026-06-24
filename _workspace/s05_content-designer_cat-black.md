# s05 content-designer — 검은 날카로운 고양이 (3안 검토)

**작업 방식:** 단일 확정이 아니라 "샘플 3개 → 사용자 검토". 기능/스킬(catwalk)/엔진/밸런스 무수정, `src/data/characters/cat.ts`(palette)와 `src/data/partmodels/cat.ts`(파츠) 외형만 변경.

## 파츠 변경점 (3안 공통)
기존 회색 타비 → 날카로운 검은 고양이 실루엣으로 재구성. 3안 모두 동일한 파츠 구조를 쓰고 **팔레트 + 파츠모델 상단 상수 블록(EYE/RIM/FARLEG/PUPIL/HI/INNER_EAR)** 만 다르다.
- 귀: 더 길고 뾰족한 삼각귀(끝점 y -60→-64), 핑크 inner 제거 → 어두운 inner + 리딩엣지 림라이트.
- 눈: 둥근 멍한 눈 → **가늘게 좁힌 아몬드 눈 + 세로 슬릿 동공 + 아래로 꺾인 무거운 윗꺼풀**(매서운 인상). 핑크 볼터치 제거.
- 실루엣 가독성: 검은 몸이 붉은 트랙에 묻히지 않게 **등선/이마/귀에 림라이트 스트로크** 추가. 수염도 outline 대신 RIM 색으로.
- 코: 작은 하트 코 유지(nose 슬롯). 스트라이프는 흐릿하게.
- 회전 단위 함정 무관(파츠 rot 미변경). 포즈 델타(catwalk/win/fall) 그대로.

## 3안 비교표

| | 컨셉 | base | point | outline | EYE(눈) | RIM(림라이트) | 특징 |
|---|---|---|---|---|---|---|---|
| **샘플1** | 순수 블랙 + 매서운 노란눈 | `#1C1E24` | `#34373F` | `#0C0D11` | `#F5C518`(앰버옐로) | `#3A3F49`(은은한 다크) | 가장 검고 강렬. 노란 슬릿눈이 또렷. 정통 "검은 사나운 고양이". |
| **샘플2** | 차콜 + 실버 슬릭 | `#363C47` | `#4E5663` | `#1B1E25` | `#7FE3D6`(쿨 틸) | `#AEB9C8`(밝은 실버) | 약간 밝은 차콜 + 강한 은빛 윤곽선. 차갑고 슬릭한 느낌, 눈도 시원한 청록. |
| **샘플3** | 블랙 + 네온 시안 포인트 | `#1A1D24` | `#2C313B` | `#0A0C10` | `#23F0E0`(네온 시안) | `#23F0E0`(네온 시안) | 검은 몸 + 단일 네온 시안 포인트(눈·림·inner귀). 쿨/테키한 read. nose/stripe도 시안 계열. |

(샘플2/3 보조 상수 — 샘플2: FARLEG `#252A33`, PUPIL `#13161B`, HI `#FFFFFF`. 샘플3: FARLEG `#15171C`, PUPIL `#0A0C10`, HI `#CFFFFA`, INNER_EAR `#1C7E78`. 전체 값은 파츠/캐릭터 파일 주석에 기록.)

## 캡처 경로 (Read 육안 확인 완료)
- before(원래 회색): `_workspace/shots/cat-before-mid-crop.png`
- **샘플1**: `_workspace/shots/cat-sample-1.png` (= cat-sample1-mid-crop.png)
- **샘플2**: `_workspace/shots/cat-sample-2.png` (= cat-sample2-mid-crop.png)
- **샘플3**: `_workspace/shots/cat-sample-3.png` (= cat-sample3-mid-crop.png)
- 각 샘플 start/skill 프레임도 `cat-sampleN-*` 로 존재. 캡처 seed=7, 로스터 `[cat,dog,monkey]`.

## 육안 결과
- 3안 모두 검은 몸이 붉은 트랙 위에서 림라이트·또렷한 눈 덕분에 **묻히지 않고** 형태가 읽힌다. 파츠 깨짐/누락 없음.
- 샘플1: 가장 "사납고 또렷". 샘플2: "쿨·슬릭". 샘플3: "네온·테키". 서로 뚜렷이 구분됨.
- 치비 베이비 스키마(큰 머리·큰 눈)는 유지하되 날카로움(뾰족귀·슬릿눈·꺾인 꺼풀)을 얹음.

## 최종 확정 (사용자 선택: 샘플1)
- **샘플1(순수 블랙 + 앰버 노란눈)** 으로 확정. `cat.ts` 팔레트 + `partmodels/cat.ts` 상수 블록을 샘플1 값으로 고정, 샘플2/3 주석 제거(깔끔화).
- 미사용 상수 없음(FARLEG/EYE/PUPIL/RIM/HI/INNER_EAR 전부 shapes에서 사용).
- 임시 캡처 스펙 삭제(`cat-black-tmp.spec.ts`, `cat-final-tmp.spec.ts`). 트리에 잔여 spec 없음.
- `npm run typecheck` 통과(cat 관련 에러 0).
- 최종 적용 캡처: `_workspace/shots/cat-final-crop.png` (Read 육안 확인 — 샘플1 정상 적용).
