/** Tipos de domínio do Spyclaudio. Nenhuma dependência de UI ou de Firebase aqui. */

export interface Scenario {
  readonly id: number;
  readonly name: string;
  readonly roles: readonly string[];
}

export type SpyCount = 1 | 2;

/** Quantos papéis existem por cenário na planilha Papeis.xlsx. */
export const ROLES_PER_SCENARIO = 7;

/** Limites de participantes por quantidade de espiões. */
export const CAPACITY: Record<SpyCount, { min: number; max: number }> = {
  1: { min: 3, max: 8 },
  2: { min: 4, max: 9 },
};

/** Atribuição individual e secreta de um jogador. */
export interface Assignment {
  readonly playerId: string;
  readonly isSpy: boolean;
  /** Ausente para espiões: o espião não conhece o papel nem o cenário. */
  readonly role: string | null;
}

export interface Distribution {
  readonly scenarioId: number;
  readonly assignments: readonly Assignment[];
}

/** Estados públicos da sala. As transições são monotônicas. */
export type RoomStatus = 'lobby' | 'distributed' | 'voting' | 'result' | 'closed';

export const ROOM_STATUS_ORDER: readonly RoomStatus[] = [
  'lobby',
  'distributed',
  'voting',
  'result',
  'closed',
];

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  const fromIndex = ROOM_STATUS_ORDER.indexOf(from);
  const toIndex = ROOM_STATUS_ORDER.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return false;
  return toIndex > fromIndex;
}

/** Duração fixa da votação, em milissegundos. */
export const VOTING_DURATION_MS = 3 * 60 * 1000;
