import { describe, it, expect } from 'vitest';
import { simulateRace } from '../../src/engine/RaceEngine.ts';
import { createDefaultSkillRegistry } from '../../src/engine/skills/index.ts';
import { createDefaultScoringRegistry } from '../../src/engine/scoring/index.ts';
import { teamRelay } from '../../src/engine/scoring/relay.ts';
import { makeConfig } from './helpers.ts';
import type { EngineFrame } from '../../src/engine/types.ts';

const skills = createDefaultSkillRegistry();
const scoring = createDefaultScoringRegistry();

/**
 * Cyclic relay model (spec §5, updated): legs per team = `laps`; leg i is run by
 * members[i % size]; anchor = runner of leg (laps-1). Members may run several
 * legs (re-entry: running → finished-leg → waiting → running → …).
 */
function relay2v2(seed: number, laps = 2) {
  return makeConfig({
    characterIds: ['dog', 'cat', 'monkey', 'bear'],
    seed,
    laps,
    teamMode: true,
    scoringId: 'teamRelay',
    teamIds: ['red', 'blue', 'red', 'blue'],
    relay: true,
  });
  // member queues per team: red = [p0, p2], blue = [p1, p3]
}

function hashFrames(frames: EngineFrame[]): string {
  return frames
    .map((f) =>
      f.racers.map((r) => `${r.id}:${r.phase}:${r.leg ?? '-'}:${r.progress.toFixed(4)}:${r.lane.toFixed(4)}`).join('|'),
    )
    .join('\n');
}

/** Member running leg i of a team = queue[i % queue.length]. */
function runnerOfLeg(queue: string[], leg: number): string {
  return queue[leg % queue.length];
}

