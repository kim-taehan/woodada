import type { PartModel } from './types.ts';
import { dogModel } from './dog.ts';
import { catModel } from './cat.ts';
import { monkeyModel } from './monkey.ts';
import { bearModel } from './bear.ts';
import { penguinModel } from './penguin.ts';
import { hedgehogModel } from './hedgehog.ts';
import { spiderModel } from './spider.ts';
import { alienModel } from './alien.ts';

export const partModels: Record<string, PartModel> = {
  dog: dogModel,
  cat: catModel,
  monkey: monkeyModel,
  bear: bearModel,
  penguin: penguinModel,
  hedgehog: hedgehogModel,
  spider: spiderModel,
  alien: alienModel,
};
