import { DurableObject } from 'cloudflare:workers';
import {
  BASE_OPS,
  OP_LABEL,
  SUIT_LABEL,
  TARGET,
  fmt,
  handInfo,
  newDeck,
  parse,
  payouts,
  resolve,
  shuffle,
  type Card,
  type Contender,
  type NumCard,
  type Op,
  type Side,
  type Token,
} from '../shared/game';
import {
  BET_TURN_MS,
  BUILD_MS,
  DECLARE_MS,
  DISCARD_MS,
  MAX_CONNECTIONS,
  MAX_SEATS,
  SECOND_MS,
  type ClientMsg,
  type Phase,
  type RoomState,
  type ServerMsg,
  type ShowdownView,
} from '../shared/protocol';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

interface Player {
  id: string;
  name: string;
  joinedAt: number;
  chips: number;
  inHand: boolean;
  folded: boolean;
  contributed: number;
  streetBet: number;
  hidden: NumCard | null;
  open: Card[];
  ops: Op[];
  discardedOp: Op | null;
  special: 'sqrt' | 'mul' | null;
  pendingDiscard: boolean;
  ready: boolean;
  side: Side | null;
  eqHigh: Token[] | null;
  eqLow: Token[] | null;
  /** primeira equação entregue na declaração (alta, ou baixa se apostou só baixo) */
  declared: boolean;
  secondDone: boolean;
}

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const cardName = (c: Card) =>
  c.kind === 'num' ? `${c.value} de ${SUIT_LABEL[c.suit].toLowerCase()}` : c.kind === 'sqrt' ? '√' : '×';

