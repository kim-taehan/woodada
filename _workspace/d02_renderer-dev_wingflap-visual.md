# d02 renderer-dev — 독수리 날개 펄럭임 + 측면 캐릭터 시각검증

## 작업 1: 독수리 날개 펄럭임 (구현 완료, 검증 대기)

### 변경 파일
- `src/renderer/character/PartsCharacter.ts` (glide 분기, ~L323-345)

### 구현 방식
기존 glide 분기의 날개는 `Math.sin(o.clock * 4.2) * 5`(±5도)로 거의 안 보이는 미세 떨림이었음.
이를 실제 펄럭임으로 교체:

```ts
if (name === 'wingL' || name === 'wingR') {
  const beat = o.clock * 3.4;
  const flap = Math.sin(beat) * 22 + Math.sin(beat * 2) * 4;
  rot += name === 'wingR' ? flap * 0.85 : flap;
}
```

- **주파수 3.4** (≈0.5Hz): 4.2 → 3.4로 낮춰 "떨림"이 아닌 우아한 박자. 너무 빠르지 않게.
- **진폭 ±22도** 메인 박자 + **±4도** 2배 하모닉(다운스트로크에 깃털 스냅감). 수십 도 단위.
- 회전 단위: 파트 `rot`은 **도(degree)** — `*DEG` 변환됨. `root.rotation`(라디안)과 구분 준수.
- **graceful no-op**: 날개 파트(wingL/wingR) 없는 다른 glide 캐릭이 생겨도 분기 자체가 안 타므로 안전.
- 글라이드 베이스(몸통 breathe, 다리 tuck, 전체 lift/tilt)는 그대로 유지 → "우아한 활공 + 부드러운 펄럭임".

### typecheck
통과 (`npm run typecheck` 클린).

## 작업 2: 시각검증 (통과)

### 포트 우회 (수행)
- 포트 5173은 다른 프로젝트(아웅다웅/aung-daung)가 점유 중 확인(`<title>아웅다웅…</title>`). playwright.config의 `reuseExistingServer:true`로 잘못된 앱 테스트 위험.
- woodada dev를 `--port 5190 --strictPort`로 띄우고(타이틀 "우다다 — 동물 경주 추첨" 확인), 임시 인레포 config `playwright.tmp5190.config.ts`(baseURL 5190, reuseExistingServer)로 우회 캡처.
- **정리 완료**: 임시 config·임시 spec·임시 스크린샷·dev 서버(5190) 모두 삭제/종료. `playwright.config.ts` 영구 변경 없음(git clean 확인).

### 캡처
- `npx playwright test race-visual.spec.ts --config=playwright.tmp5190.config.ts --project=desktop` → 5 tests pass, `tests/e2e/__screens__/race-*.png` 갱신.
- 날개 펄럭임은 단일 스틸로는 진동이 안 보임(flap은 frame.time 기반 `o.clock`으로 결정론적). 검증 위해 **임시 spec으로 같은 독수리를 인접 프레임(7프레임≈0.12s 간격) 연속 캡처** → 날개 각도가 프레임마다 달라지는지 확인 후 임시 산출물 삭제.

### 육안 소견 (어떤 샷에서 무엇을 봤나)
- **독수리 날개 펄럭임 — 통과**: 인접 프레임 시퀀스(eagle 크롭)에서 날개 회전각이 명확히 변함 — 한 프레임은 날개끝 아래-뒤로 처짐, 다음은 더 수평/스윕업. **부드러운 큰 스윙**(고주파 떨림 아님)으로 "우아한 활공 + 펄럭임" 읽힘.
- **독수리 또렷함 — 통과**: 측면에서 날카로운 부리·또렷한 눈·진갈색 날개/몸통 대비 선명, 발톱 tuck 보임. (race-mid)
- **개 — 통과**: 측면 치비, 큰 머리·동그란 눈·플로피 귀·달리는 다리, zoomies 글로우+✨ 또렷·귀여움. (race-mid)
- **고양이 — 통과**: 측면, 뾰족 귀·동그란 눈·회색 몸·세운 꼬리·갤럽 다리스윙 또렷, 시상대 1위 포즈 도도. (race-mid, result)
- **회귀 없음**: 고슴도치(start), 곰(roar "크아앙!!" 정상), 펭귄(busiest/result), 원숭이(mid), divebomb/roar/zoomies FX·실황자막·시상대 정상. result 독수리 승리 포즈(날개 위로) OK.

### typecheck
최종 `npm run typecheck` 클린.
