import type { Card, HandValue } from './cards';

export type Phase = 'lobby' | 'memorize' | 'choose' | 'reveal' | 'final';

export interface GameConfig {
  rounds: number;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  /** 'player' disputa a rodada; 'spectator' só assiste */
  role: 'player' | 'spectator';
  /** já confirmou a escolha nesta rodada */
  chosen: boolean;
}

export interface PickResult {
  playerId: string;
  name: string;
  /** índices (0..15) das duas cartas escolhidas, ou null se não escolheu a tempo */
  picks: [number, number] | null;
  hand: HandValue | null;
}

export interface RoundResult {
  results: PickResult[];
  /** null = empate */
  winnerId: string | null;
}

export interface RoomState {
  phase: Phase;
  players: PlayerView[];
  config: GameConfig;
  round: number;
  totalRounds: number;
  /** ms restantes da fase atual no momento do envio (0 = sem relógio) */
  endsInMs: number;
  /** as 16 cartas da mesa; só vêm com a face durante a memorização e a revelação */
  board: (Card | null)[] | null;
  /** as 3 cartas abertas (fases choose e reveal) */
  open: Card[] | null;
  result: RoundResult | null;
  feed: string[];
}

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'config'; rounds: number }
  | { t: 'start' }
  | { t: 'pick'; picks: [number, number] }
  | { t: 'next' }
  | { t: 'again' };

export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'state'; state: RoomState }
  | { t: 'error'; message: string };

export const MEMORIZE_MS = 20_000;
export const CHOOSE_MS = 60_000;
export const BOARD_SIZE = 16;
export const MAX_CONNECTIONS = 30;
export const ROUND_OPTIONS = [1, 3, 5, 7];
