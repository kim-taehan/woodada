/**
 * In-game guide overlay. Renders docs/guide/character-guide.md, docs/guide/item-guide.md,
 * docs/guide/arena-guide.md, and docs/guide/mode-guide.md (single source of truth — edit
 * the docs and the in-game guide updates) into a modal with four tabs. Opened
 * from the setup screen's 📖 가이드 button.
 */
import { el } from '../dom.ts';
import { renderMarkdown } from '../markdown.ts';
import characterGuide from '../../../docs/guide/character-guide.md?raw';
import itemGuide from '../../../docs/guide/item-guide.md?raw';
import arenaGuide from '../../../docs/guide/arena-guide.md?raw';
import modeGuide from '../../../docs/guide/mode-guide.md?raw';

type Tab = 'characters' | 'items' | 'arena' | 'modes';

const imgBase = `${import.meta.env.BASE_URL}guide/`;
const html: Record<Tab, string> = {
  characters: renderMarkdown(characterGuide, { imgBase }),
  items: renderMarkdown(itemGuide, { imgBase }),
  arena: renderMarkdown(arenaGuide, { imgBase }),
  modes: renderMarkdown(modeGuide, { imgBase }),
};

/** Open the guide overlay on top of everything. Returns once appended. */
export function openGuide(initial: Tab = 'characters'): void {
  const body = el('div', { class: 'guide-body' });
  const charTab = el('button', { class: 'guide-tab', textContent: '🐾 캐릭터' });
  const itemTab = el('button', { class: 'guide-tab', textContent: '🎁 아이템' });
  const arenaTab = el('button', { class: 'guide-tab', textContent: '🏟️ 경기장' });
  const modeTab = el('button', { class: 'guide-tab', textContent: '🏁 모드' });

  const select = (tab: Tab): void => {
    body.innerHTML = html[tab];
    body.scrollTop = 0;
    charTab.classList.toggle('active', tab === 'characters');
    itemTab.classList.toggle('active', tab === 'items');
    arenaTab.classList.toggle('active', tab === 'arena');
    modeTab.classList.toggle('active', tab === 'modes');
  };
  charTab.addEventListener('click', () => select('characters'));
  itemTab.addEventListener('click', () => select('items'));
  arenaTab.addEventListener('click', () => select('arena'));
  modeTab.addEventListener('click', () => select('modes'));

  const close = el('button', { class: 'guide-close', textContent: '✕', title: '닫기' });
  const modal = el('div', { class: 'guide-modal' }, [
    el('div', { class: 'guide-head' }, [
      el('div', { class: 'guide-tabs' }, [charTab, itemTab, arenaTab, modeTab]),
      close,
    ]),
    body,
  ]);
  const overlay = el('div', { class: 'guide-overlay' }, [modal]);

  const dismiss = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') dismiss(); }

  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  document.addEventListener('keydown', onKey);

  select(initial);
  document.body.append(overlay);
}
