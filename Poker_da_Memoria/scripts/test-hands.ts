// Testes do avaliador de mãos. Uso: npm test
import { compareHands, evaluate, type Card, type Suit } from '../src/shared/cards.ts';

const R: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
const hand = (s: string): Card[] =>
  s.split(' ').map((t) => ({ r: R[t[0]] ?? Number(t[0]), s: t[1] as Suit }));

let fails = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${label}`);
};

const cat = (s: string, name: string) => check(`${s} = ${name}`, evaluate(hand(s)).name === name);
cat('9H TH JH QH KH', 'Straight flush');
cat('AS 2S 3S 4S 5S', 'Straight flush');
cat('7C 7D 7H 7S 2C', 'Quadra');
cat('3C 3D 3H 9S 9C', 'Full house');
cat('2D 8D 9D JD KD', 'Flush');
cat('5C 6D 7H 8S 9C', 'Sequência');
cat('AC 2D 3H 4S 5C', 'Sequência');
cat('TC JD QH KS AC', 'Sequência');
cat('QC KD AH 2S 3C', 'Carta alta'); // não existe sequência "dando a volta"
cat('4C 4D 4H 9S KC', 'Trinca');
cat('4C 4D 9H 9S KC', 'Dois pares');
cat('4C 4D 8H 9S KC', 'Par');
cat('2C 5D 8H 9S KC', 'Carta alta');

const cmp = (a: string, b: string, sign: number, label: string) =>
  check(label, Math.sign(compareHands(evaluate(hand(a)), evaluate(hand(b)))) === sign);
cmp('2C 3C 4C 5C 6C', '7C 7D 7H 7S AC', 1, 'straight flush ganha de quadra');
cmp('AC 2D 3H 4S 5C', '2C 3D 4H 5S 6C', -1, 'sequência A-5 perde para 2-6');
cmp('KC KD 4H 4S 9C', 'KH KS 4C 4D 8C', 1, 'dois pares iguais: decide o kicker');
cmp('QC QD 2H 3S 4C', 'JC JD AH KS QH', 1, 'par maior ganha, mesmo com kickers piores');
cmp('3C 3D 3H 2S 2C', '2H 2D 2C AS AC', 1, 'full house: decide a trinca');
cmp('AC KC 9C 5C 3C', 'AD KD 9D 5D 2D', 1, 'flush: decide a última carta');
cmp('AC KD 9H 5S 3C', 'AD KH 9C 5D 3S', 0, 'mãos idênticas em valor empatam');

console.log(fails ? `\n${fails} teste(s) falharam` : '\nTodos os testes passaram');
if (fails) throw new Error('Testes falharam');
