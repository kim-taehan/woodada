/**
 * Result overlay (spec §9). Highlights the winner, lists full standings, and
 * shows the lottery mapping (rank → participant → result) when present.
 */

import { el } from '../dom.ts';
import type { RaceConfig, RaceResult } from '../../engine/types.ts';
import type { ResultMapping } from '../../transport/types.ts';
import { teamPalette, type TeamId } from '../../data/teams.ts';
import { formatSeconds, type RecordOutcome } from '../records.ts';

export function buildResultScreen(
  result: RaceResult,
  config: RaceConfig,
  mapping: ResultMapping,
  record: RecordOutcome,
  onAgain: () => void,
  onNew: () => void,
): HTMLElement {
  const nameOf = (id: string) => config.participants.find((p) => p.id === id)?.name ?? id;

  const isTeam = result.scoring.type === 'team';
  // Team mode: show team standings (1 레드, 2 블루 …), not the per-racer order.
  const rows = isTeam
    ? result.scoring.order.map((teamId, i) => {
        const pal = teamPalette[teamId as TeamId];
        const swatch = el('span', { class: 'team-swatch' });
        if (pal) { swatch.style.background = pal.fill; swatch.style.borderColor = pal.trim; }
        return el('li', { class: `rank-row${i === 0 ? ' first' : ''}` }, [
          el('span', { class: 'pos', textContent: `${i + 1}` }),
          swatch,
          el('span', { class: 'who', textContent: pal?.label ?? teamId }),
        ]);
      })
    : result.order.map((id, i) => {
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

  const winnerLine = isTeam
    ? `우승 팀: ${teamPalette[result.scoring.order[0] as TeamId]?.label ?? result.scoring.order[0]}`
    : `1등 🏆 ${nameOf(result.order[0])}`;

  // ---- Records (Feature B): this race's time + best on record. ----
  const recordPanel = el('div', { class: `records${record.isNew ? ' record-new' : ''}` }, [
    el('div', { class: 'record-row' }, [
      el('span', { class: 'record-label', textContent: '이번 기록' }),
      el('span', { class: 'record-time', textContent: `${formatSeconds(record.timeMs)}초` }),
    ]),
    el('div', { class: 'record-row' }, [
      el('span', { class: 'record-label', textContent: '최고 기록' }),
      el('span', { class: 'record-time best', textContent: `${formatSeconds(record.bestMs)}초` }),
    ]),
  ]);
  const banner = record.isNew
    ? el('div', { class: 'record-banner', textContent: '🎉 세계 신기록 달성!' })
    : null;

  const card = el('div', { class: 'result-card' }, [
    el('h2', { textContent: '결과' }),
    el('div', { class: 'winner', textContent: winnerLine }),
    ...(banner ? [banner] : []),
    recordPanel,
    el('ul', { class: 'rank-list' }, rows),
    el('div', { class: 'result-actions' }, [again, newGame]),
  ]);

  const children: HTMLElement[] = [card];
  // World-record confetti: a pure DOM/CSS particle burst layered behind the
  // card (renderer/Pixi untouched), so it celebrates without hiding the table.
  if (record.isNew) children.unshift(buildConfetti());

  return el('div', { class: 'result-overlay' }, children);
}

/** DOM/CSS confetti layer (Feature B). 40 colored petals fall + spin once. */
function buildConfetti(): HTMLElement {
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7aa2'];
  const pieces: HTMLElement[] = [];
  for (let i = 0; i < 40; i++) {
    const piece = el('span', { class: 'confetti-piece' });
    piece.style.left = `${(i / 40) * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${(i % 10) * 0.12}s`;
    piece.style.animationDuration = `${1.6 + (i % 5) * 0.25}s`;
    pieces.push(piece);
  }
  return el('div', { class: 'confetti' }, pieces);
}
