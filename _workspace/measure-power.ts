// THROWAWAY measurement — does `power` (esp. the traffic/blockDecel "몸싸움") matter?
// Run: npx vite-node _workspace/measure-power.ts
import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog, defaultCharacterIds } from '../src/data/characters/index.ts';
import type { RaceConfig } from '../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();
const ROSTER = [...defaultCharacterIds]; // 8: dog cat monkey bear penguin hedgehog spider alien
const N = 400;
const LAPS = 3;

const parts = ROSTER.map((cid, i) => ({ id: `p${i}`, name: `${cid}${i}`, characterId: cid }));
const idToChar: Record<string, string> = Object.fromEntries(parts.map((p) => [p.id, p.characterId]));

function cfg(chars: RaceConfig['characters'], seed: number): RaceConfig {
  return {
    participants: parts, characters: chars, seed, laps: LAPS, trackLength: 1000,
    modeId: 'individual', scoringId: 'individual', teamMode: false, relay: false,
  };
}

// Clone the catalog with optional transforms.
function clone(opts: { neutralPower?: boolean; noSkills?: boolean } = {}) {
  const out: Record<string, any> = {};
  for (const [id, c] of Object.entries(characterCatalog)) {
    let cc: any = { ...c };
    if (opts.neutralPower) delete cc.power; // undefined → statDev neutral (3)
    if (opts.noSkills) cc = { ...cc, skill: { ...cc.skill, cooldownMs: [1e9, 1e9] } };
    out[id] = cc;
  }
  return out as RaceConfig['characters'];
}

// ---- Exp 1: how often does the blockDecel ("몸싸움") engage? (real game) -----
let blocked = 0, total = 0;
const perChar: Record<string, { blocked: number; total: number }> = {};
for (const cid of ROSTER) perChar[cid] = { blocked: 0, total: 0 };
for (let s = 0; s < N; s++) {
  const { frames } = simulateRace(cfg(characterCatalog, s), skills, scoring);
  for (const f of frames) for (const r of f.racers) {
    total++;
    const cc = idToChar[r.id];
    perChar[cc].total++;
    if ((r as any).phase === 'blocked') { blocked++; perChar[cc].blocked++; }
  }
}
console.log(`\n=== Exp1: blocked-phase frequency (real game, skills ON, ${LAPS} laps, ${N} seeds) ===`);
console.log(`overall blocked frames: ${((blocked / total) * 100).toFixed(2)}%`);
console.log('per-character blocked% (power):');
for (const cid of ROSTER) {
  const pc = perChar[cid];
  const pw = (characterCatalog as any)[cid].power ?? 3;
  console.log(`  ${cid.padEnd(9)} ${((pc.blocked / pc.total) * 100).toFixed(2).padStart(6)}%   power=${pw}`);
}

// ---- finish-order comparison helper -----------------------------------------
function compareOrders(charsA: RaceConfig['characters'], charsB: RaceConfig['characters']) {
  let sameOrder = 0, rankShiftSum = 0, comparisons = 0;
  for (let s = 0; s < N; s++) {
    const a = simulateRace(cfg(charsA, s), skills, scoring).result.order;
    const b = simulateRace(cfg(charsB, s), skills, scoring).result.order;
    if (a.join(',') === b.join(',')) sameOrder++;
    const rankB: Record<string, number> = {};
    b.forEach((id, i) => (rankB[id] = i));
    a.forEach((id, i) => { rankShiftSum += Math.abs(i - rankB[id]); comparisons++; });
  }
  return { samePct: (sameOrder / N) * 100, avgRankShift: rankShiftSum / comparisons };
}

// ---- Exp 2: ISOLATE traffic — skills OFF, real power vs neutral power --------
const offReal = clone({ noSkills: true });
const offNeut = clone({ noSkills: true, neutralPower: true });
const e2 = compareOrders(offReal, offNeut);
console.log(`\n=== Exp2: traffic role ISOLATED (skills OFF) — real power vs neutral ===`);
console.log(`identical finish order: ${e2.samePct.toFixed(1)}% of races`);
console.log(`avg |rank shift| per racer: ${e2.avgRankShift.toFixed(3)} (0 = power changes nothing)`);

// ---- Exp 4: SYSTEMATIC advantage — per-char mean finish rank (0=always 1st) --
// Chaos reshuffles order from ANY perturbation; the real question is whether high
// power makes a character finish *systematically better*. Compare mean rank.
function meanRanks(chars: RaceConfig['characters']) {
  const sum: Record<string, number> = {};
  for (const cid of ROSTER) sum[cid] = 0;
  for (let s = 0; s < N; s++) {
    const order = simulateRace(cfg(chars, s), skills, scoring).result.order;
    order.forEach((id, i) => (sum[idToChar[id]] += i));
  }
  const out: Record<string, number> = {};
  for (const cid of ROSTER) out[cid] = sum[cid] / N;
  return out;
}
const mrReal = meanRanks(offReal);
const mrNeut = meanRanks(offNeut);
console.log(`\n=== Exp4: systematic advantage (skills OFF) — mean finish rank, real vs neutral power ===`);
console.log(`(lower = finishes better; delta<0 means power HELPS that char)`);
for (const cid of ROSTER) {
  const pw = (characterCatalog as any)[cid].power ?? 3;
  const d = mrReal[cid] - mrNeut[cid];
  console.log(`  ${cid.padEnd(9)} real=${mrReal[cid].toFixed(2)} neutral=${mrNeut[cid].toFixed(2)} delta=${d >= 0 ? '+' : ''}${d.toFixed(2)}  power=${pw}`);
}

// ---- Exp 3: TOTAL power impact — skills ON, real vs neutral ------------------
const onNeut = clone({ neutralPower: true });
const e3 = compareOrders(characterCatalog, onNeut);
console.log(`\n=== Exp3: TOTAL power impact (skills ON) — real vs neutral ===`);
console.log(`identical finish order: ${e3.samePct.toFixed(1)}% of races`);
console.log(`avg |rank shift| per racer: ${e3.avgRankShift.toFixed(3)}`);

// Baseline scale: how different are two different SEEDS (max possible shift ~ N/2)?
console.log(`\n(ref) 8 racers → a totally random reshuffle averages ~2.6 rank shift; 0 = no effect.`);
