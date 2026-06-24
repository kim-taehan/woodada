# fx02 content-designer — 구미호(fox) 측면 재디자인 메모

## 완료 내역

### 1. 파츠모델 측면 재디자인 (`src/data/partmodels/fox.ts`)
기존: 정면 기준, 포즈 델타 전부 빈 객체 `{}`
변경: **측면(side-view)** 구조로 완전 재작성. dog.ts 구조를 참고하되 구미호 고유 요소 반영.

**구조:**
- 꼬리 9개(tail1~tail9): 뒷부분에서 팬 형태로 퍼짐. z=0(bottom, tail9) ~ z=8(top, tail1). 각각 흰 꼬리끝 포함.
- 원거리 다리 2개(legR, frontLegR): z=9, FARLEG색(#E07830, 약간 어둡게)
- body: z=10, 주황 몸통 + 금색 가슴 마킹(BELLY=#FFD166)
- 근거리 다리 2개(legL, frontLegL): z=11, base색 + 금색 발끝
- earL: z=12, 위로 뾰족한 여우 귀 + 내부 point색 라인
- head: z=13, 둥근 치비 머리 + 긴 주둥이 + 교활한 가는 눈(사선 경사)

**포즈 델타:**
- `run`: 다리 앞뒤 교차(±20~28도), 꼬리 9개 모두 점층적 스윙, 귀 뒤로 눕힘, 머리 앞으로
- `skill`: 머리 비틀기(-8도), 꼬리 활짝 부채 펼침(tail1: -30 ~ tail9: +40, 약 70도 범위)
- `win`: 머리 들기(dy: -8), 꼬리 승리 팬(tail1: -28 ~ tail9: +42)
- `fall`: 머리 앞 기울기(rot: +20), 꼬리 처짐(tail1: +22 ~ tail9: -12)

**회전 단위:** 모든 포즈 델타의 `rot`는 도(degree). 스윙 진폭 수십 도 단위로 시각적으로 확인 가능.

**팔레트 참조:**
- `base` → #FF8C42 (주황 몸통)
- `point` → #FFD166 (금색 귀 안쪽)
- `outline` → #8B4513 (갈색 윤곽)
- `cheek` → #FF6B6B (볼터치)

### 2. 등록 보완
- `SetupScreen.ts` CHAR_LABEL: `fox: '🦊'` 추가 완료
  - 기존 `eagle: '🦅'` 엔트리 무관한 죽은 코드로 확인 — 삭제하지 않고 보고만 함
- `main.ts` DEFAULT_IDS: `'fox'` 추가 완료
- `characters/index.ts`, `partmodels/index.ts`: 이미 등록되어 있음 확인

### 3. 테스트 갱신
- `schema.test.ts` KNOWN_SKILL_TYPES: `'illusionClone'` 추가 완료
- `schema.test.ts` active characters 목록: `'fox'` 추가 완료 (알파벳 순 정렬)
- `skills.test.ts`: illusionClone self-activation 여부 및 mimic 복사 가능 여부 engine-dev(eng-fox) 확인 대기 중 — 응답 후 갱신 예정

### 4. fox.ts params 검토
- `teleportRange: 10` — engine 매핑 기준 대기 중 (eng-fox에 문의 발송)
- `cloneDuration: 3000`, `collisionStun: 500` — 스펙 기술 범위 내로 현 값 유지

---

## renderer-dev 인계 메모 (분신 외형)

**파일:** `src/data/partmodels/fox.ts`

**파츠 구조 특이사항:**
- 파츠 단위로 `z` 값이 있고, 각 파트는 독립적인 shape 배열만 가짐 (알파 채널 독립 적용 가능)
- 반투명 렌더 시 파트 단위로 `alpha` 속성을 적용해도 레이어 순서에 문제 없음
- 꼬리 9개가 독립 파트이므로 분신에 `alpha: 0.4` 정도의 반투명을 파트별로 적용하면 유령 실루엣 표현 가능

**분신 표현 제안 (사용자 요청 기반):**
- 스펙 원안 "외형 완전 동일"과 달리, **반투명 고스트** 방식으로 결정됨
- 본체: 기본 alpha=1.0
- 분신: 전체 alpha ~0.35~0.45 (비치는 유령), 동일 파츠모델 재사용
- PixiJS v8: `container.alpha` 로 컨테이너 전체에 일괄 적용 가능 (파트별 alpha 루프 불필요)
- 분신이 충돌 시 소멸 연출: alpha 0.4 → 0으로 fade out + 파티클 폭발 추천
