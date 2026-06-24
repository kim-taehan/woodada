# h06 — engine-dev: bristle 같은-레인 조건 제거 (미발동 버그 수정)

## 버그

고슴도치 2마리 경주에서 bristle가 영영 미발동. 원인: candidates 필터의
`Math.abs(r.lane - self.lane) <= OVERTAKE.laneNear` (같은 레인 밴드) 조건.
추월은 *다른* 레인으로 위빙해 지나가는 모델이라, 둘이 각자 라인을 지키면
"같은 레인 뒤 추격자"가 절대 생기지 않아 스킬이 안 터졌다.

## 제거한 조건

`src/engine/skills/bristle.ts` candidates 필터에서:
- 제거: `Math.abs(r.lane - self.lane) <= OVERTAKE.laneNear`
- 남긴 조건: 뒤(`self.progress - r.progress > 0`) + range 내(`<= range`) + closing(`r.speed > self.speed`) + 팀/finished/waiting/stunned 제외.
- → "레인 무관, 뒤에서 따라붙는 가장 가까운 closing 추격자"를 대상.

부수 정리(고아/주석):
- `import { OVERTAKE } from '../overtake.ts'` 제거(더 안 쓰임). typecheck로 잔여 참조 0 확인.
- 헤더 주석의 "in the same lane band (|r.lane - self.lane| <= OVERTAKE.laneNear)" 줄 삭제 + "Lane is intentionally NOT checked: 위빙 추월 모델이라 같은-레인 요구 시 영영 미발동" 설명 추가.

불변(요구대로): triggerChance 게이트, 2단 hold 패턴(추격자 없음 / 굴림 실패 → 무emit return), pushBack/slow/recoil 효과, variant(activate/hit/dodge), 결정론(rng는 추격자 있을 때만). 새 variant 없음.

## 밸런스 영향 & 재수렴 (hedgehog params만 조정)

발동 빈도가 크게 올라 고슴도치가 과해짐 → 팀리드 지시대로 **hedgehog.ts skill.params만** 소폭 하향(엔진 로직·다른 캐릭터 불변).

수정 직후(레인 조건만 제거, params 그대로):
```
dog 0.132 cat 0.123 monkey 0.115 eagle 0.119 bear 0.101 penguin 0.129 hedgehog 0.280
```
→ 고슴도치 0.166 → **0.280** (공정선+5%p≈0.193 초과). 다른 캐릭 floor 근접(bear 0.101).

조정: `triggerChance 0.45 → 0.30`, `recoilBurst 0.4 → 0.18` (자기전진 레버를 주로 깎음; pushBack/slow=타인 방해는 유지). recoilBurst가 발동 빈도↑ 상황의 주 승률 동인이라 절반 이하로.

조정 후(N=3000):
```
dog 0.154 cat 0.150 monkey 0.140 eagle 0.148 bear 0.125 penguin 0.155 hedgehog 0.128
```
- 7종 0.125~0.155 = 1/7≈0.143 기준 **±3%p 이내**(±5%p 목표 안). 고슴도치 0.128 — floor 위, 과독주 없음.
- 독주 지표: lead changes 9.7, winner led 0.502, peak gap 0.073laps — 건전 범위 유지(>0.45 독주 없음).

조정한 param: hedgehog.ts `triggerChance 0.30`, `recoilBurst 0.18` (나머지 그대로: range 40, pushBack 10, slowMs 600, slowMul 0.6, recoilMs 500, cooldown [1500,2500]).

## 검증

- `npm run typecheck`: 통과(OVERTAKE 잔여 참조 없음 확인).
- `npx vitest run`: **43/43 통과** (engine-bias floor/ceiling 포함, determinism green).

## 잔여(엔진 무관)

- TEAM rank-sum/RELAY 분포는 개인전과 별개(레인픽스 직후 team에서 고슴도치 0.326까지 튀었음; params 하향 후 재측정은 개인전 위주로 했다). 팀/릴레이 정밀 수렴은 balance-tuner 영역.
- content-designer가 고슴도치를 gallop 측면으로 재설계 중 — 본 엔진 수정과 다른 파일(partmodel/visualType)이라 충돌 없음.
