import { DurableObject } from 'cloudflare:workers';
import {
  generateShape,
  layerCounts,
  totalCubes,
  type Difficulty,
  type Shape,
} from '../shared/shapes';
import {
  MAX_PLAYERS,
  REVEAL_MS,
  ROUND_MS,
  ROUND_OPTIONS,
  WRONG_LOCK_MS,
  type ClientMsg,
  type GameConfig,
  type Phase,
  type RevealView,
  type RoomState,
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
  lockedUntil: number;
  joinedAt: number;
  ws: WebSocket;
}

const DIFFICULTIES: Difficulty[] = ['facil', 'medio', 'dificil'];

/**
 * Uma sala de jogo. Cada código de sala vira um Durable Object: uma única
 * instância, com estado em memória, que recebe todas as conexões da sala.
 * As mensagens chegam em ordem, então "quem acertou primeiro" é decidido aqui.
 */
export class Room extends DurableObject<Env> {
  private sockets = new Set<WebSocket>();
  private players = new Map<WebSocket, Player>();
  private hostId: string | null = null;
  private phase: Phase = 'lobby';
  private config: GameConfig = { difficulty: 'medio', rounds: 5 };
  private round = 0;
  private shape: Shape | null = null;
  private shapeId = 0;
  private answer = 0;
  private phaseEndsAt = 0;
  private reveal: RevealView | null = null;
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
        if (this.players.size >= MAX_PLAYERS)
          return this.send(ws, { t: 'error', message: 'Sala cheia.' });
        const p: Player = {
          id: crypto.randomUUID(),
          name,
          score: 0,
          lockedUntil: 0,
          joinedAt: Date.now(),
          ws,
        };
        this.players.set(ws, p);
        if (!this.hostId) this.hostId = p.id;
        this.send(ws, { t: 'welcome', id: p.id });
        this.log(`${name} entrou`);
        return this.broadcast();
      }
      case 'config': {
        if (!isHost || this.phase === 'round' || this.phase === 'reveal') return;
        if (DIFFICULTIES.includes(msg.difficulty)) this.config.difficulty = msg.difficulty;
        if (ROUND_OPTIONS.includes(msg.rounds)) this.config.rounds = msg.rounds;
        return this.broadcast();
      }
      case 'start': {
        if (!isHost || this.phase === 'round' || this.phase === 'reveal') return;
        for (const p of this.players.values()) p.score = 0;
        this.round = 0;
        this.feed = [];
        return this.nextRound();
      }
      case 'again': {
        if (!isHost || this.phase !== 'final') return;
        this.phase = 'lobby';
        this.reveal = null;
        return this.broadcast();
      }
      case 'guess': {
        if (!player || this.phase !== 'round') return;
        const now = Date.now();
        if (now < player.lockedUntil) {
          return this.send(ws, { t: 'wrong', lockMs: player.lockedUntil - now });
        }
        const value = Math.trunc(Number(msg.value));
        if (!Number.isFinite(value) || value < 0) return;
        if (value === this.answer) {
          player.score += 1;
          return this.endRound(player);
        }
        player.lockedUntil = now + WRONG_LOCK_MS;
        this.send(ws, { t: 'wrong', lockMs: WRONG_LOCK_MS });
        this.log(`${player.name} errou`);
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
      const next = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      this.hostId = next.id;
      this.log(`${next.name} agora é o anfitrião`);
    }
    this.log(`${p.name} saiu`);
    this.broadcast();
  }

  // ---------- fluxo do jogo ----------

  private nextRound() {
    this.clearTimer();
    this.round += 1;
    this.shape = generateShape(this.config.difficulty);
    this.shapeId += 1;
    this.answer = totalCubes(this.shape.heights);
    this.reveal = null;
    this.phase = 'round';
    for (const p of this.players.values()) p.lockedUntil = 0;
    const ms = ROUND_MS[this.config.difficulty];
    this.phaseEndsAt = Date.now() + ms;
    this.timer = setTimeout(() => this.endRound(null), ms);
    this.log(`Rodada ${this.round} de ${this.config.rounds}`);
    this.broadcast();
  }

  private endRound(winner: Player | null) {
    if (this.phase !== 'round' || !this.shape) return;
    this.clearTimer();
    this.phase = 'reveal';
    this.reveal = {
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      answer: this.answer,
      layers: layerCounts(this.shape.heights),
      shapeName: this.shape.name,
    };
    this.log(winner ? `${winner.name} acertou: ${this.answer}` : `Tempo esgotado: eram ${this.answer}`);
    this.phaseEndsAt = Date.now() + REVEAL_MS;
    this.timer = setTimeout(() => {
      if (this.round < this.config.rounds) this.nextRound();
      else {
        this.phase = 'final';
        this.broadcast();
      }
    }, REVEAL_MS);
    this.broadcast();
  }

  private reset() {
    this.clearTimer();
    this.hostId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.shape = null;
    this.reveal = null;
    this.feed = [];
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------- envio ----------

  private log(line: string) {
    this.feed.push(line);
    if (this.feed.length > 8) this.feed.shift();
  }

  private snapshot(): RoomState {
    const showShape = this.phase === 'round' || this.phase === 'reveal';
    return {
      phase: this.phase,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({ id: p.id, name: p.name, score: p.score, isHost: p.id === this.hostId })),
      config: { ...this.config },
      round: this.round,
      totalRounds: this.config.rounds,
      endsInMs: showShape ? Math.max(0, this.phaseEndsAt - Date.now()) : 0,
      shape:
        showShape && this.shape
          ? { id: this.shapeId, nx: this.shape.nx, nz: this.shape.nz, heights: this.shape.heights }
          : null,
      reveal: this.phase === 'reveal' ? this.reveal : null,
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
