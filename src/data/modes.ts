import type { EliminationId, GameMode, TeamScoringId } from './schema.ts';

/**
 * Game modes (spec §1). Two modes: individual and team.
 * Team count & relay toggle live at runtime (RoomStore/RaceConfig),
 * not in a fixed teamLayout — so `team` carries no layout.
 *
 * The team mode's *flavor* (1등보유 / 등수합 / 릴레이) is chosen separately as a
 * `TeamScoringId` (see schema.ts) and resolved to a scoring id at config-build
 * time. `team.scoringId` here is only the default the shell starts from.
 */
export const gameModes: Record<string, GameMode> = {
  individual: { id: 'individual', label: '개인전', team: false, scoringId: 'individual' },
  team: { id: 'team', label: '팀전', team: true, scoringId: 'teamRankSum' },
};

export const defaultModeId = 'individual';

/** Setup-screen labels for the three selectable team flavors (#28). */
export const teamScoringOptions: { id: TeamScoringId; label: string }[] = [
  { id: 'firstPlace', label: '1등 보유' },
  { id: 'rankSum', label: '등수 합' },
  { id: 'relay', label: '이어달리기' },
];

/**
 * Setup-screen options for individual-mode deathmatch (선두탈락 / 꼴찌탈락).
 * `'none'` keeps the normal race; the shell sets `GameMode.elimination` (and the
 * engine's `RaceConfig.elimination`) to the chosen `'first' | 'last'`.
 */
export const eliminationOptions: { id: EliminationId; label: string }[] = [
  { id: 'none', label: '일반전' },
  { id: 'first', label: '선두탈락 (1등이 먼저 빠져요)' },
  { id: 'last', label: '꼴찌탈락 (끝까지 살아남기)' },
];
