// THROWAWAY — measure win rate by START SLOT (with the opening lane-hold). Diagnoses how much the
// outer slots are disadvantaged (need an athletics-style stagger to compensate).
// Run: npx vite-node _workspace/measure-slot.ts
import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog, defaultCharacterIds } from '../src/data/characters/index.ts';
import type { RaceConfig } from '../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();
const ROSTER = [...defaultCharacterIds, ...defaultCharacterIds]; // 18 (match engine-bias field)
const N = 1500;
const LAPS = 1;

// Match the engine-bias test exactly: fixed 18-racer order (no rotation), measure win by slot index.
const slotWins = new Array(ROSTER.length).fill(0);
for (let s = 0; s < N; s++) {
  const parts = ROSTER.map((cid, i) => ({ id: `p${i}`, name: `${cid}${i}`, characterId: cid }));
  const cfg: RaceConfig = {
    participants: parts, characters: characterCatalog, seed: s, laps: LAPS, trackLength: 1000,
    modeId: 'individual', scoringId: 'individual', teamMode: false, relay: false,
  };
  const winner = simulateRace(cfg, skills, scoring).result.order[0]; // p{slot}
  const slot = Number(winner.slice(1));
  slotWins[slot]++;
}

const fair = N / ROSTER.length;
console.log(`\n=== Win rate by START SLOT (${N} seeds, ${LAPS} lap, opening lane-hold ON) ===`);
console.log(`fair = ${(100 / ROSTER.length).toFixed(1)}% each; slot 0 = innermost … ${ROSTER.length - 1} = outermost\n`);
slotWins.forEach((w, i) => {
  const pct = (w / N) * 100;
  const bar = '█'.repeat(Math.round(pct));
  console.log(`  slot ${i}  ${pct.toFixed(1).padStart(5)}%  ${bar}`);
});
const pcts = slotWins.map((w) => (w / N) * 100);
console.log(`\nspread: inner slot0=${pcts[0].toFixed(1)}%  …  outer slot${ROSTER.length - 1}=${pcts[ROSTER.length - 1].toFixed(1)}%  (fair=${(100 / ROSTER.length).toFixed(1)}%)`);
