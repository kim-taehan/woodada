import type { CharacterCatalog } from '../schema.ts';
import { dog } from './dog.ts';
import { cat } from './cat.ts';
import { monkey } from './monkey.ts';
import { bear } from './bear.ts';
import { penguin } from './penguin.ts';
import { hedgehog } from './hedgehog.ts';
import { spider } from './spider.ts';
import { alien } from './alien.ts';

/** Active characters. */
export const characterCatalog: CharacterCatalog = { dog, cat, monkey, bear, penguin, hedgehog, spider, alien };

/** Ids available for random assignment + selection in the shell. */
export const defaultCharacterIds = ['dog', 'cat', 'monkey', 'bear', 'penguin', 'hedgehog', 'spider', 'alien'] as const;

export { dog, cat, monkey, bear, penguin, hedgehog, spider, alien };
