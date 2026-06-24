# fx01 — illusionClone 엔진 구현 설계 (engine-dev)

브랜치: feature/fox-illusion · 담당: eng-fox · 대상: src/engine/ 만

> **상태: 구현 완료.** typecheck(src 0 에러) + 단위테스트 62/62 PASS(engine-bias 포함).
> 런타임 검증: clone/clonehit/clonepop/teleport 전 경로 발동, 결정론 동일, 미믹 복사 0건.
> 변경 파일: types.ts, skills/types.ts, skills/illusionClone.ts, skills/index.ts(1줄 등록),
> RaceEngine.ts, skills/{banana,abduct,roar,bristle}.ts(각 1줄 decoy guard).
> 구현이 §아래 설계와 일치. (DecoyState에 `offset` 필드 추가해 매 프레임 본체에 재앵커 — 드리프트 없음.)

## 1. 단계1 (롤백) — 완료
- `src/engine/skills/registry.ts`, `index.ts`를 `git show main:` 기준 복구.
- index.ts에 illusionClone 1줄 외과 등록: import + `r.register('illusionClone', illusionCloneHandler)`.
- 병렬 레지스트리 재작성(skillRegistry 객체/createDefaultSkillRegistry 깨진 버전) 전부 제거.
- 검증: determinism/relay/deathmatch/schema/skills PASS, 코어 35개 회귀 복구.

## 2. 데코이(분신) 데이터 모델

엔진 순수성 유지. 분신은 **레이서가 아니다** → RacerState 리스트에 절대 안 들어감. 순위/스코어링/추월/catchup/아이템/relay/deathmatch 어디에도 미참여.

### types.ts 신규 타입
```ts
export interface DecoyState {
  id: string;          // `decoy:<ownerId>:<n>`
  ownerId: RacerId;    // 본체(구미호)
  progress: number;    // 본체 progress + offset (앞:+, 뒤:-)
  lane: number;        // 본체 lane (살짝 흩뿌림)
  spawnedAt: number;   // 발동 프레임
  expireFrame: number; // spawnedAt + cloneDuration 프레임
  lead: boolean;       // 앞 분신(텔레포트 기준점)인지
  alive: boolean;      // 충돌/흡수로 소멸하면 false
}
```
- EngineFrame에 `decoys: DecoyState[]` 필드 추가 → 렌더러가 그림(아래 §6 계약).

### RaceEngine Internals
```ts
decoys: DecoyState[];      // 살아있는 데코이 전체(소유자 무관, 동시 다수 가능)
decoyCounter: number;
```

## 3. 마디 → progress 매핑 (확정)
- **1 마디 = 8 progress units** (trackLength=1000 기준; 인접~몇 칸 간격감. 스파이더 pullGap 14="바로 뒤"보다 약간 촘촘).
- 분신 앞/뒤 오프셋 = rng 1~3 마디 → {8, 16, 24} 중 택1, 각 분신 독립.
- 텔레포트 강도 = **선두(앞) 분신의 실제 위치**(= 본체+1~3마디). 별도 거리값 안 씀.
  → fox.ts의 `teleportRange:10`은 미사용. content-designer가 정리.

## 4. 발동 (illusionClone.ts 핸들러)
- self-activation tick. 쿨다운 게이트는 엔진(fireSkill)이 관리.
- 이미 살아있는 자기 분신이 있으면 **재발동 안 함**(emit 안 함 → RETRY 쿨다운). 한 번에 분신 세트 1개만.
- rng = `ctx.rng`(엔진이 이미 `skill:fox` 서브스트림으로 fork해 줌). 추가 격리 필요시 `ctx.rng.fork('illusionClone')`.
- 앞/뒤 오프셋을 rng로 뽑아 `ctx.spawnDecoys([{offsetMadi, lead}, ...])` 컨텍스트 메서드로 엔진에 데코이 생성 요청.
- emit `{ variant:'activate', line }` + 분신 생성 마릿수만큼 위치정보 노출용 이벤트(아래 §6).

