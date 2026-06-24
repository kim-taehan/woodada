# h32 renderer-dev — 독수리 날개 펄럭임 강화 (우아한 활공 + 간헐 펄럭)

## 결과
glide 분기의 wingL 펄럭임을 **간헐 펄럭(intermittent flap)**으로 개선 — 대부분 활공(날개 거의 정지)하다 주기적으로 몇 번 퍼덕. content-designer가 wingL pivot을 어깨 `{-4,44}`로 옮겨둬서 큰 진폭도 자연스럽게 휨. typecheck 통과, 단위 49/49, Playwright(5191) 근접 캡처 육안 확인.

## 변경 (src/renderer/character/PartsCharacter.ts — glide 분기 wingL)
이전엔 상시 소프트 플랩(rate 3.4, 22° 연속)이었음. content-designer 메시지의 base 라인(sin*4.2*5)은 이미 그 전에 업그레이드돼 있던 상태. 이번엔 "간헐" 뉘앙스 추가:
```
const beat = o.clock * 6.0;                          // 버스트 중 플랩 비트
const env  = Math.max(0, Math.sin(o.clock*0.9 - 1)); // 활공 중 0, 버스트 시 상승 (게이트)
const flap = (sin(beat)*26 + sin(beat*2)*5) * env;   // 게이트된 플랩 + 윙팁 하모닉
const glideSway = sin(o.clock*2.2)*3;                // 버스트 사이 잔잔한 hold
rot += (wingR ? (flap+glideSway)*0.85 : flap+glideSway);
```
- env(주기 ~7s)가 플랩을 on/off 게이트 → 떨림 아닌 "홀드→퍼덕→홀드". 사이엔 ±3° 잔류 sway로 살아있게.
- 어깨 pivot이라 26° 진폭이 깔끔히 휨(detach/clip 없음). rot=도 단위.
- wingR은 eagle엔 없음(content-designer 확인) — 미래 glide 캐릭 대비 graceful no-op로만 유지.
- skill/win/fall 날개 델타(-16/-22/+24°)는 같은 어깨 축, 계약 유지(데이터 영향 0).

## 시각검증 (Playwright 5191 근접클립, 임시 캡처 후 삭제)
- f30: 날개 홀드(활공) — 몸에 가깝게 접힘. ✅
- f75: 날개 들림(플랩 버스트) — 어깨 축으로 위로 펼침. ✅
- f90: 다시 settling back. ✅
→ env 게이트로 활공↔플랩이 또렷이 교번, 상시 떨림 아님. 어깨 pivot 자연스러움. 다리 tuck(이전 작업)·틸트·float 정상 공존. 깨짐 없음.

## 인계 (qa-verifier)
- typecheck OK / vitest 49/49 OK.
- display-only, eagle/glide 한정, 타 캐릭터 무영향.
- 골든은 독수리 날개 위상 변화로 갱신될 수 있음(의도된 회귀). 풀트랙 e2e는 캐릭터가 작아 미세 위상 차는 미미.
