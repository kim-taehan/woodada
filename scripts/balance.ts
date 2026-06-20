import { simulateRace } from '../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../src/engine/scoring/index.ts';
import { characterCatalog, defaultCharacterIds } from '../src/data/characters/index.ts';
import type { RaceConfig, RaceParticipant } from '../src/engine/types.ts';

// Balance harness — pure (seeded Rng), deterministic. Measures whether any
// character or composition over-dominates across the three game modes
// (individual / team rank-sum / relay leg-cycle) × lap counts {1, 3, 10}.
// Goal is NOT parity; it is "nobody runs away" — every roster slot can win,
// none dominates — and the same should hold at long (10-lap) distances, which
// used to be a blind spot (the engine-bias unit gate is 1-lap only).
//
//   npx vite-node scripts/balance.ts            # full matrix
//   npx vite-node scripts/balance.ts --dist     # + individual rank histogram
//   npx vite-node scripts/balance.ts --laps 10  # only the 10-lap row
//   npx vite-node scripts/balance.ts --n 500    # override sample size (all laps)

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

const ROSTER = [...defaultCharacterIds]; // 7: dog cat monkey eagle bear penguin hedgehog
const FAIR = 1 / ROSTER.length;          // fair win share / (1/N)
const FAIR_RANK = (ROSTER.length + 1) / 2; // fair avg finish rank

// --- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
const SHOW_DIST = args.includes('--dist');
const nFlag = args.indexOf('--n');
const N_OVERRIDE = nFlag >= 0 ? Number(args[nFlag + 1]) : undefined;
const lapsFlag = args.indexOf('--laps');
const LAPS_ONLY = lapsFlag >= 0 ? Number(args[lapsFlag + 1]) : undefined;

// Sample size per lap count (10-lap races are ~10× longer, so use fewer).
const N_BY_LAPS: Record<number, number> = { 1: 3000, 3: 1500, 10: 400 };
const LAP_SET = (LAPS_ONLY ? [LAPS_ONLY] : [1, 3, 10]).filter((l) => l > 0);
const sampleN = (laps: number) => N_OVERRIDE ?? N_BY_LAPS[laps] ?? 800;
// Generous frame cap so 10-lap races always finish (~400 frames/lap headroom).
const maxFrames = (laps: number) => 60 * 40 * Math.max(laps, 1);

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

// --- formatting helpers ---------------------------------------------------
const pad = (s: string, w: number) => s.padEnd(w);
const pct = (v: number) => (v * 100).toFixed(0) + '%';
/** A win share relative to the fair share — 1.00 = fair, >1 = over-favoured. */
const idx = (share: number) => (share / FAIR).toFixed(2) + '×';

interface KeyStat { wins: number; rankSum: number; lasts: number; }
function newStats(keys: string[]): Record<string, KeyStat> {
  return Object.fromEntries(keys.map((k) => [k, { wins: 0, rankSum: 0, lasts: 0 }]));
}

