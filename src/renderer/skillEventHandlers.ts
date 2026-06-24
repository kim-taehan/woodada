/**
 * Skill/item event → FX + speech-bubble dispatch, extracted from RaceRenderer's
 * playEvent. Display-only: it draws the activation/hit/dodge theatrics for each
 * SkillEvent and never feeds back into the simulation. The generic beats (the
 * e.line head bubble, dodge-tone overrides, actor glow/sparkle/pop, and the
 * trailing star/cat dodge shimmer) live in dispatchSkillEvent; per-skill
 * theatrics live in SKILL_HANDLERS keyed by `${type}:${variant}`.
 */

import type { EngineFrame, RaceConfig, SkillEvent } from '../engine/types.ts';
import type { OvalTrack } from './track/OvalTrack.ts';
import type { FxLayer } from './fx/FxLayer.ts';
import type { SpeechBubbleLayer } from './fx/SpeechBubble.ts';
import type { characterCatalog as CharacterCatalogType } from '../data/characters/index.ts';
import type { Pos, RacerView } from './RaceRenderer.ts';
import { IMPACT_DELAY } from './renderUtils.ts';
import {
  mimicCopyBubble,
  roarActivateBubble,
  icefieldActivateBubble,
  zoomiesActivateBubble,
  catwalkActivateBubble,
  illusionActivateBubble,
  bristleActivateBubble,
  abductHitBubble,
  abductDodgeBubble,
  bananaFailBubble,
  bananaHitBubble,
  catDodgeBubble,
  penguinIceImmuneBubble,
  eliminationBubble,
} from './fx/commentaryLines.ts';

type CharacterCatalog = typeof CharacterCatalogType;

/**
 * Everything playEvent needs from the renderer closure to draw an event's FX.
 * Passed in by RaceRenderer.playEvent; all of it is display state (positions,
 * views, FX layers, the current clock/frame, and the spike/web tint helpers).
 */
export interface SkillRenderCtx {
  e: SkillEvent;
  posById: Map<string, Pos>;
  views: Map<string, RacerView>;
  fx: FxLayer;
  bubbles: SpeechBubbleLayer;
  clock: number;
  curFrameIdx: number;
  config: RaceConfig;
  charIdById: Map<string, string>;
  characterCatalog: CharacterCatalog;
  scheduleFx: (at: number, fn: () => void) => void;
  track: OvalTrack;
  spikeTintOf: (racerId: string) => number;
  webTintOf: (racerId: string) => number;
  reducedMotion: boolean;
  curDecoys: EngineFrame['decoys'];
  starUntilById: Map<string, number>;
  width: number;
  height: number;
}

/**
 * SkillRenderCtx plus the per-event locals the switch cases shared (the actor's
 * + target's positions/views, the facing sign, and whether a dodge was a star
 * deflect). Computed once in dispatchSkillEvent and handed to each handler.
 */
interface HandlerCtx extends SkillRenderCtx {
  self: Pos;
  v: RacerView;
  at: Pos | undefined;
  v2: RacerView | undefined;
  dir: number;
  targetStarred: boolean;
}

type SkillHandler = (ctx: HandlerCtx) => void;

