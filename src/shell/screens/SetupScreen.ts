/**
 * Setup screen (spec §0, §5). First paint shows only the name input + a big
 * 출발 button so a race can start in ~3 seconds; everything else is collapsed in
 * progressive-disclosure options. Names add on Enter or bulk paste.
 */

import { el } from '../dom.ts';
import type { RoomStore } from '../store.ts';
import { defaultCharacterIds, characterCatalog } from '../../data/characters/index.ts';
import { gameModes } from '../../data/modes.ts';
import { teamOrder, type TeamId } from '../../data/teams.ts';
import { randomName } from '../../data/names.ts';
import { buildResultMappingPanel } from './ResultMappingPanel.ts';

const CHAR_LABEL: Record<string, string> = { dog: '🐶', cat: '🐱', monkey: '🐒', eagle: '🦅', bear: '🐻', penguin: '🐧' };
const TEAM_EMOJI: Record<TeamId, string> = { red: '🔴', blue: '🔵', white: '⚪', black: '⚫' };

export function buildSetupScreen(store: RoomStore, onStart: () => void): HTMLElement {
  const list = el('ul', { class: 'participants' });
  const startBtn = el('button', { class: 'start', textContent: '출발! 🏁' });
  const teamHint = el('p', { class: 'team-hint' });
  const mappingPanel = buildResultMappingPanel(store) as HTMLElement & { rebuild?: () => void };

  const isTeamMode = () => gameModes[store.modeId]?.team === true;

  /** null = OK to start; otherwise a short guidance message. */
  function teamValidationError(): string | null {
    if (!isTeamMode()) return null;
    const active = teamOrder.slice(0, store.teamCount);
    const counts = store.teamCounts();
    const unassigned = store.drafts.filter((d) => !d.teamId || !active.includes(d.teamId)).length;
    if (unassigned > 0) return '모든 참가자를 팀에 배정해 주세요.';
    const sizes = [...counts.values()];
    if (sizes.some((c) => c === 0)) return '빈 팀이 없도록 한 명씩 배정해 주세요.';
    // Relay legs cycle through each team's members for `laps` legs, so uneven
    // team sizes are still fair — no equal-size requirement.
    return null;
  }

  function refresh(): void {
    list.replaceChildren();
    const teamMode = isTeamMode();
    const active = teamOrder.slice(0, store.teamCount);
    store.drafts.forEach((d, i) => {
      const chips = el('div', { class: 'chips' });
      const mk = (id: string | undefined, label: string) => {
        const isActive = d.characterId === id;
        const chip = el('button', { class: `chip${isActive ? ' active' : ''}`, textContent: label });
        chip.addEventListener('click', () => {
          store.setCharacter(i, id);
          refresh();
        });
        return chip;
      };
      chips.append(mk(undefined, '랜덤'));
      for (const id of defaultCharacterIds) chips.append(mk(id, CHAR_LABEL[id] ?? characterCatalog[id].name));

      const remove = el('button', { class: 'remove', textContent: '×', title: '삭제' });
      remove.addEventListener('click', () => {
        store.remove(i);
        refresh();
      });

      const controls = el('div', { class: 'participant-controls' }, [chips]);
      if (teamMode) {
        const teamChips = el('div', { class: 'chips team-chips' });
        for (const t of active) {
          const isActive = d.teamId === t;
          const chip = el('button', {
            class: `chip team-chip${isActive ? ' active' : ''}`,
            textContent: TEAM_EMOJI[t],
            title: t,
          });
          chip.addEventListener('click', () => {
            store.setTeam(i, t);
            refresh();
          });
          teamChips.append(chip);
        }
        controls.append(teamChips);
      }
      controls.append(remove);

      const nameInput = el('input', {
        class: 'pname',
        type: 'text',
        value: d.name,
        ariaLabel: '참가자 이름',
      }) as HTMLInputElement;
      // Live-update the store; no refresh() so the field keeps focus while typing.
      nameInput.addEventListener('input', () => store.setName(i, nameInput.value));
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });

      list.append(el('li', { class: 'participant' }, [nameInput, controls]));
    });

    const teamErr = teamValidationError();
    startBtn.disabled = store.drafts.length < 2 || teamErr !== null;
    teamHint.textContent = teamErr ?? '';
    teamHint.style.display = teamErr ? '' : 'none';
    resetBtn.style.display = store.drafts.length ? '' : 'none';
    mappingPanel.rebuild?.();
  }

  const input = el('input', { type: 'text', placeholder: randomName(), ariaLabel: 'participant name' });
  const addBtn = el('button', { textContent: '추가' });
  const commit = () => {
    const raw = input.value;
    if (raw.includes('\n') || raw.includes(',')) {
      store.addBulk(raw);
    } else {
      // Empty input → register with the random placeholder name (quick testing).
      store.addName(raw.trim() || input.placeholder);
    }
    input.value = '';
    input.placeholder = randomName(); // roll a fresh suggestion
    refresh();
    input.focus();
  };
  input.addEventListener('keydown', (e) => {
    // Ignore the Enter that confirms an IME composition (Korean/Japanese input);
    // otherwise "심상준" + Enter double-adds "심상준" and the trailing "준".
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      commit();
    }
  });
  addBtn.addEventListener('click', commit);

  // Clear all participants on demand (returning from a race keeps them otherwise).
  const resetBtn = el('button', { class: 'reset-all', textContent: '비우기 🗑️', title: '참가자 전체 삭제' });
  resetBtn.addEventListener('click', () => {
    store.clear();
    refresh();
  });

  startBtn.addEventListener('click', () => {
    if (!startBtn.disabled) onStart();
  });

  // Options (progressive disclosure)
  const bulk = el('textarea', { placeholder: '여러 명 한 번에: 한 줄에 한 명, 또는 쉼표로 구분', rows: 3 });
  const bulkBtn = el('button', { class: 'chip', textContent: '일괄 등록' });
  bulkBtn.addEventListener('click', () => {
    store.addBulk(bulk.value);
    bulk.value = '';
    refresh();
  });

  const modeSelect = el('select');
  for (const m of Object.values(gameModes)) modeSelect.append(el('option', { value: m.id, textContent: m.label }));
  modeSelect.value = store.modeId;

  // Team controls — only visible in team mode.
  const teamCountSelect = el('select');
  for (const n of [2, 3, 4]) teamCountSelect.append(el('option', { value: String(n), textContent: `${n}팀` }));
  teamCountSelect.value = String(store.teamCount);
  teamCountSelect.addEventListener('change', () => {
    store.setTeamCount(Number(teamCountSelect.value));
    refresh();
  });

  const autoBtn = el('button', { class: 'chip', textContent: '자동 편성 🎲' });
  autoBtn.addEventListener('click', () => {
    store.autoAssign();
    refresh();
  });

  const relayCheck = el('input', { type: 'checkbox', ariaLabel: 'relay' }) as HTMLInputElement;
  relayCheck.checked = store.relay;
  relayCheck.addEventListener('change', () => {
    store.relay = relayCheck.checked;
    refresh();
  });
  const relayToggle = el('label', { class: 'relay-toggle' }, [relayCheck, '🔁 릴레이 (이어달리기)']);

  const teamBlock = el('div', { class: 'option-block team-block' }, [
    el('label', { textContent: '팀 나누기' }),
    el('div', { class: 'team-controls' }, [teamCountSelect, autoBtn]),
    relayToggle,
  ]);

  const syncTeamBlock = () => {
    teamBlock.style.display = isTeamMode() ? '' : 'none';
  };

  modeSelect.addEventListener('change', () => {
    store.modeId = modeSelect.value;
    // Switching into team mode: start with no empty teams.
    if (isTeamMode()) store.autoAssign();
    syncTeamBlock();
    refresh();
  });

  const lapsSelect = el('select');
  for (let n = 1; n <= 10; n++) lapsSelect.append(el('option', { value: String(n), textContent: `${n}바퀴` }));
  lapsSelect.value = String(store.laps);
  lapsSelect.addEventListener('change', () => (store.laps = Number(lapsSelect.value)));

  const options = el('details', { class: 'options' }, [
    el('summary', { textContent: '옵션 (캐릭터·결과 추첨·모드)' }),
    el('div', { class: 'option-block' }, [
      el('label', { textContent: '여러 명 붙여넣기' }),
      bulk,
      bulkBtn,
    ]),
    el('div', { class: 'option-block' }, [el('label', { textContent: '게임 모드' }), modeSelect]),
    teamBlock,
    el('div', { class: 'option-block' }, [el('label', { textContent: '바퀴 수' }), lapsSelect]),
    mappingPanel,
  ]);

  const screen = el('div', { class: 'screen' }, [
    el('div', { class: 'setup' }, [
      el('h1', { class: 'title' }, [el('span', { class: 'emoji', textContent: '🐾 ' }), '우다다']),
      el('p', { class: 'subtitle', textContent: '이름 넣고 → 출발 → 결과! 귀여운 동물 경주 추첨' }),
      el('div', { class: 'name-row' }, [input, addBtn]),
      list,
      el('div', { class: 'list-actions' }, [resetBtn]),
      teamHint,
      startBtn,
      options,
    ]),
  ]);

  syncTeamBlock();
  refresh();
  queueMicrotask(() => input.focus());
  return screen;
}
