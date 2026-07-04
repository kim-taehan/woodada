/**
 * Victory podium (spec §13): blue field + blocks with the top-3 racers (or
 * top-3 teams) standing on them, celebrating/neutral/dejected by placement.
 * Built once per race by RaceRenderer.showResult() via `createPodiumScene`;
 * self-contained — owns its Container (added to `app.stage`) and its Pixi
 * ticker (added to `app.ticker`). `destroy()` tears both down. Pure display:
 * reads only the RacerView bodies/tags RaceRenderer already built, never
 * touches the simulation.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import type { RaceConfig, RaceResult } from '../../engine/types.ts';
import type { PartsCharacter } from '../character/PartsCharacter.ts';
import type { RacerView } from '../RaceRenderer.ts';

export interface PodiumHandle {
  destroy(): void;
}

/**
 * Build + play the victory podium. Adds its blue-field Container to
 * `app.stage` and its animation callback to `app.ticker`; call `destroy()`
 * once (from RaceRenderer.clearPodium/destroy) to tear both down.
 */
export function createPodiumScene(
  app: Application,
  width: number,
  height: number,
  config: RaceConfig,
  result: RaceResult,
  views: Map<string, RacerView>,
  isReducedMotion: () => boolean,
): PodiumHandle {
  const podiumScene = new Container();
  const baseY = height * 0.66;
  podiumScene.addChild(new Graphics().rect(0, 0, width, height).fill(0x4aa3e0));
  podiumScene.addChild(new Graphics().rect(0, baseY, width, height - baseY).fill(0x3f8fd0));
  app.stage.addChildAt(podiumScene, 1); // above track, below characters

  const slotX = [width / 2, width / 2 - 160, width / 2 + 160]; // 1st centre, 2nd left, 3rd right
  const blockH = [150, 108, 80];
  const blockColor = [0xffd23f, 0xc8cbd0, 0xcd8b53];
  const bw = 120;
  const shown = new Set<string>();

  // Each podium occupant carries the pose it should hold and `winner` (the bigger
  // bounce for the 1st-place team / block). `phase`: 'celebrate' = 깝치기(1등팀 only),
  // 'finished' = neutral win-stance (2·3등팀 + individual non-jig), 'dejected' =
  // slump for teams that didn't make the podium (4등팀↓, team mode only).
  const podiumChars: { char: PartsCharacter; winner: boolean; phase: 'celebrate' | 'finished' | 'dejected' }[] = [];

  if (config.teamMode) {
    // ── TEAM podium: blocks are TEAMS, ranked by engine team score. ──────────
    // `result.scoring.order` is the authoritative winner-first teamId array for
    // all three team modes (teamRankSum / teamFirstPlace / teamRelay, s24).
    //   • 1·2·3등팀 → blocks 1/2/3 (up to 4 members each, clustered on the block)
    //   • 1등팀만 방방(celebrate); 2·3등팀 서 있음('finished'); 4등팀↓ 단상 밑 좌절.
    // Members of a team are ordered by finish so its best racer leads the cluster.
    const teamOrder = result.scoring.type === 'team' ? result.scoring.order : [];
    const finishRank = new Map<string, number>();
    result.order.forEach((id, i) => finishRank.set(id, i));
    const membersOf = (teamId: string): string[] =>
      config.participants
        .filter((p) => (p.teamId ?? p.id) === teamId && views.has(p.id))
        .map((p) => p.id)
        .sort((a, b) => (finishRank.get(a) ?? 1e9) - (finishRank.get(b) ?? 1e9));
    const MAX_ON_BLOCK = 4; // crowd cap per block

    teamOrder.forEach((teamId, teamRank) => {
      const allMembers = membersOf(teamId);
      if (!allMembers.length) return;

      if (teamRank < 3) {
        // On a podium block. 1 등팀 깝친다, 2·3 등팀 중립. Up to MAX_ON_BLOCK stand
        // on the block; any overflow (a big team) clusters on the GROUND in
        // front of the block in the SAME pose (winning team still celebrates).
        const onBlock = allMembers.slice(0, MAX_ON_BLOCK);
        const overflow = allMembers.slice(MAX_ON_BLOCK);
        const x = slotX[teamRank];
        const h = blockH[teamRank];
        // Scale block width to team size (wider for bigger teams).
        const teamSpan = allMembers.length;
        const scaledBw = Math.max(bw, bw + (teamSpan - 1) * 20);
        const block = new Graphics().roundRect(x - scaledBw / 2, baseY - h, scaledBw, h, 8).fill(blockColor[teamRank]);
        block.stroke({ color: 0xffffff, width: 3, alpha: 0.65 });
        const num = new Text({ text: `${teamRank + 1}`, style: { fontSize: 46, fontWeight: '900', fill: 0xffffff } });
        num.anchor.set(0.5);
        num.position.set(x, baseY - h / 2);
        podiumScene.addChild(block, num);
        // Widen the number text anchor area to match the block.
        num.scale.set(scaledBw / bw, 1);

        const phase = teamRank === 0 ? 'celebrate' : 'finished';
        // Fan the on-block members across the block top in a tidy huddle.
        onBlock.forEach((id, i) => {
          const v = views.get(id);
          if (!v) return;
          const span = onBlock.length;
          const t = span > 1 ? i / (span - 1) - 0.5 : 0; // -0.5..0.5
          const px = x + t * Math.min(scaledBw * 0.62, 26 + span * 14);
          const py = baseY - h - 14 + (i % 2) * 12; // slight stagger so they don't fully overlap
          v.character.root.visible = true;
          v.character.root.position.set(px, py);
          v.character.root.scale.set((teamRank === 0 ? 0.72 : 0.6) * v.size);
          v.character.root.zIndex = 1000 + (3 - teamRank) * 10 + i;
          // Show all team members' names on the podium.
          v.tag.root.visible = true;
          v.tag.setPosition(px, py - 78);
          v.tag.root.zIndex = 200000 + i;
          podiumChars.push({ char: v.character, winner: teamRank === 0, phase });
          shown.add(id);
        });
        // Overflow members huddle on the ground hugging the block's base, in
        // the same pose as the team (winning team keeps celebrating).
        overflow.forEach((id, i) => {
          const v = views.get(id);
          if (!v) return;
          const span = overflow.length;
          const t = span > 1 ? i / (span - 1) - 0.5 : 0;
          const px = x + t * Math.min(scaledBw * 0.92, 30 + span * 16);
          const py = baseY + 30 + (i % 2) * 16; // just in front of the block, on the field
          v.character.root.visible = true;
          v.character.root.position.set(px, py);
          v.character.root.scale.set(0.54 * v.size);
          v.character.root.zIndex = 900 + (3 - teamRank) * 10 + i; // in front of the block face
          v.tag.root.visible = true;
          v.tag.setPosition(px, py - 68);
          v.tag.root.zIndex = 200000 + i;
          podiumChars.push({ char: v.character, winner: false, phase });
          shown.add(id);
        });
      } else {
        // 4 등팀 이하: no block — the whole team slumps below the podium, dejected
        // (show all members with names so everyone is recognized).
        const members = allMembers;
        const span = members.length;
        const teamSlot = teamRank - 3; // 0,1,... among the also-rans
        const baseX = width / 2 + (teamSlot - 0.5) * 240; // spread also-ran teams along the front
        members.forEach((id, i) => {
          const v = views.get(id);
          if (!v) return;
          const t = span > 1 ? i / (span - 1) - 0.5 : 0;
          const px = baseX + t * Math.min(120, 50 + span * 20);
          const py = baseY + 56 + (i % 2) * 16; // on the field, below the blocks
          v.character.root.visible = true;
          v.character.root.position.set(px, py);
          v.character.root.scale.set(0.52 * v.size);
          v.character.root.zIndex = 800 + i;
          v.tag.root.visible = true;
          v.tag.setPosition(px, py - 68);
          v.tag.root.zIndex = 200000 + i;
          podiumChars.push({ char: v.character, winner: false, phase: 'dejected' });
          shown.add(id);
        });
      }
    });
  } else {
    // ── INDIVIDUAL podium (unchanged): top-3 racers, all celebrate. ──────────
    const top = result.order.slice(0, Math.min(3, result.order.length));
    top.forEach((id, rank) => {
      const x = slotX[rank];
      const h = blockH[rank];
      const block = new Graphics().roundRect(x - bw / 2, baseY - h, bw, h, 8).fill(blockColor[rank]);
      block.stroke({ color: 0xffffff, width: 3, alpha: 0.65 });
      const num = new Text({ text: `${rank + 1}`, style: { fontSize: 46, fontWeight: '900', fill: 0xffffff } });
      num.anchor.set(0.5);
      num.position.set(x, baseY - h / 2);
      podiumScene.addChild(block, num);

      const v = views.get(id);
      if (!v) return;
      v.character.root.visible = true;
      v.character.root.position.set(x, baseY - h - 14);
      v.character.root.scale.set((rank === 0 ? 0.85 : 0.72) * v.size);
      v.character.root.zIndex = 1000 + (3 - rank);
      v.tag.root.visible = true;
      v.tag.setPosition(x, baseY - h - 92);
      v.tag.root.zIndex = 200000;
      podiumChars.push({ char: v.character, winner: rank === 0, phase: 'celebrate' });
      shown.add(id);
    });
  }

  for (const [id, v] of views) {
    if (!shown.has(id)) {
      v.character.root.visible = false;
      v.tag.root.visible = false;
    }
  }

  let podiumClock = 0;
  const tick = (ticker: { deltaMS: number }): void => {
    podiumClock += ticker.deltaMS / 1000;
    for (const pc of podiumChars) {
      // 1등팀 깝친다 (celebrate); 2·3등팀 중립 'finished'; 4등팀↓ 'dejected' 좌절.
      pc.char.update({
        phase: pc.phase,
        speedNorm: pc.phase === 'celebrate' ? (pc.winner ? 1 : 0.7) : 0.4,
        clock: podiumClock,
        facing: 0,
        heading: 1,
        reducedMotion: isReducedMotion(),
      });
    }
  };
  app.ticker.add(tick);

  return {
    destroy() {
      app.ticker.remove(tick);
      podiumScene.destroy({ children: true });
    },
  };
}
