import { DurableObject } from 'cloudflare:workers';
import {
  cardLabel,
  compareHands,
  evaluate,
  letterOf,
  newDeck,
  shuffle,
  type Card,
} from '../shared/cards';
import {
  BOARD_SIZE,
  CHOOSE_MS,
  MAX_CONNECTIONS,
  MEMORIZE_MS,
  ROUND_OPTIONS,
  type ClientMsg,
  type GameConfig,
  type Phase,
  type PickResult,
  type RoomState,
  type RoundResult,
  type ServerMsg,
} from '../shared/protocol';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
}

/** Embaralhamento com aleatoriedade criptográfica: ninguém prevê as cartas. */
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * Uma sala do Poker da Memória. Os dois primeiros a entrar disputam;
 * quem chegar depois assiste. As faces das cartas só saem do servidor
 * durante a memorização e a revelação.
 */
export class Room extends DurableObject<Env> {
  private sockets = new Set<WebSocket>();
  private players = new Map<WebSocket, Player>();
  private hostId: string | null = null;
  private phase: Phase = 'lobby';
  private config: GameConfig = { rounds: 3 };
  private round = 0;
  /** ids dos 2 jogadores que estão disputando a partida atual */
  private seats: string[] = [];
  private board: Card[] = [];
  private open: Card[] = [];
  private picks = new Map<string, [number, number]>();
  private result: RoundResult | null = null;
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

  /** No lobby, os 2 primeiros da fila jogam. Durante a partida, valem os assentos fixados no início. */
  private seatedIds(): string[] {
    if (this.phase === 'lobby') return this.ordered().slice(0, 2).map((p) => p.id);
    return this.seats;
  }

  private byId(id: string): Player | undefined {
    for (const p of this.players.values()) if (p.id === id) return p;
    return undefined;
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
        const p: Player = { id: crypto.randomUUID(), name, score: 0, joinedAt: Date.now() };
        this.players.set(ws, p);
        if (!this.hostId) this.hostId = p.id;
        this.send(ws, { t: 'welcome', id: p.id });
        this.log(`${name} entrou`);
        return this.broadcast();
      }
      case 'config': {
        if (!isHost || this.phase !== 'lobby') return;
        if (ROUND_OPTIONS.includes(msg.rounds)) this.config.rounds = msg.rounds;
        return this.broadcast();
      }
      case 'start': {
        if (!isHost || (this.phase !== 'lobby' && this.phase !== 'final')) return;
        const seated = this.ordered().slice(0, 2);
        if (seated.length < 2)
          return this.send(ws, { t: 'error', message: 'É preciso 2 jogadores para começar.' });
        this.seats = seated.map((p) => p.id);
        for (const p of this.players.values()) p.score = 0;
        this.round = 0;
        this.feed = [];
        this.log(`Partida: ${seated[0].name} x ${seated[1].name}`);
        return this.startRound();
      }
      case 'pick': {
        if (!player || this.phase !== 'choose' || !this.seats.includes(player.id)) return;
        if (this.picks.has(player.id)) return;
        const [a, b] = (Array.isArray(msg.picks) ? msg.picks : []).map((n) => Math.trunc(Number(n)));
        const valid = (n: number) => Number.isInteger(n) && n >= 0 && n < BOARD_SIZE;
        if (!valid(a) || !valid(b) || a === b)
          return this.send(ws, { t: 'error', message: 'Escolha 2 cartas diferentes.' });
        this.picks.set(player.id, [Math.min(a, b), Math.max(a, b)]);
        this.log(`${player.name} escolheu`);
        if (this.seats.every((id) => this.picks.has(id))) return this.revealRound();
        return this.broadcast();
      }
      case 'next': {
        if (!isHost || this.phase !== 'reveal') return;
        if (this.round < this.config.rounds) return this.startRound();
        this.phase = 'final';
        const [a, b] = this.seats.map((id) => this.byId(id)!);
        this.log(
          a.score === b.score
            ? `Partida empatada em ${a.score} a ${b.score}`
            : `${(a.score > b.score ? a : b).name} venceu a partida`,
        );
        return this.broadcast();
      }
      case 'again': {
        if (!isHost || this.phase !== 'final') return;
        this.phase = 'lobby';
        this.result = null;
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
    // um dos dois jogadores saiu no meio da partida: volta para o lobby
    if (this.phase !== 'lobby' && this.seats.includes(p.id)) {
      this.clearTimer();
      this.phase = 'lobby';
      this.result = null;
      this.seats = [];
      this.log('Partida interrompida');
    }
    this.broadcast();
  }

