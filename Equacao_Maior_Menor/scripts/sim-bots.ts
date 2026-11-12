// Simulação com bots contra o servidor local (npx wrangler dev --port 8790).
// Uso: node scripts/sim-bots.ts [mãos]
// Confere: conservação de fichas, sigilo da carta oculta e tamanho das mãos.
import { bestEquation, handInfo, type Card, type Side } from '../src/shared/game.ts';
import type { RoomState, ServerMsg } from '../src/shared/protocol.ts';

const HANDS = Number((globalThis as { process?: { argv: string[] } }).process?.argv[2] ?? 8);
const ROOM = 'SIM' + Math.floor(Math.random() * 9000 + 1000);
const CHIPS = 12;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const problems: string[] = [];
let discardedTotal = 0;

interface Bot {
  name: string;
  ws: WebSocket;
  id: string;
  state: RoomState | null;
  acted: string;
}

function bot(name: string): Bot {
  const ws = new WebSocket(`ws://localhost:8790/api/sala/${ROOM}/ws`);
  const b: Bot = { name, ws, id: '', state: null, acted: '' };
  const send = (m: object) => setTimeout(() => ws.send(JSON.stringify(m)), 20);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name }));
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as ServerMsg;
    if (m.t === 'welcome') b.id = m.id;
    if (m.t === 'error') problems.push(`${name} recebeu erro: ${m.message}`);
    if (m.t !== 'state') return;
    const s = (b.state = m.state);
    const me = s.players.find((p) => p.id === b.id);
    if (!me) return;
    // sigilo: só a própria carta oculta pode vir (exceto no confronto)
    for (const p of s.players)
      if (p.id !== b.id && p.hidden && !(s.phase === 'showdown' && !s.showdown?.byFold))
        problems.push(`${name} viu a carta oculta de ${p.name} na fase ${s.phase}`);
    if (!me.inHand || me.folded) return;
    const key = (k: string) => `${s.hand}-${s.phase}-${k}`;
    const cards = [me.hidden!, ...me.open] as Card[];

    if (s.phase === 'discard' && me.pendingDiscard && b.acted !== key('d')) {
      b.acted = key('d');
      send({ t: 'discard', op: Math.random() < 0.5 ? '+' : '-' });
    }
    if ((s.phase === 'bet1' || s.phase === 'bet2') && s.turn === b.id) {
      const k = key(`b${s.currentBet}-${me.streetBet}`);
      if (b.acted === k) return;
      b.acted = k;
      const toCall = s.currentBet - me.streetBet;
      const r = Math.random();
      if (r < 0.08) send({ t: 'fold' });
      else if (r < 0.35 && s.maxBet > s.currentBet) send({ t: 'raise', to: s.currentBet + 1 });
      else send({ t: toCall ? 'call' : 'check' });
    }
    if (s.phase === 'build' && !me.ready && b.acted !== key('r')) {
      b.acted = key('r');
      const nums = cards.filter((c) => c.kind === 'num').length;
      if (nums !== 4 || me.ops.length !== 3) problems.push(`${name}: mão com ${nums} números e ${me.ops.length} operações`);
      send({ t: 'ready' });
    }
    if (s.phase === 'declare' && !me.declared && b.acted !== key('x')) {
      b.acted = key('x');
      const side: Side = (['low', 'high', 'both'] as Side[])[Math.floor(Math.random() * 3)];
      const eq = bestEquation(handInfo(cards, me.ops), side === 'low' ? 1 : 20);
      if (!eq) problems.push(`${name}: nenhuma equação válida possível`);
      else send({ t: 'declare', side, equation: eq });
    }
    if (s.phase === 'second' && !me.secondDone && me.declared && b.acted !== key('s')) {
      b.acted = key('s');
      const eq = bestEquation(handInfo(cards, me.ops), 1);
      if (eq) send({ t: 'second', equation: eq });
    }
  };
  return b;
}

const bots = [bot('Ana'), bot('Bia'), bot('Caio')];
await wait(800);
const hostId = bots[0].state!.players.find((p) => p.isHost)!.id;
const host = bots.find((b) => b.id === hostId)!;
host.ws.send(JSON.stringify({ t: 'config', chips: CHIPS }));
await wait(200);
host.ws.send(JSON.stringify({ t: 'start' }));

let seen = 0;
const t0 = Date.now();
while (Date.now() - t0 < 240_000) {
  await wait(150);
  const s = host.state!;
  if (s.phase === 'final') break;
  if (s.phase === 'showdown' && s.hand > seen) {
    seen = s.hand;
    const sd = s.showdown!;
    discardedTotal += sd.discarded;
    const total = s.players.reduce((a, p) => a + p.chips, 0);
    if (total + discardedTotal !== CHIPS * 3) problems.push(`mão ${s.hand}: fichas ${total} + descartadas ${discardedTotal} ≠ ${CHIPS * 3}`);
    const summary = sd.byFold
      ? `todos desistiram, pote ${sd.pot} para ${s.players.find((p) => sd.pay[p.id])?.name}`
      : sd.entries
          .filter((e) => !e.folded)
          .map((e) => `${e.name}:${e.side}${e.high !== null ? ` A=${e.high.toFixed(2)}` : ''}${e.low !== null ? ` B=${e.low.toFixed(2)}` : ''}`)
          .join(' | ') + ` → pote ${sd.pot}, ganhos ${JSON.stringify(Object.fromEntries(Object.entries(sd.pay).map(([k, v]) => [s.players.find((p) => p.id === k)?.name, v])))}`;
    console.log(`Mão ${s.hand}: ${summary}`);
    console.log(`   fichas: ${s.players.map((p) => `${p.name}=${p.chips}`).join(' ')}`);
    if (s.hand >= HANDS) {
      host.ws.send(JSON.stringify({ t: 'end' }));
      break;
    }
    await wait(300);
    host.ws.send(JSON.stringify({ t: 'next' }));
  }
}
await wait(400);
console.log('fase final:', host.state!.phase);
console.log('feed:', host.state!.feed.join(' | '));
console.log(problems.length ? `PROBLEMAS:\n${[...new Set(problems)].join('\n')}` : 'Nenhum problema encontrado');
for (const b of bots) b.ws.close();
await wait(200);
if (problems.length) throw new Error('falhou');
