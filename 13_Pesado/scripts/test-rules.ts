// Testes das regras. Uso: npm test
import { place, playOrder, type Choice, type Cube } from '../src/shared/rules.ts';

let fails = 0;
const check = (label: string, ok: boolean, got?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${label}${ok ? '' : ` (obtido: ${JSON.stringify(got)})`}`);
};

const seats = ['ana', 'bia', 'caio', 'duda'];
const ch = (playerId: string, weight: number, chip: Choice['chip']): Choice => ({ playerId, weight, chip });
const ids = (cs: Choice[]) => cs.map((c) => c.playerId).join(',');

let o = playOrder([ch('ana', 2, 'R'), ch('bia', 5, 'G'), ch('caio', 1, 'W'), ch('duda', 4, 'B')], seats, 0);
check('arco-íris primeiro, depois do mais pesado ao mais leve', ids(o) === 'caio,bia,duda,ana', ids(o));

o = playOrder([ch('ana', 3, 'R'), ch('bia', 3, 'G'), ch('caio', 3, 'B'), ch('duda', 3, 'R')], seats, 2);
check('empate: começa pelo primeiro jogador (caio) e segue no sentido horário', ids(o) === 'caio,duda,ana,bia', ids(o));

o = playOrder([ch('ana', 6, 'R'), ch('bia', 2, 'W'), ch('caio', 4, 'W'), ch('duda', 6, 'B')], seats, 3);
check('dois arco-íris: o mais pesado antes; empate de 6 começa em duda', ids(o) === 'caio,bia,duda,ana', ids(o));

const c = (w: number, ownerId = 'x'): Cube => ({ w, ownerId });
let r = place([c(6), c(3)], c(5, 'eu'));
check('exemplo das regras: 6 + 3 + 5 = 14 estoura, penalidade 2', r.removed === 2 && r.stack.length === 1 && r.stack[0].ownerId === 'eu', r);

r = place([c(6), c(3)], c(4));
check('exatamente 13 não estoura', r.removed === 0 && r.sum === 13, r);

r = place([c(0), c(0), c(6), c(6)], c(2));
check('cubos de peso 0 também contam na penalidade', r.removed === 4, r);

console.log(fails ? `\n${fails} teste(s) falharam` : '\nTodos os testes passaram');
if (fails) throw new Error('Testes falharam');
