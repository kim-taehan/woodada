## 요약
거미·외계인 로스터 추가, 독수리 제거, 다수 폴리시/연출 패스. 에이전트 팀(engine·renderer·content·shell·balance)으로 조율, 전 영역 계약 유지.

## 캐릭터
- **거미(spider)** 추가 — `abduct`: 앞선 표적을 거미 등 뒤로 위치강등 + 거미줄 속박(감속). 단일표적 위치강등 역할.
- **외계인(alien)** 추가 — `mimic`: 가장 가까운 주자의 스킬을 카피해 발동하는 변수형 와일드카드.
- **독수리(eagle) 제거** — 전용 `divebomb` 스킬 함께 제거(외계인 mimic 안전 확인).
- **고양이** → 검은 날카로운 외형(샘플 3안 중 사용자 선택), **거미** → 밝은 파스텔(더 귀엽게).

## 엔진/렌더러
- **abduct reel-in**: 야크당한 타겟이 한 프레임 텔레포트 대신 ~250ms 거미줄에 끌려오는 화면 보간(렌더러 전용, 엔진 progress/결정론 불변).
- **abduct pullGap 90→14**: 표적을 거미 바로 뒤로 바짝.
- **저트래픽(1대1) 자리싸움**: 추격자가 근접 시 선두 레인으로 lean — 레인=속도 중립·결정론 불변 유지(engine-bias 통과).

## 셸/문서/밸런스
- 초기 화면 **참가자 기본 2명**, **기본 바퀴 1→5**.
- `character-guide.md` 능력치 중복(스피드/속도) 통일·수치 보류(밸런스 추후 일괄)·독수리 제거 반영.
- bear 미세 버프(engine-bias floor).

## 검증
- `npm run typecheck` ✅ / `npm run build` ✅ / 단위테스트 **51/51** ✅ (determinism·engine-bias 포함)
- 거미/고양이/abduct reel-in 렌더러 변경은 Playwright 캡처 육안 확인.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