export class Room extends DurableObject<Env> {
  private sockets = new Set<WebSocket>();
  private players = new Map<WebSocket, Player>();
  private hostId: string | null = null;
  private phase: Phase = 'lobby';
  private config = { chips: 10 };
  private hand = 0;
  private seats: string[] = [];
  private firstIdx = 0;
  private deck: Card[] = [];
  private pot = 0;
  private handCap = 0;
  private currentBet = 0;
  private pending = new Set<string>();
  private turn: string | null = null;
  private afterDiscard: (() => void) | null = null;
  private showdown: ShowdownView | null = null;
  private phaseEndsAt = 0;
  private feed: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Esperado WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);
    server.addEventListener('message', (ev) => this.onMessage(server, ev.data));
    const drop = () => this.onClose(server);
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- quem é quem ----------

  private ordered(): Player[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }
  private byId(id: string): Player | undefined {
    for (const p of this.players.values()) if (p.id === id) return p;
    return undefined;
  }
  private seatedIds(): string[] {
    return this.phase === 'lobby' ? this.ordered().slice(0, MAX_SEATS).map((p) => p.id) : this.seats;
  }
  /** jogadores na mão, na ordem da mesa a partir do primeiro jogador */
  private handOrder(): Player[] {
    const n = this.seats.length;
    const out: Player[] = [];
    for (let k = 0; k < n; k++) {
      const p = this.byId(this.seats[(this.firstIdx + k) % n]);
      if (p?.inHand) out.push(p);
    }
    return out;
  }
  private active(): Player[] {
    return this.handOrder().filter((p) => !p.folded);
  }

  // ---------- mensagens ----------

  private onMessage(ws: WebSocket, raw: unknown) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const p = this.players.get(ws);
    const isHost = !!p && p.id === this.hostId;
    const err = (message: string) => this.send(ws, { t: 'error', message });

    switch (msg.t) {
      case 'join': {
        if (p) return;
        const name = String(msg.name ?? '').trim().slice(0, 20);
        if (!name) return err('Digite um nome.');
        if (this.players.size >= MAX_CONNECTIONS) return err('Sala cheia.');
        const np = this.blankPlayer(name);
        this.players.set(ws, np);
        if (!this.hostId) this.hostId = np.id;
        this.send(ws, { t: 'welcome', id: np.id });
        this.log(`${name} entrou`);
        return this.broadcast();
      }
      case 'config': {
        if (!isHost || this.phase !== 'lobby') return;
        const c = Math.trunc(Number(msg.chips));
        if (c >= 1 && c <= 99) this.config.chips = c;
        return this.broadcast();
      }
      case 'start': {
        if (!isHost || (this.phase !== 'lobby' && this.phase !== 'final')) return;
        const seated = this.ordered().slice(0, MAX_SEATS);
        if (seated.length < 2) return err('É preciso pelo menos 2 jogadores.');
        this.seats = seated.map((x) => x.id);
        for (const x of seated) x.chips = this.config.chips;
        this.hand = 0;
        this.feed = [];
        this.firstIdx = Math.floor(Math.random() * this.seats.length);
        this.log(`Partida com ${seated.map((x) => x.name).join(', ')}: ${this.config.chips} fichas cada`);
        return this.startHand();
      }
      case 'discard': {
        if (!p || this.phase !== 'discard' || !p.pendingDiscard) return;
        if (msg.op !== '+' && msg.op !== '-') return;
        this.doDiscard(p, msg.op);
        return this.checkDiscards();
      }
      case 'check':
      case 'call':
      case 'raise':
      case 'fold': {
        if (!p || (this.phase !== 'bet1' && this.phase !== 'bet2') || this.turn !== p.id) return;
        return this.betAction(p, msg, err);
      }
      case 'ready': {
        if (!p || this.phase !== 'build' || !p.inHand || p.folded) return;
        p.ready = true;
        if (this.active().every((x) => x.ready)) return this.startBetting(2);
        return this.broadcast();
      }
      case 'declare': {
        if (!p || this.phase !== 'declare' || !p.inHand || p.folded || p.declared) return;
        if (!['low', 'high', 'both'].includes(msg.side)) return;
        const v = this.checkEq(p, msg.equation);
        if (typeof v === 'string') return err(v);
        p.side = msg.side;
        if (msg.side === 'low') p.eqLow = msg.equation;
        else p.eqHigh = msg.equation;
        p.declared = true;
        p.secondDone = msg.side !== 'both';
        this.log(`${p.name} fechou a mão`);
        if (this.active().every((x) => x.declared)) return this.afterDeclare();
        return this.broadcast();
      }
      case 'second': {
        if (!p || this.phase !== 'second' || p.side !== 'both' || p.secondDone) return;
        const v = this.checkEq(p, msg.equation);
        if (typeof v === 'string') return err(v);
        p.eqLow = msg.equation;
        p.secondDone = true;
        if (this.active().every((x) => x.secondDone)) return this.doShowdown();
        return this.broadcast();
      }
      case 'next': {
        if (!isHost || this.phase !== 'showdown') return;
        return this.startHand();
      }
      case 'end': {
        if (!isHost || this.phase !== 'showdown') return;
        return this.finish('Partida encerrada pelo anfitrião');
      }
      case 'again': {
        if (!isHost || this.phase !== 'final') return;
        this.phase = 'lobby';
        this.showdown = null;
        for (const x of this.players.values()) Object.assign(x, this.blankPlayer(x.name), { id: x.id, joinedAt: x.joinedAt });
        return this.broadcast();
      }
    }
  }

  private blankPlayer(name: string): Player {
    return {
      id: crypto.randomUUID(),
      name,
      joinedAt: Date.now(),
      chips: 0,
      inHand: false,
      folded: false,
      contributed: 0,
      streetBet: 0,
      hidden: null,
      open: [],
      ops: [...BASE_OPS],
      discardedOp: null,
      special: null,
      pendingDiscard: false,
      ready: false,
      side: null,
      eqHigh: null,
      eqLow: null,
      declared: false,
      secondDone: false,
    };
  }

  private onClose(ws: WebSocket) {
    if (!this.sockets.delete(ws)) return;
    const p = this.players.get(ws);
    this.players.delete(ws);
    if (!p) return;
    if (this.players.size === 0) return this.reset();
    if (p.id === this.hostId) {
      const next = this.ordered()[0];
      this.hostId = next.id;
      this.log(`${next.name} agora é o anfitrião`);
    }
    this.log(`${p.name} saiu`);
    if (this.phase !== 'lobby' && this.phase !== 'final' && this.seats.includes(p.id)) {
      this.clearTimer();
      this.phase = 'lobby';
      this.seats = [];
      this.showdown = null;
      this.log('Partida interrompida');
    }
    this.broadcast();
  }

  // ---------- mão ----------

  private startHand() {
    this.clearTimer();
    const alive = this.seats.map((id) => this.byId(id)!).filter((x) => x.chips > 0);
    if (alive.length < 2) return this.finish(alive[0] ? `${alive[0].name} ficou com todas as fichas` : 'Fim');
    this.hand += 1;
    if (this.hand > 1) {
      // o primeiro jogador passa para o próximo (que ainda tem fichas), no sentido horário
      const n = this.seats.length;
      for (let k = 1; k <= n; k++) {
        const idx = (this.firstIdx + k) % n;
        if (this.byId(this.seats[idx])!.chips > 0) {
          this.firstIdx = idx;
          break;
        }
      }
    }
    for (const id of this.seats) {
      const x = this.byId(id)!;
      const keep = { id: x.id, name: x.name, joinedAt: x.joinedAt, chips: x.chips };
      Object.assign(x, this.blankPlayer(x.name), keep, { inHand: x.chips > 0 });
    }
    this.showdown = null;
    this.pot = 0;
    this.deck = shuffle(newDeck(), secureRandom);
    const players = this.handOrder();
    this.handCap = Math.min(...players.map((x) => x.chips));
    // aposta básica
    for (const x of players) this.pay(x, 1);
    this.log(`Mão ${this.hand}. Primeiro jogador: ${players[0].name}. Aposta básica de 1 ficha.`);
    // carta oculta: precisa ser número
    for (const x of players) {
      for (;;) {
        const c = this.draw();
        if (c.kind === 'num') {
          x.hidden = c;
          break;
        }
        this.deck.push(c);
        shuffle(this.deck, secureRandom);
      }
    }
    // duas cartas abertas
    for (let k = 0; k < 2; k++) for (const x of players) this.dealOpen(x);
    this.afterDiscard = () => this.startBetting(1);
    this.checkDiscards();
  }

  private draw(): Card {
    if (!this.deck.length) this.deck = shuffle(newDeck(), secureRandom); // não acontece com até 6 jogadores
    return this.deck.pop()!;
  }

  /** Uma carta aberta, seguindo as regras de √ e ×. */
  private dealOpen(x: Player) {
    for (;;) {
      const c = this.draw();
      if (c.kind === 'num') {
        x.open.push(c);
        return;
      }
      if (x.special) {
        this.log(`${x.name} recebeu um segundo ${cardName(c)}: descartado, nova carta`);
        continue;
      }
      x.special = c.kind;
      x.open.push(c);
      if (c.kind === 'sqrt') {
        this.log(`${x.name} recebeu √ e ganha mais uma carta`);
      } else {
        x.ops.push('*');
        x.pendingDiscard = true;
        this.log(`${x.name} recebeu × e precisa descartar + ou −`);
      }
    }
  }

  private doDiscard(x: Player, op: '+' | '-') {
    x.ops = x.ops.filter((o) => o !== op);
    x.discardedOp = op;
    x.pendingDiscard = false;
    this.log(`${x.name} descartou ${OP_LABEL[op]}`);
  }

  /** Se alguém precisa descartar + ou −, abre a fase de descarte; senão segue. */
  private checkDiscards() {
    const waiting = this.active().filter((x) => x.pendingDiscard);
    if (!waiting.length) {
      const next = this.afterDiscard;
      this.afterDiscard = null;
      return next?.();
    }
    if (this.phase !== 'discard') {
      this.clearTimer();
      this.phase = 'discard';
      this.phaseEndsAt = Date.now() + DISCARD_MS;
      this.timer = setTimeout(() => {
        for (const x of this.active().filter((y) => y.pendingDiscard))
          this.doDiscard(x, secureRandom() < 0.5 ? '+' : '-');
        this.checkDiscards();
      }, DISCARD_MS);
    }
    this.broadcast();
  }

  // ---------- apostas ----------

  private pay(x: Player, n: number) {
    x.chips -= n;
    x.streetBet += n;
    x.contributed += n;
    this.pot += n;
  }

  /** Maior valor que a aposta desta rodada pode atingir. */
  private maxBet(): number {
    const a = this.active()[0];
    return a ? this.handCap - (a.contributed - a.streetBet) : 0;
  }

  private startBetting(street: 1 | 2) {
    this.clearTimer();
    this.phase = street === 1 ? 'bet1' : 'bet2';
    for (const x of this.handOrder()) x.streetBet = 0;
    this.currentBet = 0;
    const act = this.active();
    this.pending = new Set(act.map((x) => x.id));
    this.log(street === 1 ? 'Primeira rodada de apostas' : 'Segunda rodada de apostas');
    this.setTurn(act[0].id);
  }

  private setTurn(id: string) {
    this.turn = id;
    this.phaseEndsAt = Date.now() + BET_TURN_MS;
    this.clearTimer();
    this.timer = setTimeout(() => {
      const x = this.byId(id)!;
      if (x.streetBet === this.currentBet) this.betAction(x, { t: 'check' }, () => {});
      else this.betAction(x, { t: 'fold' }, () => {});
    }, BET_TURN_MS);
    this.broadcast();
  }

  private betAction(x: Player, msg: ClientMsg, err: (m: string) => void) {
    const toCall = this.currentBet - x.streetBet;
    if (msg.t === 'check') {
      if (toCall > 0) return err(`Para continuar, iguale a aposta (${toCall}) ou desista.`);
      this.log(`${x.name} passou a vez`);
    } else if (msg.t === 'call') {
      if (toCall === 0) this.log(`${x.name} passou a vez`);
      else {
        this.pay(x, toCall);
        this.log(`${x.name} igualou (${toCall})`);
      }
    } else if (msg.t === 'raise') {
      const to = Math.trunc(Number(msg.to));
      const max = this.maxBet();
      if (!(to > this.currentBet) || to > max) return err(`O aumento precisa ficar entre ${this.currentBet + 1} e ${max}.`);
      this.pay(x, to - x.streetBet);
      this.log(this.currentBet ? `${x.name} aumentou para ${to}` : `${x.name} apostou ${to}`);
      this.currentBet = to;
      this.pending = new Set(this.active().map((y) => y.id));
    } else if (msg.t === 'fold') {
      x.folded = true;
      this.log(`${x.name} desistiu`);
    } else return;
    this.pending.delete(x.id);

    const act = this.active();
    if (act.length === 1) return this.winByFold(act[0]);
    if (this.pending.size === 0) return this.endStreet();
    // próximo jogador na ordem da mesa que ainda precisa agir
    const order = this.handOrder();
    const i = order.findIndex((y) => y.id === x.id);
    for (let k = 1; k <= order.length; k++) {
      const y = order[(i + k) % order.length];
      if (!y.folded && this.pending.has(y.id)) return this.setTurn(y.id);
    }
  }

  private endStreet() {
    this.clearTimer();
    this.turn = null;
    if (this.phase === 'bet1') {
      for (const x of this.active()) this.dealOpen(x);
      this.log('Cada jogador recebeu mais uma carta aberta');
      this.afterDiscard = () => this.startBuild();
      this.phase = 'bet1'; // checkDiscards troca para 'discard' se preciso
      return this.checkDiscards();
    }
    this.startDeclare();
  }

  // ---------- equação e declaração ----------

  private startBuild() {
    this.clearTimer();
    this.phase = 'build';
    this.phaseEndsAt = Date.now() + BUILD_MS;
    this.log('Montem suas equações');
    this.timer = setTimeout(() => this.startBetting(2), BUILD_MS);
    this.broadcast();
  }

  private startDeclare() {
    this.clearTimer();
    this.phase = 'declare';
    this.phaseEndsAt = Date.now() + DECLARE_MS;
    this.log('Escolham alta (20), baixa (1) ou as duas, e fechem a mão');
    this.timer = setTimeout(() => {
      for (const x of this.active().filter((y) => !y.declared)) {
        x.folded = true;
        this.log(`${x.name} não declarou a tempo e ficou de fora`);
      }
      const act = this.active();
      if (act.length === 1) return this.winByFold(act[0]);
      if (act.length === 0) return this.finishHandNoWinner();
      this.afterDeclare();
    }, DECLARE_MS);
    this.broadcast();
  }

  private afterDeclare() {
    this.clearTimer();
    if (this.active().some((x) => x.side === 'both')) {
      this.phase = 'second';
      this.phaseEndsAt = Date.now() + SECOND_MS;
      this.log('Quem apostou nas duas tem 20 segundos para reorganizar a equação da baixa');
      this.timer = setTimeout(() => {
        for (const x of this.active().filter((y) => y.side === 'both' && !y.secondDone)) {
          x.eqLow = x.eqHigh;
          x.secondDone = true;
          this.log(`${x.name}: tempo esgotado, a equação da baixa ficou igual à da alta`);
        }
        this.doShowdown();
      }, SECOND_MS);
      return this.broadcast();
    }
    this.doShowdown();
  }

  private info(x: Player) {
    return handInfo([x.hidden!, ...x.open], x.ops);
  }

  private checkEq(x: Player, eq: unknown): number | string {
    if (!Array.isArray(eq)) return 'Equação inválida.';
    const r = parse(eq as Token[], this.info(x));
    if (!r.ok) return r.error ?? 'Equação inválida.';
    if (!r.complete) return 'Use todas as suas cartas na equação.';
    return r.value!;
  }

  // ---------- confronto ----------

  private doShowdown() {
    this.clearTimer();
    const order = this.handOrder();
    const valueOf = (x: Player, eq: Token[] | null) => (eq ? (parse(eq, this.info(x)).value ?? null) : null);
    const contenders: Contender[] = this.active().map((x) => ({
      playerId: x.id,
      side: x.side!,
      high: x.side !== 'low' ? valueOf(x, x.eqHigh) : null,
      low: x.side !== 'high' ? valueOf(x, x.eqLow) : null,
      nums: this.info(x).nums,
    }));
    const r = resolve(contenders);
    const { pay, discarded } = payouts(this.pot, r);
    for (const [id, n] of Object.entries(pay)) this.byId(id)!.chips += n;

    this.showdown = {
      byFold: false,
      entries: order.map((x) => ({
        playerId: x.id,
        name: x.name,
        side: x.folded ? null : x.side,
        folded: x.folded,
        eqHigh: x.folded ? null : x.eqHigh,
        eqLow: x.folded ? null : x.eqLow,
        high: x.folded ? null : valueOf(x, x.side !== 'low' ? x.eqHigh : null),
        low: x.folded ? null : valueOf(x, x.side !== 'high' ? x.eqLow : null),
      })),
      highWinner: r.highWinner,
      lowWinner: r.lowWinner,
      doubleLosers: r.doubleLosers,
      pay,
      pot: this.pot,
      discarded,
    };
    for (const c of contenders) {
      const x = this.byId(c.playerId)!;
      const parts = [];
      if (c.high !== null) parts.push(`alta ${fmt(c.high)}`);
      if (c.low !== null) parts.push(`baixa ${fmt(c.low)}`);
      this.log(`${x.name}: ${parts.join(', ')}`);
    }
    const nameOf = (id: string | null) => (id ? this.byId(id)!.name : null);
    if (r.highWinner) this.log(`Alta (${TARGET.high}): ${nameOf(r.highWinner)} venceu`);
    if (r.lowWinner) this.log(`Baixa (${TARGET.low}): ${nameOf(r.lowWinner)} venceu`);
    for (const id of r.doubleLosers) this.log(`${nameOf(id)} apostou nas duas e não venceu as duas: perdeu a aposta`);
    if (discarded) this.log(`${discarded} ficha descartada (pote ímpar)`);
    this.pot = 0;
    this.phase = 'showdown';
    this.phaseEndsAt = 0;
    this.turn = null;
    this.broadcast();
  }

  private winByFold(x: Player) {
    this.clearTimer();
    x.chips += this.pot;
    this.log(`Todos desistiram: ${x.name} leva o pote de ${this.pot}`);
    this.showdown = {
      byFold: true,
      entries: this.handOrder().map((y) => ({
        playerId: y.id,
        name: y.name,
        side: null,
        folded: y.folded,
        eqHigh: null,
        eqLow: null,
        high: null,
        low: null,
      })),
      highWinner: null,
      lowWinner: null,
      doubleLosers: [],
      pay: { [x.id]: this.pot },
      pot: this.pot,
      discarded: 0,
    };
    this.pot = 0;
    this.phase = 'showdown';
    this.phaseEndsAt = 0;
    this.turn = null;
    this.broadcast();
  }

  private finishHandNoWinner() {
    this.log(`Ninguém declarou: o pote de ${this.pot} foi descartado`);
    this.showdown = {
      byFold: true,
      entries: [],
      highWinner: null,
      lowWinner: null,
      doubleLosers: [],
      pay: {},
      pot: this.pot,
      discarded: this.pot,
    };
    this.pot = 0;
    this.phase = 'showdown';
    this.turn = null;
    this.broadcast();
  }

  private finish(reason: string) {
    this.clearTimer();
    this.phase = 'final';
    this.turn = null;
    this.log(reason);
    this.broadcast();
  }

  private reset() {
    this.clearTimer();
    this.hostId = null;
    this.phase = 'lobby';
    this.seats = [];
    this.showdown = null;
    this.feed = [];
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------- envio ----------

  private log(line: string) {
    this.feed.push(line);
    if (this.feed.length > 16) this.feed.shift();
  }

  private snapshot(viewerId: string | undefined): RoomState {
    const seated = this.seatedIds();
    const reveal = this.phase === 'showdown' && !this.showdown?.byFold;
    const timed = !['lobby', 'showdown', 'final'].includes(this.phase);
    return {
      phase: this.phase,
      hand: this.hand,
      config: { ...this.config },
      players: this.ordered()
        .sort((a, b) => {
          const ia = seated.indexOf(a.id);
          const ib = seated.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.joinedAt - b.joinedAt;
        })
        .map((x) => ({
          id: x.id,
          name: x.name,
          isHost: x.id === this.hostId,
          role: seated.includes(x.id) ? 'player' : 'spectator',
          chips: x.chips,
          inHand: x.inHand,
          folded: x.folded,
          contributed: x.contributed,
          streetBet: x.streetBet,
          hidden: x.id === viewerId || (reveal && !x.folded) ? x.hidden : null,
          open: x.open,
          ops: x.ops,
          discardedOp: x.discardedOp,
          pendingDiscard: x.pendingDiscard,
          ready: x.ready,
          declared: x.declared,
          secondDone: x.secondDone,
          isFirst: this.phase !== 'lobby' && this.seats[this.firstIdx] === x.id,
        })),
      pot: this.pot,
      currentBet: this.currentBet,
      maxBet: this.phase === 'bet1' || this.phase === 'bet2' ? this.maxBet() : 0,
      turn: this.turn,
      showdown: this.phase === 'showdown' ? this.showdown : null,
      endsInMs: timed && this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - Date.now()) : 0,
      feed: [...this.feed],
    };
  }

  private broadcast() {
    for (const [ws, x] of this.players) {
      try {
        ws.send(JSON.stringify({ t: 'state', state: this.snapshot(x.id) } satisfies ServerMsg));
      } catch {
        /* conexão já fechada */
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* conexão já fechada */
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/sala\/([A-Za-z0-9]{3,8})\/ws$/);
    if (m) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase()));
      return stub.fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Não encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
