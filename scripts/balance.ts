import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog } from '../src/data/characters/index.ts';
import type { RaceConfig } from '../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();
const ids = ['dog', 'cat', 'monkey', 'eagle', 'bear', 'dog', 'cat', 'monkey', 'eagle', 'bear'];

function cfg(seed: number): RaceConfig {
  return {
    participants: ids.map((cid, i) => ({ id: `p${i}`, name: `${cid}${i}`, characterId: cid })),
    characters: characterCatalog,
    seed,
    laps: 1,
    trackLength: 1000,
    modeId: 'individual',
    scoringId: 'individual',
    teamMode: false,
    relay: false,
  };
}

const N = 3000;
const wins: Record<string, number> = { dog: 0, cat: 0, monkey: 0, eagle: 0, bear: 0 };
const slot = new Array(ids.length).fill(0);
let leadChanges = 0;
for (let s = 0; s < N; s++) {
  const { frames, result } = simulateRace(cfg(s), skills, scoring);
  wins[ids[Number(result.order[0].slice(1))]]++;
  slot[Number(result.order[0].slice(1))]++;
  // count how often the front-runner changes (drama proxy)
  let leader = '';
  for (const f of frames) {
    const front = [...f.racers].sort((a, b) => b.progress - a.progress)[0].id;
    if (front !== leader) { leadChanges++; leader = front; }
  }
}
console.log('win rate:', Object.fromEntries(Object.entries(wins).map(([k, v]) => [k, (v / N).toFixed(3)])));
console.log('slot wins:', slot.map((v) => (v / N).toFixed(3)).join(' '));
console.log('avg lead changes/race:', (leadChanges / N).toFixed(1));
