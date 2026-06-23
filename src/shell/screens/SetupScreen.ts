/**
 * Setup screen (spec §0, §5). Mode-first flow: pick 개인전/팀전 at the top; lap
 * count + team count + relay share one row; team mode splits input into per-team
 * boxes. Character pick is a <select> (scales as the roster grows). Pressing 추가
 * with an empty field registers a random name (still editable afterwards).
 */

import { el } from '../dom.ts';
import type { RoomStore } from '../store.ts';
import { defaultCharacterIds, characterCatalog } from '../../data/characters/index.ts';
import { eliminationOptions, gameModes, teamScoringOptions } from '../../data/modes.ts';
import { teamOrder, teamPalette, type TeamId } from '../../data/teams.ts';
import { randomName } from '../../data/names.ts';
import { trackCatalog, defaultArenaIds } from '../../data/tracks/index.ts';
import { openGuide } from './GuideOverlay.ts';

const CHAR_LABEL: Record<string, string> = { dog: '🐶', cat: '🐱', monkey: '🐒', eagle: '🦅', bear: '🐻', penguin: '🐧', hedgehog: '🦔', spider: '🕷️', alien: '🛸', fox: '🦊' };
const TEAM_EMOJI: Record<TeamId, string> = { red: '🔴', blue: '🔵', white: '⚪', black: '⚫' };

