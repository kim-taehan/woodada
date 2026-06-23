/**
 * Character Preview Screen - 캐릭터 미리보기 오버레이
 * 
 * Setup 화면에서 접근 가능한 오버레이 UI
 * 캐릭터 선택, 팀 선택, 실시간 미리보기 제공
 */

import { el } from '../dom';
import { characterCatalog, defaultCharacterIds } from '../../data/characters';
import { teamOrder, teamPalette, type TeamId } from '../../data/teams';
import type { Palette } from '../../data/schema';

const CHAR_LABEL: Record<string, string> = {
  dog: '🐶', cat: '🐱', monkey: '🐒', bear: '🐻',
  penguin: '🐧', hedgehog: '🦔', spider: '🕷️', alien: '👽', fox: '🦊'
};

const TEAM_EMOJI: Record<TeamId, string> = { red: '🔴', blue: '🔵', white: '⚪', black: '⚫' };

interface CharacterPreviewRenderer {
  setCharacter(characterId: string, palette: Palette, runStyle: string, teamId?: TeamId): void;
  updateCharacter(phase: 'idle' | 'running' | 'celebrate', speedNorm: number): void;
  destroy(): void;
}

export interface CharacterPreviewScreen {
  element: HTMLElement;
  close(): void;
  setCharacter(id: string): void;
  setTeam(teamId?: TeamId): void;
}

export function buildCharacterPreviewScreen(
  onClose: () => void
): CharacterPreviewScreen {
  const canvasHost = el('div', { class: 'preview-canvas-host' });

  // 캐릭터 선택 드롭다운
  const charSelect = el('select', { class: 'preview-char-select', ariaLabel: '캐릭터 선택' }) as HTMLSelectElement;
  for (const id of defaultCharacterIds) {
    const char = characterCatalog[id];
    charSelect.append(el('option', {
      value: id,
      textContent: `${CHAR_LABEL[id]} ${char.name}`
    }));
  }

  // 팀 선택 드롭다운
  const teamSelect = el('select', { class: 'preview-team-select', ariaLabel: '팀 선택' }) as HTMLSelectElement;
  teamSelect.append(el('option', { value: '', textContent: '팀 없음' }));
  for (const teamId of teamOrder) {
    const pal = teamPalette[teamId];
    teamSelect.append(el('option', {
      value: teamId,
      textContent: `${TEAM_EMOJI[teamId]} ${pal.label}`
    }));
  }

  // 닫기 버튼
  const closeBtn = el('button', { class: 'preview-close', title: '닫기 (ESC)', textContent: '✕' });

  // 모달 헤더
  const header = el('div', { class: 'preview-header' }, [
    el('h2', { textContent: '🐾 캐릭터 미리보기' }),
    closeBtn
  ]);

  // 컨트롤 패널
  const controls = el('div', { class: 'preview-controls' }, [
    el('label', { textContent: '캐릭터: ' }, [charSelect]),
    el('label', { textContent: '팀: ' }, [teamSelect])
  ]);

  // 모달 본체
  const modal = el('div', { class: 'preview-modal' }, [
    header,
    canvasHost,
    controls
  ]);

  // 오버레이
  const overlay = el('div', { class: 'character-preview-overlay' }, [modal]);

  // 렌더러 인스턴스
  let previewRenderer: CharacterPreviewRenderer | null = null;

  // 이벤트 리스너
  closeBtn.addEventListener('click', onClose);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });

  charSelect.addEventListener('change', () => {
    const charId = charSelect.value;
    if (charId && previewRenderer) {
      const char = characterCatalog[charId];
      const teamId = (teamSelect.value as TeamId) || undefined;
      previewRenderer.setCharacter(charId, char.palette, char.runStyle, teamId);
    }
  });

  teamSelect.addEventListener('change', () => {
    const charId = charSelect.value;
    const teamId = (teamSelect.value as TeamId) || undefined;
    if (charId && previewRenderer) {
      const char = characterCatalog[charId];
      previewRenderer.setCharacter(charId, char.palette, char.runStyle, teamId);
    }
  });

  teamSelect.addEventListener('change', () => {
    const charId = charSelect.value;
    const teamId = (teamSelect.value as TeamId) || undefined;
    if (charId && previewRenderer) {
      const char = characterCatalog[charId];
      previewRenderer.setCharacter(charId, char.palette, char.runStyle, teamId);
    }
  });

  // ESC 키로 닫기
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', onKey);

  // 렌더러 초기화 (비동기)
  async function initRenderer() {
    try {
      const { CharacterPreviewRenderer: CPR } = await import('../../renderer/character/CharacterPreviewRenderer');
      const renderer = new CPR(canvasHost);
      await renderer.init();
      previewRenderer = renderer;

      // 기본 캐릭터 로드 (dog)
      charSelect.value = 'dog';
      const dog = characterCatalog['dog'];
      const initialTeam = (teamSelect.value as TeamId) || undefined;
      previewRenderer.setCharacter('dog', dog.palette, dog.runStyle, initialTeam);
    } catch (error) {
      console.error('Failed to initialize preview renderer:', error);
    }
  }

  initRenderer();

  return {
    element: overlay,
    close: onClose,
    setCharacter: (id) => {
      charSelect.value = id;
      if (previewRenderer) {
        const char = characterCatalog[id];
        const teamId = (teamSelect.value as TeamId) || undefined;
        previewRenderer.setCharacter(id, char.palette, char.runStyle, teamId);
      }
    },
    setTeam: (teamId) => {
      teamSelect.value = teamId || '';
      if (previewRenderer && charSelect.value) {
        const char = characterCatalog[charSelect.value];
        previewRenderer.setCharacter(charSelect.value, char.palette, char.runStyle, teamId);
      }
    }
  };
}
