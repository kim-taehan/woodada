# h30 renderer-dev — 독수리 글라이드 중 다리 접기 (leg tuck in flight)

## 결과
측면 글라이드 독수리가 **비행(글라이드) 중에는 talon 다리를 몸 쪽으로 접도록** 추가. 정지/celebrate/reduced-motion 등 비행 아닐 때는 다리 정상(내려옴). divebomb lunge 무손상. typecheck 통과, 단위 44/44, Playwright(5191) 육안 확인.

## 변경 (src/renderer/character/PartsCharacter.ts — glide 로코모션 분기)
방금 만든 `else if (style === 'glide')` 안에 leg 처리 추가:
```
} else if (name === 'legL' || name === 'legR') {
  if (moving) {            // 비행 중에만 tuck (idle/start/celebrate/fall은 정상)
    dy -= 12;              // 발을 배 쪽으로 끌어올림
    rot += name === 'legL' ? -28 : -20;  // 뒤·위로 접음 (도 단위), 근측이 조금 더
  }
}
```
- **`moving` 게이트**가 핵심: 글라이드 분기는 style==='glide'면 정지에도 진입하므로, tuck은 `moving`(running/blocked/straying)일 때만. → 정지/celebrate(=moving 아님)·reduced-motion(=biped fallback) 시 다리 내려옴.
- divebomb: skill 포즈 델타가 다리를 안 건드리므로(head/body/wingL/tail만) tuck과 충돌 없음 — lunge 그대로, 다리만 접힘(나는 새 다이브로 자연스러움).
- 회전단위: rot=도. eagle/glide 한정, 타 캐릭터 무영향.

## 포트레이트
`docs/img/eagle.png` 재캡처(frame 60=비행) → 다리 접힌 비행 포즈로 갱신(이전엔 tuck 전 캡처라 다리 내려와 있었음). 비행 포트레이트라 접힌 게 맞음(230×200 유지).

## 시각검증 (Playwright 5191, 임시 캡처 후 삭제)
- **글라이드(f40/f440, 양 직선)**: talon이 몸 아래로 접혀 댕글링 제거 — 진짜 새 비행 실루엣. ✅
- **reduced-motion(정지/biped fallback)**: 다리 정상 내려와 섬. ✅
- **finish/celebrate(=moving 아님)**: 다리 내려와 깝침(💗). ✅
- **divebomb(seed1)**: 박치기 lunge + 임팩트 정상, tuck이 안 깸. self-botch 자막 정상. ✅
- 깨짐/회전단위 이상 없음, 타 캐릭터 무영향.

## 인계 (qa-verifier)
- typecheck OK / vitest 44/44 OK.
- 골든은 독수리 비행 다리접기 + 포트레이트로 갱신 필요(의도된 회귀). race-visual 골든 재생성은 여전히 포트 5173 타프로젝트 점유 환경이슈로 블록(내 변경 무관) — 깨끗한 포트에서 재생성 필요.