export function buildSetupScreen(store: RoomStore, onStart: () => void): HTMLElement {
  const startBtn = el('button', { class: 'start', textContent: '출발! 🏁' });
  const teamHint = el('p', { class: 'team-hint' });
  const participantsArea = el('div', { class: 'participants-area' });
  const resetBtn = el('button', { class: 'reset-all', textContent: '비우기 🗑️', title: '참가자 전체 삭제' });

  const isTeamMode = () => gameModes[store.modeId]?.team === true;
  let focusNew: TeamId | 'all' | null = null; // focus the just-added participant's name

  /** null = OK to start; otherwise a short guidance message. */
  function teamValidationError(): string | null {
    if (!isTeamMode()) return null;
    const active = teamOrder.slice(0, store.teamCount);
    const counts = store.teamCounts();
    const unassigned = store.drafts.filter((d) => !d.teamId || !active.includes(d.teamId)).length;
    if (unassigned > 0) return '모든 참가자가 팀에 들어가야 해요.';
    if (active.some((t) => (counts.get(t) ?? 0) === 0)) return '빈 팀이 없도록 한 명씩 넣어주세요.';
    return null; // relay legs cycle through each team, so uneven sizes are fine.
  }

  /** Character <select> for draft i — scales as the roster grows. */
  function charSelect(i: number): HTMLSelectElement {
    const sel = el('select', { class: 'char-select', ariaLabel: '캐릭터' }) as HTMLSelectElement;
    sel.append(el('option', { value: '', textContent: '🎲 랜덤' }));
    for (const id of defaultCharacterIds) {
      sel.append(el('option', { value: id, textContent: `${CHAR_LABEL[id] ?? ''} ${characterCatalog[id]?.name ?? id}`.trim() }));
    }
    sel.value = store.drafts[i]?.characterId ?? '';
    sel.addEventListener('change', () => store.setCharacter(i, sel.value || undefined));
    return sel;
  }

  /** One participant row: editable name + character select + remove. */
  function participantRow(i: number): HTMLElement {
    const d = store.drafts[i];
    const nameInput = el('input', { class: 'pname', type: 'text', value: d.name, ariaLabel: '참가자 이름' }) as HTMLInputElement;
    nameInput.addEventListener('input', () => store.setName(i, nameInput.value));
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

    const remove = el('button', { class: 'remove', textContent: '×', title: '삭제' });
    remove.addEventListener('click', () => { store.remove(i); refresh(); });

    return el('li', { class: 'participant' }, [nameInput, charSelect(i), remove]);
  }

  /** A single "+ 참가자 추가" button. Adds a random-named participant (editable
   * inline in the list) — no separate name field, which was confusing. */
  function addRow(teamId: TeamId | undefined): HTMLElement {
    const addBtn = el('button', { class: 'add-btn', textContent: '+ 참가자 추가' });
    addBtn.addEventListener('click', () => {
      store.addName(randomName(), teamId);
      focusNew = teamId ?? 'all';
      refresh();
    });
    return el('div', { class: 'name-row' }, [addBtn]);
  }

  function buildIndividual(): void {
    const list = el('ul', { class: 'participants' });
    store.drafts.forEach((_, i) => list.append(participantRow(i)));
    participantsArea.replaceChildren(addRow(undefined), list);
  }

  function buildTeams(): void {
    const active = teamOrder.slice(0, store.teamCount);
    const boxes = el('div', { class: 'team-boxes' });
    for (const t of active) {
      const pal = teamPalette[t];
      const swatch = el('span', { class: 'team-swatch' });
      swatch.style.background = pal.fill;
      swatch.style.borderColor = pal.trim;

      const memberList = el('ul', { class: 'participants' });
      store.drafts.forEach((d, i) => { if (d.teamId === t) memberList.append(participantRow(i)); });

      const box = el('div', { class: 'team-box' }, [
        el('div', { class: 'team-box-head' }, [swatch, el('span', { textContent: `${TEAM_EMOJI[t]} ${pal.label}` })]),
        addRow(t),
        memberList,
      ]) as HTMLElement;
      box.dataset.team = t;
      boxes.append(box);
    }
    participantsArea.replaceChildren(boxes);
  }

  function refresh(): void {
    if (isTeamMode()) buildTeams();
    else buildIndividual();

    if (focusNew) {
      const scope = focusNew === 'all'
        ? participantsArea
        : participantsArea.querySelector(`.team-box[data-team="${focusNew}"]`);
      const inputs = scope?.querySelectorAll<HTMLInputElement>('.participant .pname');
      const last = inputs && inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
      focusNew = null;
    }

    const teamErr = teamValidationError();
    startBtn.disabled = store.drafts.length < 2 || teamErr !== null;
    teamHint.textContent = teamErr ?? '';
    teamHint.style.display = teamErr ? '' : 'none';
    resetBtn.style.display = store.drafts.length ? '' : 'none';
    syncModeUI();
  }

  // ---- Mode toggle (개인전 / 팀전) at the very top ----
  const indivBtn = el('button', { class: 'mode-btn', textContent: '👤 개인전' });
  const teamBtn = el('button', { class: 'mode-btn', textContent: '👥 팀전' });
  indivBtn.addEventListener('click', () => { store.modeId = 'individual'; refresh(); });
  teamBtn.addEventListener('click', () => {
    if (!isTeamMode()) {
      store.modeId = 'team';
      store.autoAssign(); // spread existing names across teams
      store.seedTeamDefaults(); // top up each team to 2 so it's ready to start
    }
    refresh();
  });

  // ---- Lap count + team count + relay, sharing one row ----
  const lapsSelect = el('select', { ariaLabel: '바퀴 수' }) as HTMLSelectElement;
  for (let n = 1; n <= 10; n++) lapsSelect.append(el('option', { value: String(n), textContent: `${n}바퀴` }));
  lapsSelect.value = String(store.laps);
  lapsSelect.addEventListener('change', () => (store.laps = Number(lapsSelect.value)));

  // ---- Arena (track theme) pick: 🎲 랜덤 default + 6 named themes ----
  const arenaSelect = el('select', { ariaLabel: '경기장' }) as HTMLSelectElement;
  arenaSelect.append(el('option', { value: 'random', textContent: '🎲 랜덤' }));
  for (const id of defaultArenaIds) {
    const theme = trackCatalog[id];
    arenaSelect.append(el('option', { value: id, textContent: `${theme.emoji} ${theme.label}` }));
  }
  arenaSelect.value = store.arenaId;
  arenaSelect.addEventListener('change', () => (store.arenaId = arenaSelect.value));

  const teamCountSelect = el('select', { ariaLabel: '팀 수' }) as HTMLSelectElement;
  for (const n of [2, 3, 4]) teamCountSelect.append(el('option', { value: String(n), textContent: `${n}팀` }));
  teamCountSelect.value = String(store.teamCount);
  teamCountSelect.addEventListener('change', () => {
    store.setTeamCount(Number(teamCountSelect.value));
    if (isTeamMode()) store.seedTeamDefaults(); // newly added teams start with 2 members
    refresh();
  });

  // ---- Team scoring flavor (#28): 1등보유 / 등수합 / 이어달리기 ----
  const scoringSelect = el('select', { ariaLabel: '팀 모드' }) as HTMLSelectElement;
  for (const opt of teamScoringOptions) {
    scoringSelect.append(el('option', { value: opt.id, textContent: opt.label }));
  }
  scoringSelect.value = store.teamScoringId;
  scoringSelect.addEventListener('change', () => { store.teamScoringId = scoringSelect.value as typeof store.teamScoringId; });

  const teamGroup = el('span', { class: 'opt-group team-group' }, [
    el('label', { textContent: '팀 수' }), teamCountSelect,
    el('label', { textContent: '모드' }), scoringSelect,
  ]);

  // ---- Deathmatch (개인전): 일반전 / 선두탈락 / 꼴찌탈락 ----
  const elimSelect = el('select', { ariaLabel: '탈락 방식' }) as HTMLSelectElement;
  for (const opt of eliminationOptions) {
    elimSelect.append(el('option', { value: opt.id, textContent: opt.label }));
  }
  elimSelect.value = store.eliminationKind;
  elimSelect.addEventListener('change', () => { store.eliminationKind = elimSelect.value as typeof store.eliminationKind; });

  const elimGroup = el('span', { class: 'opt-group elim-group' }, [
    el('label', { textContent: '탈락' }), elimSelect,
  ]);

  function syncModeUI(): void {
    const team = isTeamMode();
    indivBtn.classList.toggle('active', !team);
    teamBtn.classList.toggle('active', team);
    teamGroup.style.display = team ? '' : 'none';
    elimGroup.style.display = team ? 'none' : ''; // deathmatch is individual-only
  }

  resetBtn.addEventListener('click', () => { store.clear(); refresh(); });

  // ---- Options (bulk paste, collapsed) ----
  const bulk = el('textarea', { placeholder: '여러 명 한 번에: 한 줄에 한 명, 또는 쉼표로 구분', rows: 3 });
  const bulkBtn = el('button', { class: 'chip', textContent: '일괄 등록' });
  bulkBtn.addEventListener('click', () => { store.addBulk(bulk.value); bulk.value = ''; refresh(); });

  const options = el('details', { class: 'options' }, [
    el('summary', { textContent: '옵션 (여러 명 붙여넣기)' }),
    el('div', { class: 'option-block' }, [el('label', { textContent: '여러 명 붙여넣기 (개인전)' }), bulk, bulkBtn]),
  ]);

  startBtn.addEventListener('click', () => { if (!startBtn.disabled) onStart(); });

  const guideBtn = el('button', { class: 'guide-btn', textContent: '📖 게임 가이드 (캐릭터·아이템)' });
  guideBtn.addEventListener('click', () => openGuide('characters'));

  const setupEl = el('div', { class: 'setup' }, [
    el('h1', { class: 'title' }, [el('span', { class: 'emoji', textContent: '🐾 ' }), '우다다']),
    el('p', { class: 'subtitle', textContent: '모드 고르고 → 이름 넣고 → 출발!' }),
    el('div', { class: 'guide-row' }, [guideBtn]),
    el('div', { class: 'mode-row' }, [indivBtn, teamBtn]),
    el('div', { class: 'opts-row' }, [
      el('span', { class: 'opt-group' }, [el('label', { textContent: '바퀴 수' }), lapsSelect]),
      el('span', { class: 'opt-group' }, [el('label', { textContent: '경기장' }), arenaSelect]),
      teamGroup,
      elimGroup,
    ]),
    participantsArea,
    el('div', { class: 'list-actions' }, [resetBtn]),
    teamHint,
    startBtn,
    options,
  ]);

  refresh();
  return el('div', { class: 'screen' }, [setupEl]);
}