## 5. 엔진 루프 통합 (RaceEngine.ts)
매 프레임:
1. **데코이 이동**: 살아있는 데코이는 본체와 동일 패턴(본체 speed)으로 progress 전진. 본체 소멸/finished면 데코이도 즉시 소멸. 스킬 발동 안 함.
2. **만료**: `frame >= expireFrame`이면 만료 처리 → §5.4 텔레포트 판정 후 전 분신 소멸.
3. **충돌 스턴**: 살아있는 데코이가 다른 레이서(소유자 제외, 팀 무관·개인전)와 progress 근접(|Δprog|<COLLIDE_DIST) + lane 근접이면 그 레이서 0.5초 스턴.
   - 스턴 적용 = banana와 동일 경로(phase='stunned', effectUntil). star/skillInvuln 면역은 존중.
   - 충돌 레이서에게 `variant:'clonehit'` emit(racerId=충돌레이서, line="어?"). 충돌한 데코이는 소멸(alive=false).
   - 같은 데코이가 같은 레이서를 매 프레임 재충돌 못 하게: 데코이는 1회 충돌 후 소멸하므로 자연 방지.
4. **만료 텔레포트**: expire 시 lead(앞) 분신이 살아있고 `leadDecoy.progress > 본체.progress`면 본체를 그 위치로 순간이동(`self.progress = leadDecoy.progress`). 소소한 전진기 — 부풀리지 않음.
   - emit `variant:'teleport'`(racerId=본체, line="스르르…퐁!"). 이후 해당 owner의 전 분신 즉시 소멸.

### 통합 지점
- `step()`에서 advance 루프 **뒤**(본체 progress 확정 후) 데코이 갱신·충돌·만료 처리 블록 1개 추가.
- 결정론: 데코이 처리 순서는 `decoys` 배열 순서(생성 순). 충돌 대상 레이서 순회는 procKey 안정 정렬. RNG는 발동 시 오프셋 뽑을 때만(서브스트림), 충돌/만료엔 RNG 없음.

## 6. 방해 흡수(방어) — 데코이 가드
disruption 핸들러(banana/abduct/roar/bristle)가 타겟을 구미호로 정했을 때, 구미호에게 살아있는 데코이가 있으면 분신이 대신 맞고 소멸, 본체 안전.

- 최소 침습: SkillContext에 `tryDecoyGuard(target): boolean` 추가(기존 `tryDodge` 패턴과 동형).
- 각 disruption 핸들러에 **1줄** 추가: star/skillInvuln 체크 라인 다음에
  `if (ctx.tryDecoyGuard(target)) { ctx.emit({variant:'dodge', targetId:target.id}); return; }`
- 엔진 구현: target에게 살아있는 데코이가 있으면 가장 가까운 1마리 소멸(alive=false) + `variant:'clonepop'` emit(line="퐁!") → true. 없으면 false.
- 분신 2마리 = 2회 방어(각 1마리씩 소비). roar는 다대상이라 구미호 타겟에만 1회 소비.

## 7. 미믹 복사 금지
- 사용자 결정(번복 최종): 외계인 mimic은 illusionClone **복사 불가**.
- 구현: fireSkill의 `invokeSkill`/`canCopySkill`에서 `copiedType === 'illusionClone'`를 'mimic'과 동일하게 거부.
  (또는 illusionClone에 reaction-only 표식 없이, 레지스트리 레벨에서 예외 1줄.)
- skills.test.ts의 mimic-복사-가능 집합에서 illusionClone 제외 기대치는 **co-fox가 반영**.

## 8. 렌더러 계약 (renderer-dev 후속 소비)
- **EngineFrame.decoys: DecoyState[]** — 매 프레임 살아있는 분신 위치(progress/lane/lead/alive). 렌더러가 본체와 같은 치비로 반투명 그림.
- **SkillEvent.variant 신규**: `'clone'`(분신 생성, racerId=본체), `'clonehit'`(분신이 레이서 충돌→스턴, racerId=피해레이서, line="어?"), `'clonepop'`(방해 흡수 소멸, line="퐁!"), `'teleport'`(만료 텔레포트, racerId=본체, line="스르르…퐁!").
- 렌더러는 decoys로 위치를, 이벤트로 연출(생성 연기/충돌 별/흡수 퐁/텔레포트 연기+별)을 트리거.

## 9. content-designer(co-fox) 통지 사항
- illusionClone skill id, self-activation=true, mimic 복사 금지.
- 1마디=8units. fox.ts params 권장: `cloneCount:2, cloneDuration:3000, collisionStun:500, marchUnit:8, cloneOffsetMadiMin:1, cloneOffsetMadiMax:3`. `teleportRange` 제거 가능(미사용).
