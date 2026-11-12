import { DurableObject } from 'cloudflare:workers';
import {
  CHIPS,
  CHIP_NAME,
  LIMIT,
  ROUNDS,
  START_CHIPS,
  SUPPORTS,
  SUPPORT_NAME,
  WEIGHTS,
  lightest,
  place,
  playOrder,
  type Chip,
  type Cube,
  type Support,
} from '../shared/rules';
import {
  AUTO_PLACE_MS,
  CHOOSE_MS,
  MAX_CONNECTIONS,
  MAX_SEATS,
  ROUND_END_MS,
  TURN_MS,
  type ClientMsg,
  type EventView,
  type OrderEntry,
  type Phase,
  type RoomState,
  type ServerMsg,
  type TurnView,
} from '../shared/protocol';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

interface Player {
  id: string;
  name: string;
  joinedAt: number;
  penalty: number;
  cubes: number[];
  chips: Record<Chip, number>;
  choice: { weight: number; chip: Chip } | null;
}

const emptySupports = (): Record<Support, Cube[]> => ({ R: [], G: [], B: [] });

/**
 * Uma sala do 13 Pesado. Os 8 primeiros a entrar jogam; os demais assistem.
 * A ordem dos lugares (ordem de chegada) é o "sentido horário" da mesa.
 */
export class Room extends DurableObject<Env> {
  private sockets = new Set<WebSocket>();
  private players = new Map<WebSocket, Player>();
  private hostId: string | null = null;
  private phase: Phase = 'lobby';
  private round = 0;
  /** ids na ordem da mesa (sentido horário), fixados no início da partida */
  private seats: string[] = [];
  private firstIdx = 0;
  private supports = emptySupports();
  private order: OrderEntry[] | null = null;
  private ptr = 0;
  private passStack: string[] = [];
  private turn: TurnView | null = null;
  private lastEvent: EventView | null = null;
  private roundPenalties: Record<string, number> = {};
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

  private seatedIds(): string[] {
    if (this.phase === 'lobby') return this.ordered().slice(0, MAX_SEATS).map((p) => p.id);
    return this.seats;
  }

  private byId(id: string): Player | undefined {
    for (const p of this.players.values()) if (p.id === id) return p;
    return undefined;
  }

  private entry(id: string): OrderEntry | undefined {
    return this.order?.find((e) => e.playerId === id);
  }

  // ---------- mensagens ----------

  private onMessage(ws: WebSocket, raw: unknown) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const player = this.players.get(ws);
    const isHost = !!player && player.id === this.hostId;