const SKILL_HANDLERS: Record<string, SkillHandler> = {
  'zoomies:activate': ({ e, fx, bubbles, self, v, dir, clock, curFrameIdx }) => {
    fx.dust(self.x, self.y + 14, clock);
    fx.speedLines(self.x, self.y - 6, dir, clock);
    bubbles.spawn(e.racerId, zoomiesActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'zoomies:hit': ({ e, fx, at, clock }) => {
    // 🐶 강아지 부스트 충돌: 상대를 아웃코스로 밀어내는 충격 이펙트
    if (at) {
      fx.stars(at.x, at.y, clock);  // 충격 별
      fx.dizzy(at.x, at.y, clock);  // 어지러움 효과
      // 바깥쪽으로 튕겨나가는 느낌의 먼지
      fx.dust(at.x + 20, at.y, clock);
    }
  },
  'catwalk:activate': ({ e, fx, bubbles, self, v, dir, clock, curFrameIdx }) => {
    fx.sparkle(self.x, self.y, clock);
    fx.speedLines(self.x, self.y - 6, dir, clock);
    bubbles.spawn(e.racerId, catwalkActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'catwalk:dodge': ({ fx, self, clock }) => {
    // "냐옹" immunity flash the instant a disruption is shrugged off.
    fx.sparkle(self.x, self.y, clock);
    fx.whiff(self.x, self.y, clock);
  },
  'divebomb:activate': ({ fx, self, v, dir, clock }) => {
    // Eagle springs UP off the ground then drops + lunges forward (screen-space
    // action — sets the hop on the actor's view). Speed-lines flick out as it
    // leaps. Target is unknown until the paired hit/dodge event (same frame);
    // reset here so a fresh hop defaults to a self-spot pounce until set below.
    v.diveAt = clock;
    v.diveTargetId = null;
    fx.speedLines(self.x, self.y - 6, dir, clock);
  },
  'divebomb:dodge': ({ e, fx, self, v, at, targetStarred, scheduleFx, posById, clock }) => {
    // Cat slipped the headbutt — the eagle rams empty air over the (escaped)
    // cat. Lunge the body onto the target's spot anyway so the headbutt reads
    // as aimed (the cat just isn't there when it lands).
    v.diveTargetId = e.targetId ?? null;
    // Delay to the bottom of the plunge so the whiff lands as the eagle arrives.
    // If a star racer deflected it, flash a shield there instead of a whiff.
    if (targetStarred && at) {
      scheduleFx(clock + IMPACT_DELAY, () => {
        const a = (e.targetId ? posById.get(e.targetId) : undefined) ?? at;
        fx.starShield(a.x, a.y, clock + IMPACT_DELAY);
      });
    } else {
      scheduleFx(clock + IMPACT_DELAY, () => fx.whiff((at ?? self).x, (at ?? self).y, clock + IMPACT_DELAY));
    }
  },
  'divebomb:hit': ({ e, fx, self, v, at, dir, scheduleFx, posById, clock }) => {
    if (e.targetId === e.racerId) {
      // Gamble LOST — the eagle face-plants ITSELF at the bottom of its hop.
      // Failure cue is deliberately DULL + GREY (no bright stars/gold): a grey
      // dust slump, a drooping 😵 swirl, sweat-bead and a "꽝..." so it reads
      // instantly as a flop. No glide: the body stays over its own spot.
      v.diveTargetId = null;
      scheduleFx(clock + IMPACT_DELAY, () => {
        const p = posById.get(e.racerId) ?? self;
        fx.swoop(p.x - dir * 40, p.y, p.x, p.y, clock + IMPACT_DELAY);
        fx.dustSlump(p.x, p.y, clock + IMPACT_DELAY);
      });
    } else if (at) {
      // Gamble WON — headbutt connects at the bottom of the hop. Success cue is
      // bright + GOLD: a triumphant gold burst + "명중!" pop ON THE EAGLE (who
      // acted), while the TARGET is slammed (head-first impact, feathers, stars,
      // dizzy stun). The gold-on-actor vs grey-self-slump contrast makes win vs
      // flop read at a glance. Lunge the body onto the target's CURRENT spot.
      v.diveTargetId = e.targetId ?? null;
      scheduleFx(clock + IMPACT_DELAY, () => {
        const a = (e.targetId ? posById.get(e.targetId) : undefined) ?? at;
        const eagle = posById.get(e.racerId) ?? self;
        fx.goldBurst(eagle.x, eagle.y, clock + IMPACT_DELAY);
        fx.swoop(self.x, a.y, a.x, a.y, clock + IMPACT_DELAY);
        fx.feathers(a.x, a.y, clock + IMPACT_DELAY);
        fx.stars(a.x, a.y, clock + IMPACT_DELAY);
        fx.dizzy(a.x, a.y, clock + IMPACT_DELAY);
      });
    }
  },
  'banana:hit': ({ e, fx, bubbles, self, v, at, clock, curFrameIdx }) => {
    if (at) {
      fx.bananaThrow(self.x, self.y - 6, at.x, at.y, clock);
      fx.stars(at.x, at.y, clock);
      bubbles.spawn(e.racerId, bananaHitBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
    }
  },
  'banana:whiff': ({ e, fx, bubbles, self, v, clock, curFrameIdx }) => {
    fx.whiff(self.x, self.y, clock);
    const noTargetLines = ['누구한테 던질 사람이 없네…', '에잇, 다 갔어?!', '허공에 던지나… 🍌', '상대가 없군 ㅋ', '쓸데없이 던졌다…'];
    bubbles.spawn(e.racerId, noTargetLines[curFrameIdx % noTargetLines.length], v.tint, self.x, self.y - 64, clock);
  },
  'banana:dodge': ({ fx, self, at, targetStarred, clock }) => {
    if (at) {
      fx.bananaThrow(self.x, self.y - 6, at.x + 30, at.y - 20, clock);
      if (targetStarred) fx.starShield(at.x, at.y, clock);
      else fx.whiff(at.x, at.y, clock);
    }
  },
  'item:star': ({ fx, self, clock }) => {
    // ⭐ Star: a loud rainbow burst on the eater the instant it goes invincible.
    // The ongoing "I'm invincible NOW" shimmer is drawn in renderFrame while the
    // star window stays live (starUntilById).
    fx.starBurst(self.x, self.y, clock);
  },
  'item:lightning': ({ fx, self, width, height, clock }) => {
    // ⚡ Lightning: full-screen flash + a bolt onto the eater. Everyone else
    // is slowed by the engine; visually they simply sag back.
    fx.lightning(self.x, self.y, width, height, clock);
  },
  'item:fart': ({ fx, self, dir, clock }) => {
    // 💨 Fart cloud trailing behind the eater (those behind get slowed).
    fx.fart(self.x, self.y, dir, clock);
  },
  'item:shell': ({ fx, self, dir, clock }) => {
    // 🐢 Shell launch toss out in front of the eater (the bonk lands on
    // the shellhit event against the current leader).
    fx.shellThrow(self.x, self.y - 6, self.x + dir * 60, self.y - 30, clock);
  },
  'item:shellhit': ({ fx, self, at, clock }) => {
    // 🐢 Shell connects on the current leader (targetId) — bonk + dizzy stun,
    // reusing the roar/divebomb stun read. If the leader ate its own shell,
    // targetId === racerId and it lands on the eater itself.
    if (at) {
      fx.shellThrow(self.x, self.y - 6, at.x, at.y - 6, clock);
      fx.stars(at.x, at.y, clock);
      fx.dizzy(at.x, at.y, clock);
    }
  },
  'icefield:activate': ({ e, bubbles, self, v, clock, curFrameIdx }) => {
    bubbles.spawn(e.racerId, icefieldActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'roar:activate': ({ e, fx, bubbles, self, v, clock, curFrameIdx }) => {
    fx.shockwave(self.x, self.y, clock);
    fx.dust(self.x, self.y + 12, clock);
    bubbles.spawn(e.racerId, roarActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'roar:hit': ({ fx, at, clock }) => {
    // Per-victim stagger from the roar's shockwave: dizzy swirl + impact ring
    // on the struck racer (distinct from a banana's slip). Many fire at once.
    if (at) fx.dizzy(at.x, at.y, clock);
  },
  'bristle:activate': ({ e, fx, bubbles, self, v, spikeTintOf, clock, curFrameIdx }) => {
    const spikeTint = spikeTintOf(e.racerId);
    fx.bristle(self.x, self.y, spikeTint, clock);
    bubbles.spawn(e.racerId, bristleActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'bristle:hit': ({ e, fx, bubbles, at, v2, spikeTintOf, clock, curFrameIdx }) => {
    // 🦔 The chaser (just behind) gets bounced BACKWARD off the spines: a sharp
    // impact + quill shards + a dust skid the way it recoils. `at.heading` gives
    // the chaser's travel sign so spikeShove flings it opposite. It is also
    // slowed by the engine; visually it simply sags back.
    // Hit line (랜덤 멘트) 을 **상대 (타겟) 머리 위**에 표시.
    if (at) {
      fx.spikeShove(at.x, at.y, spikeTintOf(e.racerId), at.heading >= 0 ? 1 : -1, clock);
      if (e.line) {
        bubbles.spawn(e.targetId ?? e.racerId, e.line, v2?.tint ?? 0xcc7722, at.x, at.y - 64, clock);
      }
    }
  },
  'bristle:dodge': ({ fx, at, targetStarred, clock }) => {
    // 🦔 The chaser slipped past the spines (catwalk dodge / ⭐ star). The shared
    // dodge handler below raises the star-shield / cat shimmer; add a "헛가시"
    // whiff at the chaser unless a star deflected it (which has its own flash).
    if (at && !targetStarred) fx.whiff(at.x, at.y, clock);
  },
  'mimic:activate': ({ e, fx, bubbles, self, v, characterCatalog, charIdById, scheduleFx, clock }) => {
    // 🛸 Alien mimic SCAN marker (no effect of its own): the engine emits this
    // FIRST (targetId = the racer being copied), then the COPIED skill's own
    // events follow stamped with that skill's type (actor = alien) and carry
    // the real effect. So here we layer the scan/clone cue on the alien — holo
    // scan rings + ✨ — and put a "[기술명] copy!" head bubble on the alien so the
    // copy reads at a glance. The marker has no e.line; derive the copied skill
    // from targetId → characterId → catalog.skill.type (renderer-only).
    fx.scanCopy(self.x, self.y, v.tint, clock);
    const copiedType = e.targetId ? characterCatalog[charIdById.get(e.targetId) ?? '']?.skill.type : undefined;
    // The COPIED skill's own activate event (same frame, actor = alien) spawns
    // ITS line bubble on the alien via the e.line path above. Defer the "[기술명]
    // copy!" bubble to drainPendingFx (runs AFTER the whole event loop) so it
    // wins the per-owner dedupe and stays on the alien's head.
    if (copiedType) {
      const txt = mimicCopyBubble(copiedType);
      scheduleFx(clock, () => bubbles.spawn(e.racerId, txt, v.tint, self.x, self.y - 64, clock));
    }
  },
  'abduct:activate': ({ fx, self, dir, clock }) => {
    fx.speedLines(self.x, self.y - 6, dir, clock);
  },
  'abduct:hit': ({ e, fx, bubbles, self, v, at, v2, webTintOf, clock, curFrameIdx }) => {
    // 🕸️ Web connects: a silk strand snaps spider→target, the target is reeled
    // BACK behind the spider (its track spot is already demoted by the engine,
    // so by next frame it's drawn behind), and it lands tangled in web (a
    // sticky slow). The webPull yank + tangle read as "dragged the leader in".
    if (at && v2) {
      const webTint = webTintOf(e.racerId);
      // The reel-in tween was seeded at the top of renderFrame (reelFrom = the
      // target's pre-yank spot). Draw the silk strand + tangle FROM that same
      // origin so the web visibly grabs the target where it was and the body
      // slides down it to behind the spider. Display-only.
      const from = v2.reelFrom ?? { x: at.x, y: at.y };
      fx.webPull(self.x, self.y, from.x, from.y, webTint, clock);
      fx.webTangle(from.x, from.y, webTint, clock);
      bubbles.spawn(e.racerId, abductHitBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
    }
  },
  'abduct:dodge': ({ e, fx, bubbles, self, v, at, dir, targetStarred, webTintOf, clock, curFrameIdx }) => {
    if (at) {
      fx.webPull(self.x, self.y, at.x + dir * 24, at.y - 18, webTintOf(e.racerId), clock);
      if (!targetStarred) fx.whiff(at.x, at.y, clock);
      bubbles.spawn(e.racerId, abductDodgeBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
    }
  },
  'relay:handoff': ({ e, fx, self, v, at, v2, dir, clock }) => {
    // Baton from the finisher to the outgoing teammate, near the line.
    // Self-handoff (1-member team / cycle wrap, targetId === racerId): the
    // same runner takes the next leg. A zero-length baton just bobs in place,
    // so hop it forward into a tidy "one more loop!" toss + glow the actor.
    const selfHandoff = !at || e.targetId === e.racerId;
    const dst = selfHandoff ? { x: self.x + dir * 40, y: self.y - 6 } : { x: at!.x, y: at!.y - 6 };
    fx.baton(self.x, self.y - 6, dst.x, dst.y, clock);
    fx.dust(dst.x, dst.y + 20, clock);
    const v2g = selfHandoff ? v : v2;
    if (v2g) v2g.glowUntil = clock + 0.7;
  },
  'illusionClone:activate': ({ e, bubbles, self, v, clock, curFrameIdx }) => {
    bubbles.spawn(e.racerId, illusionActivateBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
  },
  'illusionClone:clone': ({ e, fx, self, v, config, curDecoys, posById, clock }) => {
    // 🦊 Decoys conjured: a magic poof on the gumiho (the activate beat already
    // raised its glow/pop + "허허…" bubble), plus a conjure poof landing on EACH
    // freshly-spawned decoy's spot so the two illusions visibly pop into being.
    const tint = v.tint;
    fx.smoke(self.x, self.y, tint, clock);
    if (config) {
      for (const d of curDecoys) {
        if (d.ownerId !== e.racerId) continue;
        const dp = posById.get(d.id);
        if (dp) fx.smoke(dp.x, dp.y, tint, clock);
      }
    }
  },
  'illusionClone:clonehit': ({ fx, self, clock }) => {
    // 🦊 A decoy bumped this racer → brief stun + confusion. Stars + a dizzy
    // swirl on the victim (the "어?" bubble is spawned by the e.line path above),
    // plus a lavender pop where the decoy struck (it's consumed on contact).
    fx.stars(self.x, self.y, clock);
    fx.dizzy(self.x, self.y, clock);
    fx.cloudPop(self.x, self.y, 0xb07bd6, clock);
  },
  'illusionClone:clonepop': ({ fx, self, clock }) => {
    // 🦊 A decoy intercepted an incoming disruption for the gumiho and popped:
    // a soft "퐁!" magical pop on the protected fox (its "퐁!" bubble comes from
    // the e.line path above). Reads as "a clone took the hit", not a stun.
    fx.cloudPop(self.x, self.y, 0xb07bd6, clock);
    fx.sparkle(self.x, self.y, clock);
  },
  'illusionClone:teleport': ({ fx, self, v, clock }) => {
    // 🦊 The clones expired and the fox blinked forward to its lead decoy's spot
    // (the engine already moved its progress, so `self` is the arrival spot): a
    // conjure poof + ⭐ glints + glow on the fox where it reappears. The
    // "스르르…퐁!" bubble comes from the e.line path above.
    fx.smoke(self.x, self.y, v.tint, clock);
    fx.cloudPop(self.x, self.y, 0xb07bd6, clock);
    fx.sparkle(self.x, self.y, clock);
    v.glowUntil = clock + 1.6;
  },
  'eliminate:out': ({ e, fx, bubbles, self, v, config, clock, curFrameIdx }) => {
    // 💀 Death-match knock-out at a lap boundary. Branch the emotion on the
    // mode: 선두탈락(first)이면 탈락=환호(sparkle/heart + 신난 버블), 꼴찌탈락(last)이면
    // 탈락=좌절(sweat/dizzy/dustSlump + 시무룩 버블). The held pose/FX at the centre
    // row are driven by placeEliminated; this is the impact-instant punch +
    // a head bubble. (e.line is empty for eliminate events, so spawn our own.)
    const mode = config.elimination === 'first' ? 'first' : 'last';
    bubbles.spawn(e.racerId, eliminationBubble(mode, curFrameIdx + e.racerId.length), v.tint, self.x, self.y - 64, clock);
    if (mode === 'first') {
      fx.sparkle(self.x, self.y, clock);
      fx.heart(self.x, self.y - 70, clock);
    } else {
      fx.sweat(self.x + 14, self.y - 52, clock);
      fx.dizzy(self.x, self.y, clock);
      fx.dustSlump(self.x, self.y, clock);
    }
  },
};

export function dispatchSkillEvent(ctx: SkillRenderCtx): void {
  const {
    e, posById, views, fx, bubbles, clock, curFrameIdx, charIdById,
    reducedMotion, starUntilById,
  } = ctx;
  const self = posById.get(e.racerId);
  const v = views.get(e.racerId);
  if (!v || !self) return;
  const at = e.targetId ? posById.get(e.targetId) : undefined;
  const v2 = e.targetId ? views.get(e.targetId) : undefined;
  if (e.line) bubbles.spawn(e.racerId, e.line, v.tint, self.x, self.y - 64, clock);
  // Renderer-only head-bubble overrides for dodge outcomes the engine/data can't
  // distinguish (engine emits a bare `*:dodge`; data lines stay generic). These
  // replace the same-owner bubble spawned just above (SpeechBubbleLayer.spawn
  // dedupes per owner), so the special tone wins without touching engine/data.
  if (e.variant === 'dodge') {
    // 원숭이 바나나가 빗나감 → 시전자 (원숭이) 머리 위 '실패' 버블.
    if (e.type === 'banana') {
      bubbles.spawn(e.racerId, bananaFailBubble(curFrameIdx), v.tint, self.x, self.y - 64, clock);
    }
    // 고양이가 회피 → 회피한 공격 종류로 냥펀치/캣워크 갈래 (고양이 머리 위).
    if (e.targetId && at && v2 && charIdById.get(e.targetId) === 'cat') {
      bubbles.spawn(e.targetId, catDodgeBubble(e.type, curFrameIdx), v2.tint, at.x, at.y - 64, clock);
    }
    // 펭귄이 빙판 위에서 무적 회피 → 펭귄 머리 위 '빙판 무적' 버블 + sparkle.
    if (e.targetId && at && v2 && charIdById.get(e.targetId) === 'penguin') {
      bubbles.spawn(e.targetId, penguinIceImmuneBubble(curFrameIdx), v2.tint, at.x, at.y - 64, clock);
      fx.sparkle(at.x, at.y, clock);
    }
  }
  // Highlight WHO is using the skill: glow halo + sparkles + an activation pop
  // on the actor. Hold the glow a touch longer so the eye has time to land on
  // who acted. Catwalk (cat immunity) glows for its whole immune window.
  v.glowUntil = clock + (e.type === 'catwalk' ? 2.0 : 1.6);
  if (!reducedMotion) {
    fx.sparkle(self.x, self.y, clock);
    // Snappy core+ring flash, but only on the firing beat (not hit/dodge
    // follow-ups) so the actor isn't double-popped.
    if (e.variant === 'activate') fx.pop(self.x, self.y, v.tint, clock);
  }
  if (reducedMotion) return;

  const dir = self.heading >= 0 ? 1 : -1;
  // A dodge where the TARGET is currently star-invincible is a "star deflect"
  // (the star no-sold the hit), not a cat catwalk slip. Branch the FX/glow.
  const targetStarred = e.variant === 'dodge' && !!e.targetId && (starUntilById.get(e.targetId) ?? -1) > curFrameIdx;

  const hctx: HandlerCtx = { ...ctx, self, v, at, v2, dir, targetStarred };
  SKILL_HANDLERS[`${e.type}:${e.variant}`]?.(hctx);

  // A shrugged-off disruption surfaces as a `<attacker>:dodge` (targetId = the
  // racer who No-Sold it). Two reasons it can be dodged:
  //  • Star invincibility → flash a ⭐ shield + glow on the (any) star racer.
  //  • Cat catwalk immunity → the cat's "냐옹" shimmer + brief glow.
  // (Commentary is left to the attacker's dodge line so the bar doesn't double up.)
  // The roar dodge has no switch case above, so its shield/shimmer is raised here.
  if (e.variant === 'dodge' && e.targetId && at && v2) {
    if (targetStarred) {
      if (e.type === 'roar') fx.starShield(at.x, at.y, clock); // roar has no case above
      v2.glowUntil = Math.max(v2.glowUntil, clock + 1.0);
    } else if (charIdById.get(e.targetId) === 'cat') {
      fx.sparkle(at.x, at.y, clock);
      v2.glowUntil = Math.max(v2.glowUntil, clock + 0.8);
    }
  }
}
