import type { CharacterCatalog } from '../schema.ts';
import { dog } from './dog.ts';
import { cat } from './cat.ts';
import { monkey } from './monkey.ts';
import { eagle } from './eagle.ts';
import { bear } from './bear.ts';
import { penguin } from './penguin.ts';

/** Active characters. */
export const characterCatalog: CharacterCatalog = { dog, cat, monkey, eagle, bear, penguin };

/** Ids available for random assignment + selection in the shell. */
export const defaultCharacterIds = ['dog', 'cat', 'monkey', 'eagle', 'bear', 'penguin'] as const;

export { dog, cat, monkey, eagle, bear, penguin };
