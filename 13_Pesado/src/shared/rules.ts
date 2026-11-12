// Regras puras do 13 Pesado: ordem de jogada e colocação de cubos.

/** Cor de suporte. */
export type Support = 'R' | 'G' | 'B';
/** Cor de ficha: as três cores de suporte ou W (arco-íris, vale qualquer suporte). */
export type Chip = Support | 'W';

export const SUPPORTS: Support[] = ['R', 'G', 'B'];
export const CHIPS: Chip[] = ['R', 'G', 'B', 'W'];
export const LIMIT = 13;
export const ROUNDS = 7;
export const WEIGHTS = [0, 1, 2, 3, 4, 5, 6];
export const START_CHIPS: Record<Chip, number> = { R: 2, G: 2, B: 2, W: 1 };

export const CHIP_NAME: Record<Chip, string> = {
  R: 'vermelha',
  G: 'verde',
  B: 'azul',
  W: 'arco-íris',
};
export const SUPPORT_NAME: Record<Support, string> = { R: 'vermelho', G: 'verde', B: 'azul' };

export interface Cube {
  w: number;
  ownerId: string;
}

export interface Choice {
  playerId: string;
  weight: number;
  chip: Chip;
}

/**
 * Ordem de jogada da rodada:
 * 1. quem escolheu a ficha arco-íris joga antes;
 * 2. depois, do cubo mais pesado para o mais leve;
 * 3. empates: começa o primeiro jogador da rodada e segue no sentido horário.
 *
 * `seats` é a ordem dos lugares na mesa (sentido horário) e `firstIdx` o
 * índice do primeiro jogador da rodada.
 */
export function playOrder(choices: Choice[], seats: string[], firstIdx: number): Choice[] {
  const n = seats.length;
  const dist = (id: string) => (seats.indexOf(id) - firstIdx + n) % n;
  return [...choices].sort(
    (a, b) =>
      Number(b.chip === 'W') - Number(a.chip === 'W') ||
      b.weight - a.weight ||
      dist(a.playerId) - dist(b.playerId),
  );
}

export const total = (stack: Cube[]) => stack.reduce((s, c) => s + c.w, 0);

export interface PlaceResult {
  stack: Cube[];
  /** quantos cubos foram retirados (= penalidade de quem colocou) */
  removed: number;
  sum: number;
}

/**
 * Coloca um cubo no suporte. Se a soma passar de 13, todos os outros cubos
 * saem, o cubo recém-colocado fica, e quem colocou leva penalidade igual ao
 * número de cubos retirados.
 */
export function place(stack: Cube[], cube: Cube): PlaceResult {
  const next = [...stack, cube];
  const sum = total(next);
  if (sum > LIMIT) return { stack: [cube], removed: stack.length, sum };
  return { stack: next, removed: 0, sum };
}

/** Suporte mais leve (usado quando o tempo de uma ficha arco-íris acaba). */
export function lightest(supports: Record<Support, Cube[]>): Support {
  return SUPPORTS.reduce((best, s) => (total(supports[s]) < total(supports[best]) ? s : best), 'R');
}
