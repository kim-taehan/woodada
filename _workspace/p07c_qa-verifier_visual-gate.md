# p07c — QA visual gate: #7 reactive skill hooks (onOvertaken / bristle)

Branch: `polish/reactive-hooks` · Date: 2026-06-20 · Verdict: **PASS (green, no regression)**

## Scope
#7 made bristle (고슴도치) reactive: cooldown-scan self-activation → engine `onOvertaken`
hook fired at the real overtake moment. SkillEvent variant/phase unchanged (no FX code
change). Expectation: bristle-roster progress absolutes shift → hedgehog golden shots drift.

## Environment workaround (no permanent config change)
- Port 5173 was occupied by another project (aung-daung — `curl` title "아웅다웅 — 동물 영웅 택틱스").
  Committed `playwright.config.ts` has `reuseExistingServer: true` → would have tested the WRONG app.
- 5180 also busy. Started woodada dev server on **5190** (`vite --port 5190 --strictPort`).
- Ran via a **throwaway in-repo config** (`playwright.tmp-5190.config.ts`, baseURL 5190, no webServer
  block) — deleted after the run. `playwright.config.ts` is **unmodified** (verified `git diff` empty).
  (A /tmp config failed module resolution for `@playwright/test`; config must live in the repo root.)

## Gates run
1. `npm run test` → **49/49 passed** (8 files). schema 3/3, skills 10/10 — active skill set
   unchanged as expected. engine-bias 1/3/10-lap green. determinism 4/4.
2. `npm run typecheck` → clean (0 errors).
3. `npx playwright test race-visual.spec.ts --project=desktop` (via tmp 5190 config) → **5/5 passed**.

## Key architectural fact (drives the verdict)
- The e2e spec writes screenshots as **plain `page.screenshot()` artifacts**, NOT Playwright
  `toHaveScreenshot`/`toMatchSnapshot` goldens. There is **no golden-comparison assertion** to fail.
  "Rebasing the golden" = re-running the spec to refresh the `__screens__/` PNGs, then committing.
- These PNGs are **not byte-reproducible** even on a fixed seed/frame: re-running the
  `reduced-motion` capture (no FX particles) twice produced two different md5s. The byte drift is
  renderer-level wall-clock timing (Pixi paint / idle-bob animation phase / AA), pre-existing and
  unrelated to #7. → **byte-diff of these shots is meaningless for detecting #7; only the visual
  content + engine-invariance argument matter.**

## Why hedgehog-FREE shots also changed (roar uses ['bear','dog','cat','monkey','penguin','eagle'])
Not a regression. `fireOvertakeHooks` early-continues for any racer whose skill has no
`onOvertaken` reaction, and **bristle is the only reaction skill** (`grep -rln onOvertaken`
→ only bristle.ts). With zero reaction owners the hook is a no-op, so the hedgehog-free roar
race is engine-identical to HEAD; its PNG drift is the renderer timing noise above.

## Visual audit (Read on __screens__/)
Hedgehog chibi drawn correctly as the side-profile prone/gallop form WITH spines in every shot
(start / mid / finish / lastlap / finish-scatter / activation). No facing or broken-render issues.

- **race-zoomies-activate** (filename = captured event-key; content = a bristle beat): hedgehog
  glow + ✨ + bubble **"따끔! 붙지 마!"**, subtitle **"고슴도치7 가시 카운터! 따라붙던 원숭이4 뒤로 톡 ㅋㅋ"**.
  → bristle FX fires AT the overtake moment against the REAL passer (monkey4). This is the #7 win.
- **race-banana-hit**: second bristle counter at the finish straight — hedgehog glow/✨ + same
  bubble, side-profile + spines. Penguin zoomies bubble intact.
- **race-start / mid / finish / lastlap**: 7-racer roster incl. 고슴도치7; zoomies glow, item box,
  commentary, finish star-burst, "마지막 바퀴!" banner + bell + 2/2 lap counter, top-3 HUD — all intact.
- **race-roar-hit**: bear shockwave + dizzy victims, 6-racer (no-hedgehog) roster — correct.
- **race-divebomb-hit**: roar + icefield band + caught racers — correct.
- **finish-scatter / reduced-motion**: correct field, all racers incl. hedgehog rendered.

No unintended regression in any other character's render or FX.

## Golden "rebase" (refreshed screenshot artifacts — all visually correct)
26 PNGs under `tests/e2e/__screens__/` regenerated & verified, left as modified for commit:
race-{start,mid,finish,busiest,lastlap,finish-scatter,reduced-motion}, race-{zoomies,catwalk,
banana-activate,banana-hit,roar-activate,roar-hit,icefield-activate,icefield-laid}, race-divebomb-
{activate,rise,apex,hit,impact,self}, race-cat-icehop-{apex,low}, race-curve-{top,left}, race-penguin-slide.

## Caveat for main
The filename `race-zoomies-activate` now contains BRISTLE FX (the captured frame for the
`zoomies:activate` event-key landed on a bristle beat after the progress shift). Harmless artifact
naming, not a bug. If a dedicated bristle proof shot is wanted, the spec could add a `bristle:hit`
key to the captures list (renderer/spec follow-up, out of scope for this gate).

## Result
typecheck ✅ · unit 49/49 ✅ · e2e 5/5 ✅ · visual ✅ · engine-invariance for non-reaction rosters ✅.
No regression. Golden artifacts refreshed and correct.
