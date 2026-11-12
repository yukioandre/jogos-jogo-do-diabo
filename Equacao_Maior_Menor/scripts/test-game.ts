// Testes das regras. Uso: npm test
import {
  bestEquation,
  handInfo,
  parse,
  payouts,
  resolve,
  type Card,
  type Contender,
  type NumCard,
  type Op,
  type Suit,
  type Token,
} from '../src/shared/game.ts';

let fails = 0;
const check = (label: string, ok: boolean, got?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${label}${ok ? '' : ` (obtido: ${JSON.stringify(got)})`}`);
};

let nextId = 1;
const n = (value: number, suit: Suit = 'terra'): NumCard => ({ id: nextId++, kind: 'num', value, suit });
const sq = (): Card => ({ id: nextId++, kind: 'sqrt' });

// ---- equações ----
const a = n(8), b = n(2), c = n(5), d = n(3);
const hand = handInfo([a, b, c, d], ['+', '-', '/']);
const N = (x: NumCard): Token => ({ t: 'num', id: x.id });
const O = (op: Op): Token => ({ t: 'op', op });

let p = parse([N(a), O('/'), N(b), O('+'), N(c), O('-'), N(d)], hand);
check('8 ÷ 2 + 5 − 3 = 6 (÷ antes de + e −)', p.ok && p.complete && p.value === 6, p);

p = parse([N(a), O('-'), N(b), O('/'), N(b)], hand);
check('mesma carta duas vezes é inválido', !p.ok, p);

p = parse([N(a), O('+'), N(b)], hand);
check('equação sem usar todas as cartas não está completa', p.ok && !p.complete, p);

const z = n(0);
const hz = handInfo([a, z, c, d], ['+', '-', '/']);
p = parse([N(a), O('/'), N(z), O('+'), N(c), O('-'), N(d)], hz);
check('divisão por zero é inválida', !p.ok, p);

const e9 = n(9), e4 = n(4), e1 = n(1), e6 = n(6), s = sq();
const hs = handInfo([e9, s, e4, e1, e6], ['*', '/', '+']);
p = parse([{ t: 'sqrt', id: s.id }, N(e9), O('*'), N(e6), O('+'), N(e4), O('/'), N(e1)], hs);
check('√9 × 6 + 4 ÷ 1 = 22 (com ×, sem −)', p.ok && p.complete && p.value === 22, p);

p = parse([{ t: 'sqrt', id: s.id }, { t: 'sqrt', id: s.id }, N(e9)], hs);
check('√ não pode ser aplicada duas vezes', !p.ok, p);

const best = bestEquation(hand, 20);
const bp = best && parse(best, hand);
check('melhor equação para 20 com 8, 2, 5, 3 é 8 + 5 − 2 ÷ 3 ≈ 12,33', !!bp && bp.complete && Math.abs(bp.value! - 37 / 3) < 1e-9, bp?.value);

// ---- confronto ----
const C = (playerId: string, side: Contender['side'], high: number | null, low: number | null, nums: NumCard[]): Contender => ({
  playerId, side, high, low, nums,
});
let r = resolve([
  C('ana', 'high', 19, null, [n(9, 'prata'), n(5), n(3), n(2)]),
  C('bia', 'high', 19, null, [n(9, 'terra'), n(5), n(3), n(2)]),
]);
check('exemplo: empate em 19, o 9 de prata vence o 9 de terra', r.highWinner === 'ana', r);

r = resolve([
  C('ana', 'high', 21, null, [n(10), n(1)]),
  C('bia', 'high', 19, null, [n(7), n(1)]),
]);
check('21 e 19 estão à mesma distância de 20: vence a maior carta (10)', r.highWinner === 'ana', r);

r = resolve([
  C('ana', 'low', null, 1.5, [n(4, 'ouro'), n(6)]),
  C('bia', 'low', null, 0.5, [n(4, 'terra'), n(8)]),
]);
check('baixa empatada (1,5 e 0,5): vence a menor carta, 4 de terra', r.lowWinner === 'bia', r);

r = resolve([
  C('ana', 'both', 20, 3, [n(1)]),
  C('bia', 'low', null, 1, [n(2)]),
  C('caio', 'high', 18, null, [n(3)]),
]);
check('aposta dupla que perde a baixa perde tudo; a alta vai para o próximo', r.highWinner === 'caio' && r.lowWinner === 'bia' && r.doubleLosers[0] === 'ana', r);

const trio = [
  C('caio', 'both', 14.8, 1.11, [n(1)]),
  C('bia', 'both', 4, 1.33, [n(2)]),
  C('ana', 'both', 13, 1.0, [n(3)]),
];
const r1 = resolve(trio);
const r2 = resolve([...trio].reverse());
check(
  'três apostas duplas: quem não vence as duas sai, sem depender da ordem',
  r1.highWinner === null && r1.lowWinner === null && r1.doubleLosers.length === 3 &&
    r2.highWinner === r1.highWinner && r2.lowWinner === r1.lowWinner,
  [r1, r2],
);

r = resolve([C('ana', 'both', 20, 1, [n(1)]), C('bia', 'high', 17, null, [n(2)])]);
const pay = payouts(9, r);
check('aposta dupla vencedora leva as duas metades; pote ímpar descarta 1', pay.pay.ana === 8 && pay.discarded === 1, pay);

r = resolve([C('ana', 'high', 20, null, [n(1)]), C('bia', 'high', 15, null, [n(2)])]);
const pay2 = payouts(6, r);
check('se ninguém apostou baixo, o vencedor da alta leva o pote inteiro', pay2.pay.ana === 6, pay2);

console.log(fails ? `\n${fails} teste(s) falharam` : '\nTodos os testes passaram');
if (fails) throw new Error('Testes falharam');
