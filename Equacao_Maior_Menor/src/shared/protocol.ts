import type { Card, Op, Side, Token } from './game';

export type Phase =
  | 'lobby'
  | 'discard' // quem recebeu × descarta + ou −
  | 'bet1' // primeira rodada de apostas
  | 'build' // montar a equação
  | 'bet2' // segunda rodada de apostas
  | 'declare' // escolher ficha 1 / 20 (mão fechada) e confirmar a equação
  | 'second' // quem apostou duplo reorganiza a equação da baixa
  | 'showdown'
  | 'final';

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  role: 'player' | 'spectator';
  chips: number;
  /** participa da mão atual */
  inHand: boolean;
  folded: boolean;
  /** total colocado no pote nesta mão */
  contributed: number;
  /** apostado na rodada de apostas atual */
  streetBet: number;
  /** carta oculta: só vem para o próprio jogador (e para todos no confronto) */
  hidden: Card | null;
  open: Card[];
  ops: Op[];
  /** operação descartada por causa do × */
  discardedOp: Op | null;
  pendingDiscard: boolean;
  ready: boolean;
  declared: boolean;
  /** quem apostou duplo já entregou a segunda equação */
  secondDone: boolean;
  isFirst: boolean;
}

export interface ShowdownEntry {
  playerId: string;
  name: string;
  side: Side | null;
  folded: boolean;
  eqHigh: Token[] | null;
  eqLow: Token[] | null;
  high: number | null;
  low: number | null;
}

export interface ShowdownView {
  byFold: boolean;
  entries: ShowdownEntry[];
  highWinner: string | null;
  lowWinner: string | null;
  doubleLosers: string[];
  pay: Record<string, number>;
  pot: number;
  discarded: number;
}

export interface RoomState {
  phase: Phase;
  hand: number;
  config: { chips: number };
  players: PlayerView[];
  pot: number;
  currentBet: number;
  /** maior valor que a aposta desta rodada pode atingir (limite do jogador com menos fichas) */
  maxBet: number;
  turn: string | null;
  showdown: ShowdownView | null;
  endsInMs: number;
  feed: string[];
}

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'config'; chips: number }
  | { t: 'start' }
  | { t: 'discard'; op: '+' | '-' }
  | { t: 'check' }
  | { t: 'call' }
  | { t: 'raise'; to: number }
  | { t: 'fold' }
  | { t: 'ready' }
  | { t: 'declare'; side: Side; equation: Token[] }
  | { t: 'second'; equation: Token[] }
  | { t: 'next' }
  | { t: 'end' }
  | { t: 'again' };

export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'state'; state: RoomState }
  | { t: 'error'; message: string };

export const DISCARD_MS = 20_000;
export const BET_TURN_MS = 30_000;
export const BUILD_MS = 90_000;
export const DECLARE_MS = 60_000;
export const SECOND_MS = 20_000;
export const MAX_SEATS = 6;
export const MAX_CONNECTIONS = 30;
