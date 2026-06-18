/**
 * Result overlay (spec §9). Highlights the winner, lists full standings, and
 * shows the lottery mapping (rank → participant → result) when present.
 */

import { el } from '../dom.ts';
import type { RaceConfig, RaceResult } from '../../engine/types.ts';
import type { ResultMapping } from '../../transport/types.ts';

export function buildResultScreen(
  result: RaceResult,
  config: RaceConfig,
  mapping: ResultMapping,
  onAgain: () => void,
  onNew: () => void,
): HTMLElement {
  const nameOf = (id: string) => config.participants.find((p) => p.id === id)?.name ?? id;

  const rows = result.order.map((id, i) => {
    const prize = mapping.byRank[i + 1];
    return el('li', { class: `rank-row${i === 0 ? ' first' : ''}` }, [
      el('span', { class: 'pos', textContent: `${i + 1}` }),
      el('span', { class: 'who', textContent: nameOf(id) }),
      ...(prize ? [el('span', { class: 'prize', textContent: prize })] : []),
    ]);
  });

  const again = el('button', { class: 'again', textContent: '다시하기 🔁' });
  again.addEventListener('click', onAgain);
  const newGame = el('button', { class: 'newgame', textContent: '설정으로 ⚙️' });
  newGame.addEventListener('click', onNew);

  const winnerLine = result.scoring.type === 'team'
    ? `우승 팀: ${result.scoring.order[0]}`
    : `1등 🏆 ${nameOf(result.order[0])}`;

  return el('div', { class: 'result-overlay' }, [
    el('div', { class: 'result-card' }, [
      el('h2', { textContent: '결과' }),
      el('div', { class: 'winner', textContent: winnerLine }),
      el('ul', { class: 'rank-list' }, rows),
      el('div', { class: 'result-actions' }, [again, newGame]),
    ]),
  ]);
}
