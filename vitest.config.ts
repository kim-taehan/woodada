import { configDefaults, defineConfig } from 'vitest/config';

// engine-bias runs ~4,200 full-race sims (~5 min) — a statistical fairness gate,
// not a unit test. It is excluded from the default `npm run test` loop and runs
// via `npm run test:stats` (STATS=1), which balance work must still pass.
const statsRun = !!process.env.STATS;

export default defineConfig({
  test: {
    environment: 'node',
    include: statsRun ? ['tests/unit/engine-bias.test.ts'] : ['tests/unit/**/*.test.ts'],
    exclude: statsRun ? [...configDefaults.exclude] : [...configDefaults.exclude, 'tests/unit/engine-bias.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
    },
  },
});