    switch (msg.t) {
      case 'join': {
        if (player) return;
        const name = String(msg.name ?? '').trim().slice(0, 20);
        if (!name) return this.send(ws, { t: 'error', message: 'Digite um nome.' });
        if (this.players.size >= MAX_CONNECTIONS)
          return this.send(ws, { t: 'error', message: 'Sala cheia.' });
        const p: Player = {
          id: crypto.randomUUID(),
          name,
          joinedAt: Date.now(),
          penalty: 0,
          cubes: [...WEIGHTS],
          chips: { ...START_CHIPS },
          choice: null,
        };
        this.players.set(ws, p);
        if (!this.hostId) this.hostId = p.id;
        this.send(ws, { t: 'welcome', id: p.id });
        this.log(`${name} entrou`);
        return this.broadcast();
      }

      case 'start': {
        if (!isHost || (this.phase !== 'lobby' && this.phase !== 'final')) return;
        const seated = this.ordered().slice(0, MAX_SEATS);
        if (seated.length < 2)
          return this.send(ws, { t: 'error', message: 'É preciso pelo menos 2 jogadores.' });
        this.seats = seated.map((p) => p.id);
        for (const p of this.players.values()) {
          p.penalty = 0;
          p.cubes = [...WEIGHTS];
          p.chips = { ...START_CHIPS };
          p.choice = null;
        }
        this.supports = emptySupports();
        this.round = 0;
        this.feed = [];
        this.firstIdx = Math.floor(Math.random() * this.seats.length);
        this.log(`Partida com ${seated.map((p) => p.name).join(', ')}`);
        return this.startRound();
      }

      case 'choose': {
        if (!player || this.phase !== 'choose' || !this.seats.includes(player.id) || player.choice) return;
        const weight = Math.trunc(Number(msg.weight));
        if (!player.cubes.includes(weight))
          return this.send(ws, { t: 'error', message: 'Você não tem mais esse cubo.' });
        if (!CHIPS.includes(msg.chip) || player.chips[msg.chip] <= 0)
          return this.send(ws, { t: 'error', message: 'Você não tem mais essa ficha.' });
        player.choice = { weight, chip: msg.chip };
        this.log(`${player.name} escolheu`);
        return this.afterChoice();
      }

      case 'place':
      case 'pass': {
        if (!player || this.phase !== 'place' || this.turn?.playerId !== player.id) return;
        const e = this.entry(player.id)!;
        if (msg.t === 'pass') {
          if (this.turn.forced)
            return this.send(ws, { t: 'error', message: 'Você já passou: agora precisa colocar.' });
          e.passed = true;
          this.passStack.push(player.id);
          this.event(`${player.name} passou a vez`, null, false);
          return this.advance();
        }
        const support = e.chip === 'W' ? msg.support : e.chip;
        if (!support || !SUPPORTS.includes(support))
          return this.send(ws, { t: 'error', message: 'Escolha um suporte.' });
        this.doPlace(e, support);
        return this.advance();
      }

      case 'again': {
        if (!isHost || this.phase !== 'final') return;
        this.phase = 'lobby';
        this.order = null;
        this.turn = null;
        this.lastEvent = null;
        this.supports = emptySupports();
        return this.broadcast();
      }
    }
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
      this.order = null;
      this.turn = null;
      this.lastEvent = null;
      this.supports = emptySupports();
      this.seats = [];
      this.log('Partida interrompida');
    }
    this.broadcast();
  }

  // ---------- fluxo ----------

  private startRound() {
    this.clearTimer();
    this.round += 1;
    if (this.round > 1) this.firstIdx = (this.firstIdx + 1) % this.seats.length;
    this.order = null;
    this.turn = null;
    this.lastEvent = null;
    this.ptr = 0;
    this.passStack = [];
    this.roundPenalties = {};
    this.phase = 'choose';
    const first = this.byId(this.seats[this.firstIdx]);
    this.log(`Rodada ${this.round} de ${ROUNDS}. Primeiro jogador: ${first?.name}`);
    // última rodada (ou qualquer caso com uma única opção): escolha automática
    for (const id of this.seats) {
      const p = this.byId(id)!;
      p.choice = null;
      const chips = CHIPS.filter((c) => p.chips[c] > 0);
      if (p.cubes.length === 1 && chips.length === 1) p.choice = { weight: p.cubes[0], chip: chips[0] };
    }
    this.phaseEndsAt = Date.now() + CHOOSE_MS;
    this.timer = setTimeout(() => this.autoChoose(), CHOOSE_MS);
    this.afterChoice();
  }

  private autoChoose() {
    for (const id of this.seats) {
      const p = this.byId(id)!;
      if (p.choice) continue;
      const chips = CHIPS.filter((c) => p.chips[c] > 0);
      p.choice = {
        weight: p.cubes[Math.floor(Math.random() * p.cubes.length)],
        chip: chips[Math.floor(Math.random() * chips.length)],
      };
      this.log(`${p.name} não escolheu a tempo: escolha sorteada`);
    }
    this.afterChoice();
  }

  private afterChoice() {
    if (this.seats.every((id) => this.byId(id)?.choice)) return this.startPlacing();
    this.broadcast();
  }

  private startPlacing() {
    this.clearTimer();
    const choices = this.seats.map((id) => {
      const p = this.byId(id)!;
      const c = p.choice!;
      p.cubes = p.cubes.filter((w) => w !== c.weight);
      p.chips[c.chip] -= 1;
      return { playerId: id, weight: c.weight, chip: c.chip };
    });
    this.order = playOrder(choices, this.seats, this.firstIdx).map((c) => ({
      ...c,
      name: this.byId(c.playerId)!.name,
      passed: false,
      placed: false,
      support: null,
      removed: 0,
    }));
    this.log(
      'Ordem: ' + this.order.map((e) => `${e.name} (${e.weight}, ${CHIP_NAME[e.chip]})`).join(' → '),
    );
    this.phase = 'place';
    this.ptr = 0;
    this.beginTurn();
  }

  private beginTurn() {
    this.clearTimer();
    const order = this.order!;
    if (this.ptr < order.length) {
      this.turn = { playerId: order[this.ptr].playerId, forced: false };
      this.armTurnTimer();
      return this.broadcast();
    }
    const id = this.passStack.pop();
    if (id) {
      const e = this.entry(id)!;
      this.turn = { playerId: id, forced: true };
      if (e.chip === 'W') {
        this.armTurnTimer();
      } else {
        // sem decisão a tomar: coloca sozinho após uma pausa para todos verem
        this.phaseEndsAt = 0;
        this.timer = setTimeout(() => {
          this.doPlace(e, e.chip as Support);
          this.advance();
        }, AUTO_PLACE_MS);
      }
      return this.broadcast();
    }
    this.turn = null;
    this.endRound();
  }

  private armTurnTimer() {
    this.phaseEndsAt = Date.now() + TURN_MS;
    this.timer = setTimeout(() => {
      const e = this.entry(this.turn!.playerId)!;
      const support = e.chip === 'W' ? lightest(this.supports) : e.chip;
      this.log(`${e.name}: tempo esgotado, cubo colocado automaticamente`);
      this.doPlace(e, support);
      this.advance();
    }, TURN_MS);
  }

  private advance() {
    if (this.turn && !this.turn.forced) this.ptr += 1;
    this.beginTurn();
  }

  private doPlace(e: OrderEntry, support: Support) {
    const r = place(this.supports[support], { w: e.weight, ownerId: e.playerId });
    this.supports[support] = r.stack;
    e.placed = true;
    e.support = support;
    e.removed = r.removed;
    if (r.removed > 0) {
      const p = this.byId(e.playerId);
      if (p) p.penalty += r.removed;
      this.roundPenalties[e.playerId] = (this.roundPenalties[e.playerId] ?? 0) + r.removed;
      this.event(
        `${e.name} colocou ${e.weight} no ${SUPPORT_NAME[support]}: ${r.sum} passou de ${LIMIT}! ` +
          `${r.removed} cubo(s) retirado(s), penalidade −${r.removed}`,
        support,
        true,
      );
    } else {
      this.event(`${e.name} colocou ${e.weight} no ${SUPPORT_NAME[support]} (total ${r.sum})`, support, false);
    }
  }

  private endRound() {
    this.clearTimer();
    this.phase = 'roundEnd';
    this.phaseEndsAt = Date.now() + ROUND_END_MS;
    this.timer = setTimeout(() => {
      if (this.round < ROUNDS) return this.startRound();
      this.phase = 'final';
      const ranked = this.seats.map((id) => this.byId(id)!).sort((a, b) => a.penalty - b.penalty);
      const best = ranked.filter((p) => p.penalty === ranked[0].penalty);
      this.log(
        best.length > 1
          ? `Empate: ${best.map((p) => p.name).join(' e ')} com −${best[0].penalty}`
          : `${best[0].name} venceu com −${best[0].penalty}`,
      );
      this.broadcast();
    }, ROUND_END_MS);
    this.broadcast();
  }

  private reset() {
    this.clearTimer();
    this.hostId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.seats = [];
    this.order = null;
    this.turn = null;
    this.lastEvent = null;
    this.supports = emptySupports();
    this.feed = [];
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------- envio ----------

  private event(text: string, support: Support | null, bust: boolean) {
    this.lastEvent = { text, support, bust };
    this.log(text);
  }

  private log(line: string) {
    this.feed.push(line);
    if (this.feed.length > 14) this.feed.shift();
  }

  private snapshot(): RoomState {
    const seated = this.seatedIds();
    const timed = this.phase === 'choose' || this.phase === 'place' || this.phase === 'roundEnd';
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: ROUNDS,
      players: this.ordered()
        .sort((a, b) => {
          const ia = seated.indexOf(a.id);
          const ib = seated.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.joinedAt - b.joinedAt;
        })
        .map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.id === this.hostId,
          role: seated.includes(p.id) ? 'player' : 'spectator',
          penalty: p.penalty,
          cubesLeft: [...p.cubes].sort((a, b) => a - b),
          chipsLeft: { ...p.chips },
          chosen: this.phase === 'choose' && !!p.choice,
          isFirst: this.phase !== 'lobby' && this.seats[this.firstIdx] === p.id,
        })),
      supports: this.supports,
      order: this.order,
      turn: this.turn,
      lastEvent: this.lastEvent,
      roundPenalties: this.roundPenalties,
      endsInMs: timed && this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - Date.now()) : 0,
      feed: [...this.feed],
    };
  }

  private broadcast() {
    const data = JSON.stringify({ t: 'state', state: this.snapshot() } satisfies ServerMsg);
    for (const ws of this.players.keys()) {
      try {
        ws.send(data);
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
