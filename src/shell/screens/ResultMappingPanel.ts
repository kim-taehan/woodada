/**
 * Optional lottery mapping (spec §6). Toggled inside the options; maps each rank
 * to a result text. Empty entries mean "show rank only".
 */

import { el } from '../dom.ts';
import type { RoomStore } from '../store.ts';

export function buildResultMappingPanel(store: RoomStore): HTMLElement {
  const grid = el('div', { class: 'mapping-grid' });

  function rebuild(): void {
    grid.replaceChildren();
    const n = Math.max(store.drafts.length, 2);
    for (let rank = 1; rank <= n; rank++) {
      const input = el('input', {
        type: 'text',
        placeholder: `${rank}등 결과 (예: 커피 쏘기)`,
        value: store.resultMapping.byRank[rank] ?? '',
      });
      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (v) store.resultMapping.byRank[rank] = v;
        else delete store.resultMapping.byRank[rank];
      });
      grid.append(el('div', { textContent: `${rank}등` }), input);
    }
  }

  rebuild();

  const wrap = el('div', { class: 'option-block' }, [
    el('label', { textContent: '결과 입력 (순위별 추첨 결과)' }),
    grid,
  ]);
  // expose rebuild so the setup screen can refresh when participant count changes
  (wrap as HTMLElement & { rebuild?: () => void }).rebuild = rebuild;
  return wrap;
}
