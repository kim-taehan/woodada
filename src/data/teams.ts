/**
 * Team palette — single source of truth for team colors (spec §2, §4).
 * Renderer (vest overlay) and shell (team chips) both consume this.
 * `fill` = vest color; `trim` = readability outline for low-contrast vests.
 */

export type TeamId = 'red' | 'blue' | 'white' | 'black';

export interface TeamPalette {
  id: TeamId;
  label: string;
  /** Vest fill color. */
  fill: string;
  /** Outline/trim for background contrast (esp. white/black). */
  trim: string;
}

export const teamPalette: Record<TeamId, TeamPalette> = {
  red: { id: 'red', label: '레드', fill: '#E2483D', trim: '#8E2A23' },
  blue: { id: 'blue', label: '블루', fill: '#2F6BE0', trim: '#1C3F87' },
  white: { id: 'white', label: '화이트', fill: '#F4F4F4', trim: '#444444' },
  black: { id: 'black', label: '블랙', fill: '#2B2B2B', trim: '#DDDDDD' },
};

export const teamOrder: TeamId[] = ['red', 'blue', 'white', 'black'];
