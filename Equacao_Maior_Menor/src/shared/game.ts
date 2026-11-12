// Regras puras da Equação Maior-Menor: baralho, equações e confronto.

export type Suit = 'ouro' | 'prata' | 'bronze' | 'terra';
export const SUITS: Suit[] = ['ouro', 'prata', 'bronze', 'terra'];
/** Força do metal no desempate: ouro > prata > bronze > terra. */
export const SUIT_RANK: Record<Suit, number> = { terra: 0, bronze: 1, prata: 2, ouro: 3 };
export const SUIT_LABEL: Record<Suit, string> = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze', terra: 'Terra' };

export type NumCard = { id: number; kind: 'num'; value: number; suit: Suit };
export type SpecialCard = { id: number; kind: 'sqrt' | 'mul' };
export type Card = NumCard | SpecialCard;

export type Op = '+' | '-' | '/' | '*';
export const OP_LABEL: Record<Op, string> = { '+': '+', '-': '−', '/': '÷', '*': '×' };
/** Cartas de operação que todo jogador recebe. */
export const BASE_OPS: Op[] = ['+', '-', '/'];

export type Side = 'low' | 'high' | 'both';
export const TARGET = { low: 1, high: 20 } as const;

export type Token = { t: 'num'; id: number } | { t: 'op'; op: Op } | { t: 'sqrt'; id: number };