  // ---------- fluxo da rodada ----------

  private startRound() {
    this.clearTimer();
    this.round += 1;
    const deck = shuffle(newDeck(), secureRandom);
    this.board = deck.slice(0, BOARD_SIZE);
    this.open = deck.slice(BOARD_SIZE, BOARD_SIZE + 3);
    this.picks.clear();
    this.result = null;
    this.phase = 'memorize';
    this.phaseEndsAt = Date.now() + MEMORIZE_MS;
    this.timer = setTimeout(() => this.startChoose(), MEMORIZE_MS);
    this.log(`Rodada ${this.round} de ${this.config.rounds}: memorizem!`);
    this.broadcast();
  }

  private startChoose() {
    this.clearTimer();
    this.phase = 'choose';
    this.phaseEndsAt = Date.now() + CHOOSE_MS;
    this.timer = setTimeout(() => this.revealRound(), CHOOSE_MS);
    this.log(`Cartas abertas: ${this.open.map(cardLabel).join(' ')}`);
    this.broadcast();
  }

  private revealRound() {
    if (this.phase !== 'choose') return;
    this.clearTimer();
    const results: PickResult[] = this.seats.map((id) => {
      const p = this.byId(id);
      const picks = this.picks.get(id) ?? null;
      return {
        playerId: id,
        name: p?.name ?? '?',
        picks,
        hand: picks ? evaluate([this.board[picks[0]], this.board[picks[1]], ...this.open]) : null,
      };
    });
    const [a, b] = results;
    let winnerId: string | null = null;
    if (a.hand && b.hand) {
      const c = compareHands(a.hand, b.hand);
      winnerId = c > 0 ? a.playerId : c < 0 ? b.playerId : null;
    } else if (a.hand) winnerId = a.playerId;
    else if (b.hand) winnerId = b.playerId;

    for (const r of results)
      this.log(
        r.picks
          ? `${r.name}: ${letterOf(r.picks[0])} + ${letterOf(r.picks[1])} = ${r.hand!.name}`
          : `${r.name} não escolheu a tempo`,
      );
    if (winnerId) {
      const w = this.byId(winnerId);
      if (w) w.score += 1;
      this.log(`${w?.name ?? '?'} venceu a rodada`);
    } else this.log('Rodada empatada');

    this.result = { results, winnerId };
    this.phase = 'reveal';
    this.phaseEndsAt = 0;
    this.broadcast();
  }

  private reset() {
    this.clearTimer();
    this.hostId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.seats = [];
    this.result = null;
    this.feed = [];
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------- envio ----------

  private log(line: string) {
    this.feed.push(line);
    if (this.feed.length > 10) this.feed.shift();
  }

  private snapshot(): RoomState {
    const seated = this.seatedIds();
    const faceUp = this.phase === 'memorize' || this.phase === 'reveal';
    const inRound = this.phase === 'memorize' || this.phase === 'choose' || this.phase === 'reveal';
    return {
      phase: this.phase,
      players: this.ordered().map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isHost: p.id === this.hostId,
        role: seated.includes(p.id) ? 'player' : 'spectator',
        chosen: this.picks.has(p.id),
      })),
      config: { ...this.config },
      round: this.round,
      totalRounds: this.config.rounds,
      endsInMs: this.phaseEndsAt && inRound ? Math.max(0, this.phaseEndsAt - Date.now()) : 0,
      board: inRound ? this.board.map((c) => (faceUp ? c : null)) : null,
      open: this.phase === 'choose' || this.phase === 'reveal' ? this.open : null,
      result: this.phase === 'reveal' ? this.result : null,
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