describe('relay engine', () => {
  it('determinism: same (relay config, seed) replays identically', () => {
    const a = simulateRace(relay2v2(2024, 5), skills, scoring);
    const b = simulateRace(relay2v2(2024, 5), skills, scoring);
    expect(a.result.order).toEqual(b.result.order);
    expect(a.result.scoring.order).toEqual(b.result.scoring.order);
    expect(hashFrames(a.frames)).toEqual(hashFrames(b.frames));
  });

  it('cyclic legs: 3-member team + 5 laps → 5 legs, runner = member[i % 3]', () => {
    // Single team of 3, 5 laps → leg runners = p0,p1,p2,p0,p1 (anchor leg 4 = p1).
    const cfg = makeConfig({
      characterIds: ['dog', 'cat', 'bear'],
      seed: 9,
      laps: 5,
      teamMode: true,
      scoringId: 'teamRelay',
      teamIds: ['t', 't', 't'],
      relay: true,
    });
    const queue = ['p0', 'p1', 'p2'];
    const { frames } = simulateRace(cfg, skills, scoring);

    // Reconstruct the leg sequence from handoff targets (+ the implicit leg 0).
    const handoffs = frames.flatMap((f) =>
      f.events.filter((e) => e.type === 'relay' && e.variant === 'handoff'),
    );
    // 5 legs → 4 handoffs (every non-anchor leg passes the baton).
    expect(handoffs.length).toBe(4);

    const legRunners = ['p0', ...handoffs.map((h) => h.targetId!)];
    expect(legRunners).toEqual([0, 1, 2, 3, 4].map((i) => runnerOfLeg(queue, i)));
    expect(legRunners).toEqual(['p0', 'p1', 'p2', 'p0', 'p1']);

    // Exactly one runner active at any frame for this single team.
    for (const f of frames) {
      const running = f.racers.filter((r) => r.phase === 'running');
      expect(running.length).toBeLessThanOrEqual(1);
    }
  });

  it('anchor = runner of leg (laps-1); team order = anchor finish order', () => {
    const cfg = relay2v2(11, 3); // red=[p0,p2] blue=[p1,p3]; anchor leg 2 → p0, p1
    const { frames, result } = simulateRace(cfg, skills, scoring);

    const queues: Record<string, string[]> = { red: ['p0', 'p2'], blue: ['p1', 'p3'] };
    const anchorOf = {
      red: runnerOfLeg(queues.red, cfg.laps - 1), // (3-1)%2 = 0 → p0
      blue: runnerOfLeg(queues.blue, cfg.laps - 1), // p1
    };
    expect(anchorOf).toEqual({ red: 'p0', blue: 'p1' });

    // Only the anchor (final-leg finisher) carries a finish frame/rank.
    const last = frames[frames.length - 1];
    const finished = last.racers.filter((r) => r.phase === 'finished').map((r) => r.id).sort();
    expect(finished).toEqual([anchorOf.blue, anchorOf.red].sort());

    const finishOf = result.finishFrame;
    const expectedTeamOrder = Object.entries(anchorOf)
      .sort((a, b) => finishOf[a[1]] - finishOf[b[1]])
      .map(([team]) => team);
    expect(result.scoring.type).toBe('team');
    expect(result.scoring.order).toEqual(expectedTeamOrder);
  });

  it('handoffs land at the line, target = next leg runner, incoming restarts from 0', () => {
    const cfg = relay2v2(7, 4); // 4 legs each: red p0,p2,p0,p2 ; blue p1,p3,p1,p3
    const { frames } = simulateRace(cfg, skills, scoring);
    const queues: Record<string, string[]> = { red: ['p0', 'p2'], blue: ['p1', 'p3'] };

    const handoffs = frames.flatMap((f) =>
      f.events.filter((e) => e.type === 'relay' && e.variant === 'handoff'),
    );
    // 2 teams × (4 legs - 1) = 6 handoffs.
    expect(handoffs.length).toBe(6);

    // Per team, handoff targets in time order = legs 1,2,3 runners (cyclic).
    for (const team of Object.keys(queues)) {
      const q = queues[team];
      const targets = handoffs
        .filter((h) => cfg.participants.find((p) => p.id === h.racerId)!.teamId === team)
        .map((h) => h.targetId);
      expect(targets).toEqual([1, 2, 3].map((leg) => runnerOfLeg(q, leg)));
    }

    for (const h of handoffs) {
      const f = frames.find((fr) => fr.frame === h.frame)!;
      const finisher = f.racers.find((r) => r.id === h.racerId)!;
      // Finisher crossed the line on the handoff frame.
      expect(finisher.progress % cfg.trackLength).toBeLessThan(cfg.trackLength);

      // Incoming runner was waiting at 0 the previous frame, now running from ~0.
      const prev = frames.find((fr) => fr.frame === h.frame - 1)!;
      const before = prev.racers.find((r) => r.id === h.targetId)!;
      expect(before.phase).toBe('waiting');
      expect(before.progress).toBe(0);
      const incoming = f.racers.find((r) => r.id === h.targetId)!;
      expect(incoming.phase).toBe('running');
      expect(incoming.progress).toBeLessThan(5);
    }

    // At most one runner per team active each frame.
    for (const f of frames) {
      const perTeam: Record<string, number> = {};
      for (const r of f.racers) if (r.phase === 'running') {
        const t = cfg.participants.find((p) => p.id === r.id)!.teamId!;
        perTeam[t] = (perTeam[t] ?? 0) + 1;
      }
      for (const t of Object.keys(perTeam)) expect(perTeam[t]).toBeLessThanOrEqual(1);
    }
  });

  it('member re-entry: a racer running multiple legs cycles running ↔ waiting', () => {
    // Single team of 2, 4 laps → p0 runs legs 0,2 ; p1 runs legs 1(=p1),3(anchor).
    const cfg = makeConfig({
      characterIds: ['dog', 'cat'],
      seed: 4,
      laps: 4,
      teamMode: true,
      scoringId: 'teamRelay',
      teamIds: ['t', 't'],
      relay: true,
    });
    const { frames } = simulateRace(cfg, skills, scoring);

    // Count waiting → running transitions (a leg (re)start at the line). Item
    // boxes flip running ↔ straying/stunned mid-leg, so key off the waiting hop
    // to isolate genuine leg restarts. p0 restarts for leg 2; p1 for legs 1, 3.
    function legRestarts(id: string): number {
      let starts = 0;
      let prev = 'running';
      for (const f of frames) {
        const ph = f.racers.find((r) => r.id === id)!.phase;
        if (ph === 'running' && prev === 'waiting') starts++;
        prev = ph;
      }
      return starts;
    }
    expect(legRestarts('p0')).toBe(1); // re-enters once for leg 2 (leg 0 is its start)
    expect(legRestarts('p1')).toBe(2); // enters for leg 1, re-enters for leg 3 (anchor)

    // p0 never reaches 'finished' (it is not the anchor); p1 (anchor) does.
    const anyP0Finished = frames.some((f) => f.racers.find((r) => r.id === 'p0')!.phase === 'finished');
    const anyP1Finished = frames.some((f) => f.racers.find((r) => r.id === 'p1')!.phase === 'finished');
    expect(anyP0Finished).toBe(false);
    expect(anyP1Finished).toBe(true);

    // While waiting between its legs, p0 is inert (parked at the line).
    for (const f of frames) {
      const p0 = f.racers.find((r) => r.id === 'p0')!;
      if (p0.phase === 'waiting') {
        expect(p0.progress).toBe(0);
        expect(p0.speed).toBe(0);
      }
    }
  });

  it('uneven team sizes: every team runs exactly `laps` legs regardless of size', () => {
    // red = 2 members, blue = 3 members, 5 laps → both run 5 legs.
    const cfg = makeConfig({
      characterIds: ['dog', 'cat', 'bear', 'monkey', 'dog'],
      seed: 13,
      laps: 5,
      teamMode: true,
      scoringId: 'teamRelay',
      teamIds: ['red', 'blue', 'red', 'blue', 'blue'],
      relay: true,
    });
    const { frames } = simulateRace(cfg, skills, scoring);

    const legsPerTeam: Record<string, number> = { red: 0, blue: 0 };
    for (const f of frames) {
      for (const e of f.events) {
        if (e.type === 'relay' && e.variant === 'handoff') {
          const team = cfg.participants.find((p) => p.id === e.racerId)!.teamId!;
          legsPerTeam[team]++;
        }
      }
    }
    // legs - 1 handoffs each (leg 0 has no incoming handoff).
    expect(legsPerTeam.red).toBe(cfg.laps - 1);
    expect(legsPerTeam.blue).toBe(cfg.laps - 1);

    // Both teams' anchors finish; scoring ranks two teams.
    expect(frames.flatMap((f) => f.racers).filter((r) => r.phase === 'finished').length).toBeGreaterThan(0);
  });

  it('waiting immunity: skills never affect waiting racers', () => {
    // Pack disruptors so roar/banana fire while teammates wait.
    const cfg = makeConfig({
      characterIds: ['bear', 'monkey', 'bear', 'monkey', 'dog', 'cat'],
      seed: 5,
      laps: 3,
      teamMode: true,
      scoringId: 'teamRelay',
      teamIds: ['red', 'blue', 'white', 'red', 'blue', 'white'],
      relay: true,
    });
    const { frames } = simulateRace(cfg, skills, scoring);

    let sawWaiting = false;
    for (const f of frames) {
      for (const r of f.racers) {
        if (r.phase !== 'waiting') continue;
        sawWaiting = true;
        // A waiting racer must be perfectly inert: at the line, no movement,
        // never stunned/napping/boosted by any skill or item.
        expect(r.progress).toBe(0);
        expect(r.speed).toBe(0);
      }
      // No skill/item event may target a waiting racer.
      for (const e of f.events) {
        if (e.targetId === undefined) continue;
        const tgt = f.racers.find((r) => r.id === e.targetId);
        if (tgt && tgt.phase === 'waiting' && e.variant !== 'handoff') {
          throw new Error(`event ${e.type}/${e.variant} targeted waiting racer ${e.targetId}`);
        }
      }
    }
    expect(sawWaiting).toBe(true);
  });

  it('teamRelay scoring strategy: ranks by anchor (leg laps-1) rank position', () => {
    // 3 teams × 2 members; laps=2 → anchor = leg 1 = members[1] = p3,p4,p5.
    const cfg = makeConfig({
      characterIds: ['dog', 'dog', 'dog', 'cat', 'cat', 'cat'],
      seed: 1,
      laps: 2,
      teamMode: true,
      teamIds: ['a', 'b', 'c', 'a', 'b', 'c'],
      relay: true,
    });
    // members: a=[p0,p3] b=[p1,p4] c=[p2,p5]; anchors (leg1) = p3,p4,p5.
    const order = ['p2', 'p0', 'p5', 'p1', 'p3', 'p4'];
    const r = teamRelay(order, cfg);
    // ranks within order: p5=3(c), p3=5(a), p4=6(b) → c, a, b.
    expect(r.order).toEqual(['c', 'a', 'b']);
    expect(r.detail).toEqual({ c: 3, a: 5, b: 6 });
  });

  it('teamRelay scoring: cyclic anchor when laps > size (anchor = leg (laps-1)%size)', () => {
    // 2 teams × 2 members; laps=3 → anchor = leg 2 = members[2%2=0] = first member.
    const cfg = makeConfig({
      characterIds: ['dog', 'dog', 'cat', 'cat'],
      seed: 2,
      laps: 3,
      teamMode: true,
      teamIds: ['a', 'b', 'a', 'b'],
      relay: true,
    });
    // members: a=[p0,p2] b=[p1,p3]; anchor leg 2 → members[0] = p0 (a), p1 (b).
    const order = ['p1', 'p0', 'p2', 'p3'];
    const r = teamRelay(order, cfg);
    // p1=1(b), p0=2(a) → b, a.
    expect(r.order).toEqual(['b', 'a']);
    expect(r.detail).toEqual({ b: 1, a: 2 });
  });

  it('single-member team: lone runner runs every leg, is its own anchor', () => {
    // 2 solo teams, 3 laps → each runner runs 3 legs (legs 0,1,2; anchor leg 2).
    const cfg = makeConfig({
      characterIds: ['dog', 'cat'],
      seed: 3,
      laps: 3,
      teamMode: true,
      scoringId: 'teamRelay',
      teamIds: ['solo1', 'solo2'],
      relay: true,
    });
    const { frames, result } = simulateRace(cfg, skills, scoring);
    // No teammate ever waits (size 1 → the cycle wraps straight back to itself).
    expect(frames.some((f) => f.racers.some((r) => r.phase === 'waiting'))).toBe(false);
    // But each solo runner still emits leg handoffs (to itself) for legs 1,2.
    const handoffs = frames.flatMap((f) => f.events).filter((e) => e.type === 'relay');
    expect(handoffs.length).toBe(2 * (cfg.laps - 1)); // 2 teams × 2 handoffs
    for (const h of handoffs) expect(h.targetId).toBe(h.racerId); // wraps to self
    expect(result.scoring.type).toBe('team');
    expect(result.scoring.order.sort()).toEqual(['solo1', 'solo2']);
  });
});
