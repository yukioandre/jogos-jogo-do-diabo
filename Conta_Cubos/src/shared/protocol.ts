import type { Difficulty } from './shapes';

export type Phase = 'lobby' | 'round' | 'reveal' | 'final';

export interface GameConfig {
  difficulty: Difficulty;
  rounds: number;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface ShapeView {
  id: number;
  nx: number;
  nz: number;
  heights: number[];
}

export interface RevealView {
  winnerId: string | null;
  winnerName: string | null;
  answer: number;
  layers: number[];
  shapeName: string;
}

export interface RoomState {
  phase: Phase;
  players: PlayerView[];
  config: GameConfig;
  round: number;
  totalRounds: number;
  /** ms restantes da rodada (ou até a próxima rodada, na fase reveal) no momento do envio */
  endsInMs: number;
  shape: ShapeView | null;
  reveal: RevealView | null;
  feed: string[];
}

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'config'; difficulty: Difficulty; rounds: number }
  | { t: 'start' }
  | { t: 'guess'; value: number }
  | { t: 'again' };

export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'state'; state: RoomState }
  | { t: 'wrong'; lockMs: number }
  | { t: 'error'; message: string };

export const ROUND_MS: Record<Difficulty, number> = {
  facil: 60_000,
  medio: 90_000,
  dificil: 150_000,
};
export const REVEAL_MS = 7_000;
export const WRONG_LOCK_MS = 4_000;
export const MAX_PLAYERS = 30;
export const ROUND_OPTIONS = [1, 3, 5, 10];
