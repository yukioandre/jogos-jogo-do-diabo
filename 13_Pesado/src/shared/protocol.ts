import type { Chip, Cube, Support } from './rules';

export type Phase = 'lobby' | 'choose' | 'place' | 'roundEnd' | 'final';

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  role: 'player' | 'spectator';
  /** penalidade acumulada (número de cubos retirados por culpa do jogador) */
  penalty: number;
  /** cubos ainda não usados (público: os usados já foram revelados) */
  cubesLeft: number[];
  chipsLeft: Record<Chip, number>;
  /** já confirmou a escolha nesta rodada */
  chosen: boolean;
  /** é o primeiro jogador da rodada (desempata a ordem) */
  isFirst: boolean;
}

export interface OrderEntry {
  playerId: string;
  name: string;
  weight: number;
  chip: Chip;
  passed: boolean;
  placed: boolean;
  support: Support | null;
  removed: number;
}

export interface TurnView {
  playerId: string;
  /** true = é a colocação de quem passou: não pode passar de novo */
  forced: boolean;
}

export interface EventView {
  text: string;
  support: Support | null;
  bust: boolean;
}

export interface RoomState {
  phase: Phase;
  round: number;
  totalRounds: number;
  players: PlayerView[];
  supports: Record<Support, Cube[]>;
  order: OrderEntry[] | null;
  turn: TurnView | null;
  lastEvent: EventView | null;
  /** penalidades recebidas na rodada atual, por jogador */
  roundPenalties: Record<string, number>;
  endsInMs: number;
  feed: string[];
}

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'start' }
  | { t: 'choose'; weight: number; chip: Chip }
  | { t: 'place'; support?: Support }
  | { t: 'pass' }
  | { t: 'again' };

export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'state'; state: RoomState }
  | { t: 'error'; message: string };

export const CHOOSE_MS = 180_000;
export const TURN_MS = 30_000;
export const AUTO_PLACE_MS = 1_500;
export const ROUND_END_MS = 8_000;
export const MAX_SEATS = 8;
export const MAX_CONNECTIONS = 30;
