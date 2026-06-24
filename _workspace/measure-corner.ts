// THROWAWAY — propose per-animal straight/curve identity (cornering 1..5) and measure:
//   (a) fairness A: mean finish rank per char should be ~4.5 (speed+power neutralized, skills off)
//   (b) dynamism: lead changes per race (straight↔curve contrast should trade the lead)
// Run: npx vite-node _workspace/measure-corner.ts
import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog, defaultCharacterIds } from '../src/data/characters/index.ts';
import type { RaceConfig } from '../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();
const ROSTER = [...defaultCharacterIds];
const N = 600;
const LAPS = 3;

// Proposed straight/curve identity per animal (1 = 직선 스프린터 … 3 = 중립 … 5 = 곡선 장인)
const CORNER: Record<string, number> = {
  dog: 1,      // 우다다 직선 폭주
  penguin: 2,  // 배밀이 직진, 방향전환 둔함
  bear: 2,     // 묵직한 직진 차지, 코너 둔함 (정체성은 탱크 스킬)
  monkey: 3,   // 중립 올라운더
  alien: 3,    // 중립 (UFO 호버)
  fox: 4,      // 날렵한 급선회
  cat: 4,      // 민첩한 코너링
  hedgehog: 5, // 작은 몸으로 코너 최강
  spider: 5,   // 여러 다리로 코너 최강
};

// catalog with speed+power neutralized, cornering = proposed, skills off (cooldown ∞)
const chars: any = {};
for (const [id, c] of Object.entries(characterCatalog)) {
  const cc: any = { ...c, skill: { ...(c as any).skill, cooldownMs: [1e9, 1e9] } };
  delete cc.speed;
  delete cc.power;
  cc.cornering = CORNER[id] ?? 3;
  chars[id] = cc;
}

const rankSum: Record<string, number> = {};
const wins: Record<string, number> = {};
for (const cid of ROSTER) { rankSum[cid] = 0; wins[cid] = 0; }
let leadChangesTotal = 0;

for (let s = 0; s < N; s++) {
  // ROTATE roster→slot per seed so every char visits every start slot equally
  // (removes the start-slot confound; isolates the cornering effect).
  const rot = ROSTER.map((_, i) => ROSTER[(i + s) % ROSTER.length]);
  const parts = rot.map((cid, i) => ({ id: `p${i}`, name: `${cid}${i}`, characterId: cid }));
  const idToChar: Record<string, string> = Object.fromEntries(parts.map((p) => [p.id, p.characterId]));
  const cfg: RaceConfig = {
    participants: parts, characters: chars, seed: s, laps: LAPS, trackLength: 1000,
    modeId: 'individual', scoringId: 'individual', teamMode: false, relay: false,
  };
  const { frames, result } = simulateRace(cfg, skills, scoring);
  result.order.forEach((id, i) => { rankSum[idToChar[id]] += i; });
  wins[idToChar[result.order[0]]]++;
  // count lead changes (rank-1 holder switches)
  let prevLeader = '';
  for (const f of frames) {
    let bestId = '', bestProg = -1;
    for (const r of f.racers) if (r.progress > bestProg) { bestProg = r.progress; bestId = r.id; }
    if (bestId !== prevLeader && prevLeader !== '') leadChangesTotal++;
    prevLeader = bestId;
  }
}

console.log(`\n=== Proposed cornering identity — measured (${N} seeds, ${LAPS} laps, speed/power OFF, skills OFF) ===`);
console.log(`fair mean rank = 4.00 (9 racers, 0-indexed); fair win share = ${(100 / 9).toFixed(1)}%\n`);
console.log('char       cornering   meanRank   win%');
const rows = ROSTER.map((cid) => ({ cid, c: CORNER[cid], mr: rankSum[cid] / N, w: (wins[cid] / N) * 100 }))
  .sort((a, b) => a.c - b.c);
for (const r of rows) {
  console.log(`  ${r.cid.padEnd(9)} ${String(r.c).padStart(4)}      ${r.mr.toFixed(2).padStart(6)}   ${r.w.toFixed(1).padStart(5)}%`);
}
const mrs = rows.map((r) => r.mr);
console.log(`\nmean-rank spread: ${Math.min(...mrs).toFixed(2)} … ${Math.max(...mrs).toFixed(2)} (tight around 4.00 = fair)`);
console.log(`avg lead changes / race: ${(leadChangesTotal / N).toFixed(1)} (higher = more dynamic straight↔curve trading)`);
