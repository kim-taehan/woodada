import type { PartModel } from './types.ts';
import { dogModel } from './dog.ts';
import { catModel } from './cat.ts';
import { monkeyModel } from './monkey.ts';
import { eagleModel } from './eagle.ts';
import { bearModel } from './bear.ts';
import { penguinModel } from './penguin.ts';
import { hedgehogModel } from './hedgehog.ts';

export const partModels: Record<string, PartModel> = {
  dog: dogModel,
  cat: catModel,
  monkey: monkeyModel,
  eagle: eagleModel,
  bear: bearModel,
  penguin: penguinModel,
  hedgehog: hedgehogModel,
};