export function newDeck(): Card[] {
  const deck: Card[] = [];
  let id = 1;
  for (const suit of SUITS) for (let v = 0; v <= 10; v++) deck.push({ id: id++, kind: 'num', value: v, suit });
  for (let i = 0; i < 4; i++) deck.push({ id: id++, kind: 'sqrt' });
  for (let i = 0; i < 4; i++) deck.push({ id: id++, kind: 'mul' });
  return deck;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** O que o jogador tem para montar a equação. */
export interface HandInfo {
  nums: NumCard[];
  sqrtIds: number[];
  ops: Op[];
}

export function handInfo(cards: Card[], ops: Op[]): HandInfo {
  return {
    nums: cards.filter((c): c is NumCard => c.kind === 'num'),
    sqrtIds: cards.filter((c) => c.kind === 'sqrt').map((c) => c.id),
    ops: [...ops],
  };
}

export interface Parsed {
  ok: boolean;
  error?: string;
  /** a próxima peça precisa ser um número (ou √) */
  expectNumber: boolean;
  /** há uma √ esperando o número */
  pendingSqrt: boolean;
  usedNums: Set<number>;
  usedSqrt: Set<number>;
  usedOps: Op[];
  complete: boolean;
  value?: number;
}

/**
 * Valida uma equação (inteira ou parcial). Uma equação completa usa todas as
 * cartas: todos os números, todas as operações e a √ (se houver), sem
 * parênteses. × e ÷ são feitos antes de + e −. A √ vale para um único número.
 */
export function parse(tokens: Token[], hand: HandInfo): Parsed {
  const r: Parsed = {
    ok: true,
    expectNumber: true,
    pendingSqrt: false,
    usedNums: new Set(),
    usedSqrt: new Set(),
    usedOps: [],
    complete: false,
  };
  const fail = (error: string): Parsed => ({ ...r, ok: false, error });
  const opsLeft = [...hand.ops];
  const terms: number[] = [];
  const ops: Op[] = [];

  for (const tk of tokens) {
    if (r.expectNumber) {
      if (tk.t === 'sqrt') {
        if (r.pendingSqrt) return fail('A √ vale para um único número.');
        if (!hand.sqrtIds.includes(tk.id) || r.usedSqrt.has(tk.id)) return fail('Carta √ inválida.');
        r.usedSqrt.add(tk.id);
        r.pendingSqrt = true;
      } else if (tk.t === 'num') {
        const card = hand.nums.find((c) => c.id === tk.id);
        if (!card || r.usedNums.has(tk.id)) return fail('Carta de número inválida.');
        r.usedNums.add(tk.id);
        terms.push(r.pendingSqrt ? Math.sqrt(card.value) : card.value);
        r.pendingSqrt = false;
        r.expectNumber = false;
      } else return fail('Depois de uma operação vem um número.');
    } else {
      if (tk.t !== 'op') return fail('Entre dois números precisa haver uma operação.');
      const i = opsLeft.indexOf(tk.op);
      if (i < 0) return fail(`Você não tem a carta ${OP_LABEL[tk.op]}.`);
      opsLeft.splice(i, 1);
      r.usedOps.push(tk.op);
      ops.push(tk.op);
      r.expectNumber = true;
    }
  }

  r.complete =
    !r.expectNumber &&
    r.usedNums.size === hand.nums.length &&
    r.usedSqrt.size === hand.sqrtIds.length &&
    opsLeft.length === 0;

  if (!r.expectNumber && terms.length) {
    const v = evaluate(terms, ops);
    if (v === null) return fail('Divisão por zero.');
    r.value = v;
  }
  return r;
}

/** Avalia termos e operações com precedência (× ÷ antes de + −). null = divisão por zero. */
export function evaluate(terms: number[], ops: Op[]): number | null {
  const t: number[] = [terms[0]];
  const o: Op[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const next = terms[i + 1];
    if (op === '*') t[t.length - 1] *= next;
    else if (op === '/') {
      if (next === 0) return null;
      t[t.length - 1] /= next;
    } else {
      o.push(op);
      t.push(next);
    }
  }
  let v = t[0];
  for (let i = 0; i < o.length; i++) v = o[i] === '+' ? v + t[i + 1] : v - t[i + 1];
  return v;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

/**
 * Melhor equação possível para um alvo, testando todas as arrumações.
 * Usada quando o tempo acaba e a equação do jogador está incompleta.
 */
export function bestEquation(hand: HandInfo, target: number): Token[] | null {
  let best: Token[] | null = null;
  let bestDist = Infinity;
  const numPerms = permutations(hand.nums);
  const opPerms = permutations(hand.ops);
  const sqrtSpots = hand.sqrtIds.length ? hand.nums.map((_, i) => i) : [-1];
  for (const nums of numPerms)
    for (const ops of opPerms)
      for (const spot of sqrtSpots) {
        const tokens: Token[] = [];
        nums.forEach((c, i) => {
          if (i > 0) tokens.push({ t: 'op', op: ops[i - 1] });
          if (i === spot) tokens.push({ t: 'sqrt', id: hand.sqrtIds[0] });
          tokens.push({ t: 'num', id: c.id });
        });
        const p = parse(tokens, hand);
        if (!p.ok || !p.complete || p.value === undefined) continue;
        const d = Math.abs(p.value - target);
        if (d < bestDist) {
          bestDist = d;
          best = tokens;
        }
      }
  return best;
}

// ---------- confronto ----------

const EPS = 1e-9;

export interface Contender {
  playerId: string;
  side: Side;
  /** resultado da equação da aposta alta (se apostou alto ou duplo) */
  high: number | null;
  /** resultado da equação da aposta baixa (se apostou baixo ou duplo) */
  low: number | null;
  nums: NumCard[];
}

/** Chave de desempate de uma carta: valor primeiro, depois o metal. */
const cardKey = (c: NumCard) => c.value * 4 + SUIT_RANK[c.suit];

function sideWinner(cs: Contender[], side: 'low' | 'high'): string | null {
  const target = TARGET[side];
  let best: Contender | null = null;
  let bestDist = Infinity;
  let bestKey = 0;
  for (const c of cs) {
    const v = side === 'high' ? c.high : c.low;
    if (v === null) continue;
    const d = Math.abs(v - target);
    // desempate: na alta vale a maior carta da equação; na baixa, a menor
    const key =
      side === 'high' ? Math.max(...c.nums.map(cardKey)) : -Math.min(...c.nums.map(cardKey));
    if (d < bestDist - EPS || (Math.abs(d - bestDist) <= EPS && key > bestKey)) {
      best = c;
      bestDist = d;
      bestKey = key;
    }
  }
  return best?.playerId ?? null;
}

export interface Resolution {
  highWinner: string | null;
  lowWinner: string | null;
  /** jogadores de aposta dupla que perderam um dos lados e foram eliminados do confronto */
  doubleLosers: string[];
}

/**
 * Quem vence cada lado. Quem apostou duplo precisa vencer os dois lados
 * contra todos os participantes; quem perder qualquer um sai dos dois.
 * Todos os que falham saem ao mesmo tempo (o resultado não depende da ordem
 * dos jogadores) e cada lado é decidido entre os que sobraram.
 */
export function resolve(contenders: Contender[]): Resolution {
  const winners = (pool: Contender[]) => ({
    hw: sideWinner(pool.filter((c) => c.side !== 'low'), 'high'),
    lw: sideWinner(pool.filter((c) => c.side !== 'high'), 'low'),
  });
  const first = winners(contenders);
  const doubleLosers = contenders
    .filter((c) => c.side === 'both' && !(first.hw === c.playerId && first.lw === c.playerId))
    .map((c) => c.playerId);
  const { hw, lw } = winners(contenders.filter((c) => !doubleLosers.includes(c.playerId)));
  return { highWinner: hw, lowWinner: lw, doubleLosers };
}

/**
 * Divide o pote. Cada lado vale metade; com pote ímpar, 1 ficha é descartada.
 * Se um lado não tem vencedor, o vencedor do outro lado leva o pote inteiro.
 */
export function payouts(pot: number, r: Resolution): { pay: Record<string, number>; discarded: number } {
  const pay: Record<string, number> = {};
  const add = (id: string, n: number) => (pay[id] = (pay[id] ?? 0) + n);
  if (r.highWinner && r.lowWinner) {
    const half = Math.floor(pot / 2);
    add(r.highWinner, half);
    add(r.lowWinner, half);
    return { pay, discarded: pot - 2 * half };
  }
  const only = r.highWinner ?? r.lowWinner;
  if (only) {
    add(only, pot);
    return { pay, discarded: 0 };
  }
  return { pay, discarded: pot };
}

export const fmt = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace('.', ',');
