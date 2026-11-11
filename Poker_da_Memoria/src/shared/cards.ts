// Baralho e avaliação de mãos de 5 cartas.

export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  /** 2..14 (11 = J, 12 = Q, 13 = K, 14 = A) */
  r: number;
  s: Suit;
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRed = (s: Suit) => s === 'H' || s === 'D';

export function rankLabel(r: number): string {
  return r <= 10 ? String(r) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r];
}

export const cardLabel = (c: Card) => `${rankLabel(c.r)}${SUIT_SYMBOL[c.s]}`;

/** Letra da carta pela posição (0 → A, 15 → P). */
export const letterOf = (i: number) => String.fromCharCode(65 + i);

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return deck;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Nomes das categorias, da pior (0) para a melhor (8). */
export const CATEGORY_NAMES = [
  'Carta alta',
  'Par',
  'Dois pares',
  'Trinca',
  'Sequência',
  'Flush',
  'Full house',
  'Quadra',
  'Straight flush',
];

export interface HandValue {
  category: number;
  /** critérios de desempate, do mais importante para o menos */
  tiebreak: number[];
  name: string;
}

export function evaluate(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error('A mão precisa ter 5 cartas');
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // grupos ordenados por quantidade e depois por valor: [[valor, qtd], ...]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((c) => c.s === cards[0].s);

  let straightHigh = 0;
  if (counts.size === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5; // A-2-3-4-5
  }

  const make = (category: number, tiebreak: number[]): HandValue => ({
    category,
    tiebreak,
    name: CATEGORY_NAMES[category],
  });
  const byGroup = groups.map((g) => g[0]);

  if (straightHigh && flush) return make(8, [straightHigh]);
  if (groups[0][1] === 4) return make(7, byGroup);
  if (groups[0][1] === 3 && groups[1][1] === 2) return make(6, byGroup);
  if (flush) return make(5, ranks);
  if (straightHigh) return make(4, [straightHigh]);
  if (groups[0][1] === 3) return make(3, byGroup);
  if (groups[0][1] === 2 && groups[1][1] === 2) return make(2, byGroup);
  if (groups[0][1] === 2) return make(1, byGroup);
  return make(0, ranks);
}

/** > 0 se a é melhor, < 0 se b é melhor, 0 se empatam. */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const d = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
