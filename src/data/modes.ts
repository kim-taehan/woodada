import type { GameMode } from './schema.ts';

/**
 * Game modes (spec §1). Two modes: individual and team.
 * Team count & relay toggle live at runtime (RoomStore/RaceConfig),
 * not in a fixed teamLayout — so `team` carries no layout.
 */
export const gameModes: Record<string, GameMode> = {
  individual: { id: 'individual', label: '개인전', team: false, scoringId: 'individual' },
  team: { id: 'team', label: '팀전', team: true, scoringId: 'teamRankSum' },
};

export const defaultModeId = 'individual';