/** Print a per-key table sorted by avg rank (best first). */
function printTable(stats: Record<string, KeyStat>, keys: string[], n: number, entrants: number) {
  const lastRank = entrants;
  const rows = keys
    .map((k) => {
      const s = stats[k];
      return { k, win: s.wins / n, avgRank: s.rankSum / n, last: s.lasts / n };
    })
    .sort((a, b) => a.avgRank - b.avgRank);
  console.log(
    `    ${pad('', 10)}${pad('win%', 7)}${pad('fair×', 8)}${pad('avgRank', 9)}last%`,
  );
  for (const r of rows) {
    console.log(
      `    ${pad(r.k, 10)}${pad(pct(r.win), 7)}${pad(idx(r.win), 8)}${pad(r.avgRank.toFixed(2), 9)}${pct(r.last)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 1) INDIVIDUAL — 7 chars ×1 = 7 racers. Per-character win% + avg rank +
//    runaway metrics. (Two-per-char slot fairness is checked once at laps=1.)
// ---------------------------------------------------------------------------
function individual(laps: number) {
  const n = sampleN(laps);
  const ids = [...ROSTER];
  const stats = newStats(ROSTER);
  const dist: Record<string, number[]> = Object.fromEntries(
    ROSTER.map((c) => [c, new Array(ROSTER.length).fill(0)]),
  );
  let sumWinnerLeadFrac = 0; // fraction of race the eventual winner spent in front
  let leadChanges = 0;
  for (let s = 0; s < n; s++) {
    const cfg = baseCfg({ participants: participants(ids), seed: s, laps });
    const { frames, result } = simulateRace(cfg, skills, scoring, maxFrames(laps));
    result.order.forEach((pid, rank) => {
      const c = ids[Number(pid.slice(1))];
      const st = stats[c];
      st.rankSum += rank + 1;
      if (rank === 0) st.wins++;
      if (rank === ids.length - 1) st.lasts++;
      dist[c][rank]++;
    });
    const winnerId = result.order[0];
    let leader = '';
    let winnerLeadFrames = 0;
    for (const f of frames) {
      const front = f.racers.reduce((a, b) => (b.progress > a.progress ? b : a)).id;
      if (front !== leader) { leadChanges++; leader = front; }
      if (front === winnerId) winnerLeadFrames++;
    }
    sumWinnerLeadFrac += winnerLeadFrames / frames.length;
  }
  const winnerLed = sumWinnerLeadFrac / n;
  const shares = ROSTER.map((c) => stats[c].wins / n);
  // Loose-fairness flags: someone effectively can't win (< 0.4× fair) or one
  // racer dominates (> 60% wins). Same spirit as the engine-bias unit gate.
  const floorHit = Math.min(...shares) < 0.4 * FAIR;
  const dominates = Math.max(...shares) > 0.6;
  console.log(`  INDIVIDUAL · laps=${laps} · N=${n}  (fair win=${pct(FAIR)}, fair avgRank=${FAIR_RANK})`);
  printTable(stats, ROSTER, n, ROSTER.length);
  console.log(
    `    runaway: winner led ${winnerLed.toFixed(3)} of race, ${(leadChanges / n).toFixed(1)} lead-changes/race` +
      `${floorHit ? '  ⚠ floor' : ''}${dominates ? '  ⚠ DOMINATES' : ''}`,
  );
  if (SHOW_DIST) {
    console.log(`    rank histogram (1st..${ROSTER.length}th):`);
    for (const c of ROSTER) {
      console.log(`      ${pad(c, 10)}${dist[c].map((v) => pad(pct(v / n), 5)).join('')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2) TEAM (rank-sum) — homogeneous teams: 7 single-char teams of 2 members
//    (14 racers). A team-win = that character's pair won. team avg rank too.
// ---------------------------------------------------------------------------
function teamHomogeneous(laps: number) {
  const n = sampleN(laps);
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const c of ROSTER) { ids.push(c, c); teamIds.push(c, c); }
  const stats = newStats(ROSTER);
  for (let s = 0; s < n; s++) {
    const cfg = baseCfg({
      participants: participants(ids, teamIds),
      seed: s,
      laps,
      modeId: 'team',
      scoringId: 'teamRankSum',
      teamMode: true,
    });
    const { result } = simulateRace(cfg, skills, scoring, maxFrames(laps));
    result.scoring.order.forEach((team, rank) => { // teamId == characterId here
      const st = stats[team];
      st.rankSum += rank + 1;
      if (rank === 0) st.wins++;
      if (rank === ROSTER.length - 1) st.lasts++;
    });
  }
  console.log(`  TEAM rank-sum · homogeneous 2-pairs · laps=${laps} · N=${n}  (fair win=${pct(FAIR)})`);
  printTable(stats, ROSTER, n, ROSTER.length);
}

// ---------------------------------------------------------------------------
// 3) RELAY (leg cycle) — homogeneous: 7 single-char teams of 3 members. Each
//    member runs a leg (legs = laps). team win = that character per-leg favour.
// ---------------------------------------------------------------------------
function relayHomogeneous(laps: number) {
  const n = sampleN(laps);
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const c of ROSTER) { ids.push(c, c, c); teamIds.push(c, c, c); }
  const stats = newStats(ROSTER);
  for (let s = 0; s < n; s++) {
    const cfg = baseCfg({
      participants: participants(ids, teamIds),
      seed: s,
      laps,
      modeId: 'team',
      scoringId: 'teamRelay',
      teamMode: true,
      relay: true,
    });
    const { result } = simulateRace(cfg, skills, scoring, maxFrames(laps));
    result.scoring.order.forEach((team, rank) => {
      const st = stats[team];
      st.rankSum += rank + 1;
      if (rank === 0) st.wins++;
      if (rank === ROSTER.length - 1) st.lasts++;
    });
  }
  console.log(`  RELAY · homogeneous 3-member · legs=${laps} · N=${n}  (fair win=${pct(FAIR)})`);
  printTable(stats, ROSTER, n, ROSTER.length);
}

// ---------------------------------------------------------------------------
// 4) TEAM rank-sum — penguin-stack regression check (1-lap, fixed). Past bug:
//    penguin ice ran away in multi-penguin teams. ALL-penguin vs two mixed.
// ---------------------------------------------------------------------------
function teamPenguinStack() {
  const n = N_OVERRIDE ?? 3000;
  const comp: Record<string, string[]> = {
    A_pengStack: ['penguin', 'penguin', 'penguin'],
    B_mixed: ['dog', 'cat', 'monkey'],
    C_mixed: ['eagle', 'bear', 'hedgehog'],
  };
  const ids: string[] = [];
  const teamIds: string[] = [];
  for (const [t, members] of Object.entries(comp)) for (const c of members) { ids.push(c); teamIds.push(t); }
  const wins: Record<string, number> = { A_pengStack: 0, B_mixed: 0, C_mixed: 0 };
  for (let s = 0; s < n; s++) {
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
  console.log(`  TEAM rank-sum · penguin-stack vs mixed (3 teams ×3, laps=1, N=${n})`);
  console.log('    ' + Object.keys(comp).map((k) => `${k} ${pct(wins[k] / n)}`).join('   '));
}

// --- run the matrix -------------------------------------------------------
console.log('============================================================');
console.log(`BALANCE MATRIX — roster ${ROSTER.length}: ${ROSTER.join(' ')}`);
console.log('  win% = 1st-place share · fair× = share ÷ fair · avgRank lower=better · last% = last-place share');
console.log('============================================================');
for (const laps of LAP_SET) {
  console.log(`\n──────── LAPS = ${laps} ────────`);
  individual(laps);
  console.log('');
  teamHomogeneous(laps);
  console.log('');
  relayHomogeneous(laps);
}
console.log('\n──────── REGRESSION CHECKS ────────');
teamPenguinStack();
