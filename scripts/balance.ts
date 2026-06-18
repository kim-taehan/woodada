import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog, defaultCharacterIds } from '../src/data/characters/index.ts';
import type { RaceConfig, RaceParticipant } from '../src/engine/types.ts';

// Balance harness — pure (seeded Rng), deterministic. Measures whether any
// character or composition over-dominates across the three game modes:
// individual / team (rank-sum) / relay (leg-cycle). Goal is NOT parity; it is
// "nobody runs away" — every roster slot can win, none dominates.

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

const ROSTER = [...defaultCharacterIds]; // 6: dog cat monkey eagle bear penguin
const N = 3000;

function participants(ids: string[], teamIds?: (string | undefined)[]): RaceParticipant[] {
  return ids.map((cid, i) => ({ id: `p${i}`, name: `${cid}${i}`, characterId: cid, teamId: teamIds?.[i] }));
}

function baseCfg(over: Partial<RaceConfig> & { participants: RaceParticipant[] }): RaceConfig {
  return {
    characters: characterCatalog,
    seed: 0,
    laps: 1,
    trackLength: 1000,
    modeId: 'individual',
    scoringId: 'individual',
    teamMode: false,
    relay: false,
    ...over,
  };
}

const pct = (v: number, d = N) => (v / d).toFixed(3);
function rateRow(wins: Record<string, number>, keys: string[], d = N): string {
  return keys.map((k) => `${k} ${pct(wins[k] ?? 0, d)}`).join('  ');
}

// ---------------------------------------------------------------------------
// 1) INDIVIDUAL — 6 chars ×2 = 12 racers. Per-character win rate.
// ---------------------------------------------------------------------------
function individual() {
  const ids = [...ROSTER, ...ROSTER];
  const wins: Record<string, number> = Object.fromEntries(ROSTER.map((c) => [c, 0]));
  const slot = new Array(ids.length).fill(0);
  let leadChanges = 0;
  for (let s = 0; s < N; s++) {
    const cfg = baseCfg({ participants: participants(ids), seed: s });
    const { frames, result } = simulateRace(cfg, skills, scoring);
    wins[ids[Number(result.order[0].slice(1))]]++;
    slot[Number(result.order[0].slice(1))]++;
    let leader = '';
    for (const f of frames) {
      const front = [...f.racers].sort((a, b) => b.progress - a.progress)[0].id;
      if (front !== leader) { leadChanges++; leader = front; }
    }
  }
  console.log('=== INDIVIDUAL (6 chars ×2, N=' + N + ') ===');
  console.log('  win rate:', rateRow(wins, ROSTER));
  console.log('  slot wins:', slot.map((v) => pct(v)).join(' '));
  console.log('  avg lead changes/race:', (leadChanges / N).toFixed(1));
}

// ---------------------------------------------------------------------------
// 2) TEAM (rank-sum). Homogeneous teams: T teams, each all-one-character, so a
//    team-win directly = "that character composition won". 6 single-char teams
//    of 2 members each (12 racers). Reads which character's pair dominates.
// ---------------------------------------------------------------------------
function teamHomogeneous() {
  // team t = ROSTER[t], 2 members each. 6 teams × 2 = 12 racers.
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const c of ROSTER) { ids.push(c, c); teamIds.push(c, c); }
  const wins: Record<string, number> = Object.fromEntries(ROSTER.map((c) => [c, 0]));
  for (let s = 0; s < N; s++) {
    const cfg = baseCfg({
      participants: participants(ids, teamIds),
      seed: s,
      modeId: 'team',
      scoringId: 'teamRankSum',
      teamMode: true,
    });
    const { result } = simulateRace(cfg, skills, scoring);
    wins[result.scoring.order[0]]++; // teamId == characterId here
  }
  console.log('=== TEAM rank-sum — homogeneous 2-pairs (6 single-char teams, N=' + N + ') ===');
  console.log('  team win rate:', rateRow(wins, ROSTER));
}

// ---------------------------------------------------------------------------
// 3) TEAM (rank-sum) — penguin-stack check. Past regression: penguin ice ran
//    away in multi-penguin teams. 3 teams of 3: one ALL-penguin team vs two
//    mixed teams. Does the penguin stack dominate?
// ---------------------------------------------------------------------------
function teamPenguinStack() {
  // A = penguin×3, B = dog/cat/monkey, C = eagle/bear/penguin
  const comp: Record<string, string[]> = {
    A_pengStack: ['penguin', 'penguin', 'penguin'],
    B_mixed: ['dog', 'cat', 'monkey'],
    C_mixed: ['eagle', 'bear', 'penguin'],
  };
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const [t, members] of Object.entries(comp)) for (const c of members) { ids.push(c); teamIds.push(t); }
  const wins: Record<string, number> = { A_pengStack: 0, B_mixed: 0, C_mixed: 0 };
  for (let s = 0; s < N; s++) {
    const cfg = baseCfg({
      participants: participants(ids, teamIds),
      seed: s,
      modeId: 'team',
      scoringId: 'teamRankSum',
      teamMode: true,
    });
    const { result } = simulateRace(cfg, skills, scoring);
    wins[result.scoring.order[0]]++;
  }
  console.log('=== TEAM rank-sum — penguin-stack vs mixed (3 teams ×3, N=' + N + ') ===');
  console.log('  team win rate:', rateRow(wins, Object.keys(comp)));
}

// ---------------------------------------------------------------------------
// 4) RELAY (leg cycle). legs = laps. Homogeneous relay teams so a win =
//    that character. 6 single-char teams of 3 members, laps=3 (each member one
//    leg, anchor = leg 2). Reads which character is over-favoured per-leg.
// ---------------------------------------------------------------------------
function relayHomogeneous() {
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const c of ROSTER) { ids.push(c, c, c); teamIds.push(c, c, c); }
  const wins: Record<string, number> = Object.fromEntries(ROSTER.map((c) => [c, 0]));
  const LAPS = 3;
  for (let s = 0; s < N; s++) {
    const cfg = baseCfg({
      participants: participants(ids, teamIds),
      seed: s,
      laps: LAPS,
      modeId: 'team',
      scoringId: 'teamRelay',
      teamMode: true,
      relay: true,
    });
    const { result } = simulateRace(cfg, skills, scoring);
    wins[result.scoring.order[0]]++;
  }
  console.log('=== RELAY — homogeneous (6 single-char teams ×3, laps=' + LAPS + ', N=' + N + ') ===');
  console.log('  team win rate:', rateRow(wins, ROSTER));
}

individual();
teamHomogeneous();
teamPenguinStack();
relayHomogeneous();
