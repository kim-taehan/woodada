import type { SkillHandler } from './types.ts';

/**
 * 외계인 의태 스캔 (mimic, 변수형 카피): the alien scans the *nearest* racer
 * (by |progress - self|, any team, excluding finished/waiting and itself) within
 * `scanRange`, copies THAT racer's skill type + params, and fires the copied
 * handler with the ALIEN as `self`. The alien has no fixed effect of its own — a
 * variable wildcard whose outcome swings with whoever it scans.
 *
 * Copy dispatch + recursion/reaction guards live in the engine (`ctx.invokeSkill`),
 * which owns the skill registry. `invokeSkill(type, paramsOverride)` returns:
 *   - false  → the type is UNCOPYABLE (reactive-only like hedgehog 'bristle', which
 *              has no self-activation tick and never fires on a scan; or 'mimic'
 *              itself — copying mimic would recurse, so it is refused), OR the
 *              copied handler ran but HELD (emitted nothing, e.g. its own target
 *              was out of range).
 *   - true   → the copied handler fired (emitted ≥1 event) with the alien as actor.
 * The copied events are stamped with the COPIED type so commentary / the renderer
 * read them as "the alien used <that skill>" (actor = alien). Any RNG the copied
 * skill draws comes from an alien-only stable sub-stream (inside invokeSkill), so
 * the scanned racer's own stream is never polluted and the draw order stays stable.
 *
 * Single target, no fallback (divebomb pattern, YAGNI): the alien looks only at
 * the ONE nearest racer in range. If that racer's skill is uncopyable (reaction-only
 * like 'bristle' — no self-activation tick — or 'mimic' itself, a recursion guard,
 * tested up front via `ctx.canCopySkill`), this tick simply HOLDS: emit NOTHING →
 * the engine reads 'declined to fire' and retries on RETRY_COOLDOWN_MS. Selection is
 * fully deterministic (nearest by progress gap, id tie-break, no RNG) and the
 * recursion/reaction refusal is a pure registry lookup, so mimic can never recurse
 * or chain.
 *
 * On a copyable target the alien emits a "따라하기" MARKER first — type 'mimic',
 * variant 'activate', targetId = the copied skill's original owner — so the renderer
 * can play a scan cue + caption "외계인이 {owner}의 {그 스킬}을 따라한다!" (it derives
 * the copied skill from targetId → characterId → catalog). The copied handler's own
 * effect events (stamped with the copied type) follow the marker. The marker is a
 * pure emit (no RNG), so determinism / sub-stream isolation are unaffected.
 */
export const mimicHandler: SkillHandler = (ctx) => {
  const { self, all, params } = ctx;
  const scanRange = Number(params.scanRange ?? Infinity);

  // The single nearest racer in range (absolute progress gap; id tie-break, no RNG).
  let target: typeof all[number] | undefined;
  for (const r of all) {
    if (r.id === self.id || r.phase === 'finished' || r.phase === 'waiting' || r.phase === 'eliminated') continue;
    const gap = Math.abs(r.progress - self.progress);
    if (gap > scanRange) continue;
    if (
      !target ||
      gap < Math.abs(target.progress - self.progress) ||
      (gap === Math.abs(target.progress - self.progress) && r.id < target.id)
    ) {
      target = r;
    }
  }
  if (!target) return; // nobody in range → hold

  const copiedType = ctx.skillTypeOf(target.id);
  const copiedParams = ctx.skillParamsOf(target.id);
  if (!copiedType || !copiedParams) return; // unknown character → hold
  // The nearest racer's skill is uncopyable (reaction-only / mimic) → hold (no
  // fallback). Checked up front (pure registry) so we only emit the marker for a
  // target we can actually copy, and the marker stays the FIRST event of the copy.
  if (!ctx.canCopySkill(copiedType)) return;

  // "따라하기" marker FIRST (type 'mimic', actor = alien): targetId = the copied
  // skill's original owner. The renderer derives the copied skill from
  // targetId → characterId → catalog, so no extra field / line is needed here.
  // No RNG — emit only.
  ctx.emit({ variant: 'activate', targetId: target.id });

  // Then the copied handler runs AS the alien (its effect events are stamped with
  // copiedType and follow the marker). It may still hold internally (e.g. abduct
  // with no target of its own) — that's fine; the scan marker already activated.
  ctx.invokeSkill(copiedType, copiedParams);
};
