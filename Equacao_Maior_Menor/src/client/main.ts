import {
  OP_LABEL,
  SUIT_LABEL,
  fmt,
  handInfo,
  parse,
  type Card,
  type HandInfo,
  type Op,
  type Side,
  type Token,
} from '../shared/game';
import type { ClientMsg, PlayerView, RoomState, ServerMsg } from '../shared/protocol';
import { handSvg } from './hand';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  home: $('screen-home'),
  room: $('screen-room'),
  name: $<HTMLInputElement>('name'),
  code: $<HTMLInputElement>('code'),
  create: $<HTMLButtonElement>('btn-create'),
  join: $<HTMLButtonElement>('btn-join'),
  homeError: $('home-error'),
  roomCode: $('room-code'),
  copy: $<HTMLButtonElement>('btn-copy'),
  pot: $('pot'),
  others: $('others'),
  me: $('me'),
  stage: $('stage'),
  roundLabel: $('round-label'),
  phaseLabel: $('phase-label'),
  timer: $('timer'),
  scoreboard: $('scoreboard'),
  feed: $('feed'),
};

// ---------- utilidades ----------

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* armazenamento indisponível */
    }
  },
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function randomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function cardHtml(c: Card | null, extra = '') {
  if (!c) return `<div class="card back ${extra}" title="Carta oculta"><span>?</span></div>`;
  if (c.kind === 'num')
    return `<div class="card num m-${c.suit} ${extra}" title="${c.value} de ${SUIT_LABEL[c.suit]}">
      <b>${c.value}</b><small>${SUIT_LABEL[c.suit]}</small></div>`;
  return `<div class="card special ${extra}" title="${c.kind === 'sqrt' ? 'Raiz quadrada' : 'Multiplicação'}"><b>${
    c.kind === 'sqrt' ? '√' : '×'
  }</b></div>`;
}

const opHtml = (op: Op, extra = '') => `<div class="card op ${extra}"><b>${OP_LABEL[op]}</b></div>`;

/** Equação como texto (para confronto e prévias). */
function eqText(tokens: Token[], cards: Card[]): string {
  return tokens
    .map((t) => {
      if (t.t === 'op') return ` ${OP_LABEL[t.op]} `;
      if (t.t === 'sqrt') return '√';
      const c = cards.find((x) => x.id === t.id);
      return c && c.kind === 'num' ? String(c.value) : '?';
    })
    .join('');
}

const SIDE_LABEL: Record<Side, string> = { low: 'baixa (1)', high: 'alta (20)', both: 'alta e baixa' };

// ---------- estado do cliente ----------

let ws: WebSocket | null = null;
let myId: string | null = null;
let roomCode = '';
let state: RoomState | null = null;
let deadline = 0;
let lastError = '';
let localHand = -1;
let draft: Token[] = [];
let secondEq: Token[] = [];
let declSide: { low: boolean; high: boolean } = { low: false, high: false };
let mySide: Side | null = null;
let raiseTo = 0;
let closing = false;

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------- tela inicial ----------

els.name.value = store.get('em-name') ?? '';
const urlCode = new URLSearchParams(location.search).get('sala');
if (urlCode) els.code.value = urlCode.toUpperCase();

function enter(code: string) {
  const name = els.name.value.trim();
  if (!name) {
    els.homeError.textContent = 'Digite seu nome primeiro.';
    els.name.focus();
    return;
  }
  if (!/^[A-Za-z0-9]{3,8}$/.test(code)) {
    els.homeError.textContent = 'Código de sala inválido.';
    return;
  }
  store.set('em-name', name);
  connect(code.toUpperCase(), name);
}

els.create.addEventListener('click', () => enter(randomCode()));
els.join.addEventListener('click', () => enter(els.code.value.trim()));
els.code.addEventListener('keydown', (e) => e.key === 'Enter' && enter(els.code.value.trim()));
els.name.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enter(els.code.value.trim() || randomCode());
});

// ---------- conexão ----------

function connect(code: string, name: string) {
  roomCode = code;
  els.homeError.textContent = '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/sala/${code}/ws`);
  ws.addEventListener('open', () => send({ t: 'join', name }));
  ws.addEventListener('message', (ev) => onServer(JSON.parse(ev.data) as ServerMsg));
  ws.addEventListener('close', () => {
    if (!myId) {
      els.homeError.textContent = 'Não foi possível conectar à sala.';
      return;
    }
    els.stage.innerHTML = `
      <div class="panel-card">
        <h3>Conexão perdida</h3>
        <p class="muted">Sua partida nesta sala foi perdida.</p>
        <button class="primary" id="btn-reconnect">Entrar de novo</button>
      </div>`;
    $('btn-reconnect').addEventListener('click', () => {
      myId = null;
      connect(roomCode, name);
    });
  });
}

function onServer(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      myId = msg.id;
      els.home.classList.add('hidden');
      els.room.classList.remove('hidden');
      els.roomCode.textContent = roomCode;
      history.replaceState(null, '', `?sala=${roomCode}`);
      break;
    case 'error':
      if (!myId) els.homeError.textContent = msg.message;
      else {
        lastError = msg.message;
        closing = false;
        render();
      }
      break;
    case 'state':
      state = msg.state;
      deadline = performance.now() + msg.state.endsInMs;
      lastError = '';
      render();
      break;
  }
}

els.copy.addEventListener('click', async () => {
  const url = `${location.origin}/?sala=${roomCode}`;
  try {
    await navigator.clipboard.writeText(url);
    els.copy.textContent = 'Copiado!';
  } catch {
    els.copy.textContent = url;
  }
  setTimeout(() => (els.copy.textContent = 'Copiar link'), 2000);
});

// ---------- montador de equação ----------

function myCards(me: PlayerView): Card[] {
  return [...(me.hidden ? [me.hidden] : []), ...me.open];
}

function builderHtml(hand: HandInfo, cards: Card[], tokens: Token[], title: string, target: 'low' | 'high' | null) {
  const p = parse(tokens, hand);
  const usedOps = [...p.usedOps];
  const opsLeft = [...hand.ops];
  for (const o of usedOps) opsLeft.splice(opsLeft.indexOf(o), 1);

  const slots = tokens
    .map((t) => {
      if (t.t === 'op') return opHtml(t.op, 'mini');
      if (t.t === 'sqrt') return `<div class="card special mini"><b>√</b></div>`;
      return cardHtml(cards.find((c) => c.id === t.id) ?? null, 'mini');
    })
    .join('');

  const canNum = p.ok && p.expectNumber;
  const canOp = p.ok && !p.expectNumber;
  const palette = [
    ...hand.nums.map(
      (c) =>
        `<button class="tok" data-k="num" data-id="${c.id}" ${canNum && !p.usedNums.has(c.id) ? '' : 'disabled'}>${cardHtml(c, 'mini')}</button>`,
    ),
    ...hand.sqrtIds.map(
      (id) =>
        `<button class="tok" data-k="sqrt" data-id="${id}" ${canNum && !p.pendingSqrt && !p.usedSqrt.has(id) ? '' : 'disabled'}><div class="card special mini"><b>√</b></div></button>`,
    ),
    ...hand.ops.map((op, i) => {
      const left = opsLeft.includes(op);
      return `<button class="tok" data-k="op" data-op="${op}" data-i="${i}" ${canOp && left ? '' : 'disabled'}>${opHtml(op, 'mini')}</button>`;
    }),
  ].join('');

  let preview = '';
  if (!p.ok) preview = `<span class="bad">${escapeHtml(p.error ?? '')}</span>`;
  else if (p.value !== undefined) {
    const v = p.value;
    const dist = (t: number) => fmt(Math.abs(v - t));
    preview = `= <b>${fmt(v)}</b> <span class="muted">· distância de 20: ${dist(20)} · de 1: ${dist(1)}</span>`;
    if (!p.complete) preview += ` <span class="warn">· use todas as cartas</span>`;
  } else preview = `<span class="muted">Toque nas cartas abaixo para montar a equação.</span>`;

  return `<div class="builder ${target ? `target-${target}` : ''}">
    <div class="b-title">${title}</div>
    <div class="eq">${slots || '<span class="muted">vazia</span>'}</div>
    <div class="preview">${preview}</div>
    <div class="palette">${palette}</div>
    <div class="row">
      <button class="ghost" data-act="back" ${tokens.length ? '' : 'disabled'}>⌫ Voltar</button>
      <button class="ghost" data-act="clear" ${tokens.length ? '' : 'disabled'}>Limpar</button>
    </div>
  </div>`;
}

function wireBuilder(root: HTMLElement, get: () => Token[], set: (t: Token[]) => void) {
  root.querySelectorAll<HTMLButtonElement>('.builder .tok').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.k;
      const t = get();
      if (k === 'num') set([...t, { t: 'num', id: Number(b.dataset.id) }]);
      else if (k === 'sqrt') set([...t, { t: 'sqrt', id: Number(b.dataset.id) }]);
      else set([...t, { t: 'op', op: b.dataset.op as Op }]);
      render();
    }),
  );
  root.querySelector<HTMLButtonElement>('[data-act="back"]')?.addEventListener('click', () => {
    set(get().slice(0, -1));
    render();
  });
  root.querySelector<HTMLButtonElement>('[data-act="clear"]')?.addEventListener('click', () => {
    set([]);
    render();
  });
}

// ---------- renderização ----------

const PHASE_LABEL: Record<RoomState['phase'], string> = {
  lobby: '',
  discard: 'Descarte',
  bet1: 'Apostas (1ª rodada)',
  build: 'Monte sua equação',
  bet2: 'Apostas (2ª rodada)',
  declare: 'Alta, baixa ou as duas?',
  second: 'Equação da baixa',
  showdown: 'Resultado',
  final: 'Fim de jogo',
};

function playerSeat(p: PlayerView, s: RoomState, mine: boolean) {
  const status: string[] = [];
  if (!p.inHand) status.push('<span class="tag out">fora</span>');
  else if (p.folded) status.push('<span class="tag out">desistiu</span>');
  if (s.turn === p.id) status.push('<span class="tag now">vez</span>');
  if (p.pendingDiscard) status.push('<span class="tag">descartando</span>');
  if (s.phase === 'build' && p.ready && !p.folded) status.push('<span class="tag ok">pronto</span>');
  if ((s.phase === 'declare' || s.phase === 'second') && p.declared) status.push('<span class="tag ok">mão fechada</span>');
  if (p.isFirst) status.push('<span class="tag first">1º</span>');
  const ops = [...p.ops.map((o) => opHtml(o, 'tiny')), ...(p.discardedOp ? [opHtml(p.discardedOp, 'tiny discarded')] : [])];
  const fist =
    (s.phase === 'declare' || s.phase === 'second') && p.declared && !mine
      ? `<div class="fist">${handSvg({ low: false, high: false, closed: true, size: 34 })}</div>`
      : '';
  return `<div class="seat ${mine ? 'mine' : ''} ${p.folded || !p.inHand ? 'dim' : ''} ${s.turn === p.id ? 'turn' : ''}">
    <div class="seat-head">
      <span class="nm">${escapeHtml(p.name)}${mine ? ' <small>(você)</small>' : ''}</span>
      <span class="chips-count">${p.chips} <small>fichas</small></span>
    </div>
    <div class="seat-tags">${status.join('')}${p.inHand && p.streetBet ? `<span class="tag bet">apostou ${p.streetBet}</span>` : ''}</div>
    ${
      p.inHand
        ? `<div class="seat-cards">${cardHtml(p.hidden, mine ? 'hidden-mine' : '')}${p.open.map((c) => cardHtml(c)).join('')}${fist}</div>
           <div class="seat-ops">${ops.join('')}</div>`
        : ''
    }
  </div>`;
}

function render() {
  if (!state) return;
  const s = state;
  const me = s.players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;
  const host = s.players.find((p) => p.isHost);
  const seated = s.players.filter((p) => p.role === 'player');
  const inHand = !!me?.inHand && !me.folded;

  if (localHand !== s.hand) {
    localHand = s.hand;
    draft = [];
    secondEq = [];
    declSide = { low: false, high: false };
    mySide = null;
    closing = false;
  }

  els.roundLabel.textContent = s.hand && s.phase !== 'lobby' && s.phase !== 'final' ? `Mão ${s.hand}` : '';
  els.phaseLabel.textContent = PHASE_LABEL[s.phase];
  els.pot.innerHTML =
    s.phase !== 'lobby' && s.phase !== 'final' && s.phase !== 'showdown'
      ? `<span>Pote <b>${s.pot}</b></span>${s.phase.startsWith('bet') ? `<span>Aposta da rodada <b>${s.currentBet}</b></span><span class="muted">limite ${s.maxBet}</span>` : ''}`
      : '';

  // mesa
  const inGame = s.phase !== 'lobby' && s.phase !== 'final';
  if (inGame) {
    els.others.innerHTML = seated
      .filter((p) => p.id !== myId)
      .map((p) => playerSeat(p, s, false))
      .join('');
    els.me.innerHTML = me && me.role === 'player' ? playerSeat(me, s, true) : '';
  } else {
    els.others.innerHTML = '';
    els.me.innerHTML = '';
  }

  const hand = me ? handInfo(myCards(me), me.ops) : null;
  const cards = me ? myCards(me) : [];
  let html = '';
  const after: (() => void)[] = [];

  // ----- lobby -----
  if (s.phase === 'lobby') {
    html = `<div class="panel-card">
      <h3>Sala ${roomCode}</h3>
      <p class="muted">De 2 a 6 jogadores. A ordem de chegada é a ordem na mesa.</p>
      <ol class="seat-list">${seated.map((p) => `<li>${escapeHtml(p.name)}${p.id === myId ? ' <small>você</small>' : ''}</li>`).join('')}</ol>
      ${
        isHost
          ? `<label class="field"><span>Fichas por jogador (1 a 99)</span>
               <input id="cfg-chips" type="number" min="1" max="99" value="${s.config.chips}" /></label>
             <button class="primary big" id="btn-start" ${seated.length < 2 ? 'disabled' : ''}>Começar</button>`
          : `<p>Cada jogador começa com <b>${s.config.chips}</b> fichas.</p>
             <p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} começar…</p>`
      }
      ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
    </div>`;
    if (isHost)
      after.push(() => {
        $<HTMLInputElement>('cfg-chips').addEventListener('change', (e) => {
          const v = Math.max(1, Math.min(99, Math.trunc(Number((e.target as HTMLInputElement).value)) || 1));
          send({ t: 'config', chips: v });
        });
        $('btn-start').addEventListener('click', () => send({ t: 'start' }));
      });
  }

  // ----- descarte -----
  else if (s.phase === 'discard') {
    if (me?.pendingDiscard) {
      html = `<div class="action"><p>Você recebeu <b>×</b>. Descarte uma das suas cartas de operação:</p>
        <div class="row"><button class="big-op" data-op="+">${opHtml('+')}</button><button class="big-op" data-op="-">${opHtml('-')}</button></div></div>`;
      after.push(() =>
        els.stage.querySelectorAll<HTMLButtonElement>('.big-op').forEach((b) =>
          b.addEventListener('click', () => send({ t: 'discard', op: b.dataset.op as '+' | '-' })),
        ),
      );
    } else html = `<div class="action"><p class="muted">Aguardando quem recebeu × escolher qual operação descartar…</p></div>`;
  }

  // ----- apostas -----
  else if (s.phase === 'bet1' || s.phase === 'bet2') {
    const myTurn = s.turn === myId;
    const draftInfo =
      s.phase === 'bet2' && inHand && hand
        ? (() => {
            const p = parse(draft, hand);
            return `<p class="muted small">Sua equação: ${draft.length ? escapeHtml(eqText(draft, cards)) : '—'}${
              p.ok && p.value !== undefined ? ` = <b>${fmt(p.value)}</b>` : ''
            }</p>`;
          })()
        : '';
    if (myTurn && me) {
      const toCall = s.currentBet - me.streetBet;
      const canRaise = s.maxBet > s.currentBet;
      if (raiseTo <= s.currentBet || raiseTo > s.maxBet) raiseTo = Math.min(s.maxBet, s.currentBet + 1);
      html = `<div class="action">
        <p><b>Sua vez.</b> ${toCall > 0 ? `Para continuar, pague <b>${toCall}</b>.` : 'Ninguém apostou nesta rodada ainda.'}</p>
        <div class="row">
          ${toCall === 0 ? `<button id="b-check">Passar a vez</button>` : `<button class="primary" id="b-call">Igualar (${toCall})</button>`}
          ${
            canRaise
              ? `<span class="raise"><button id="b-minus">−</button><b id="raise-val">${raiseTo}</b><button id="b-plus">+</button>
                 <button id="b-raise">${s.currentBet ? 'Aumentar' : 'Apostar'} para ${raiseTo}</button></span>`
              : `<span class="muted small">Aposta no limite (${s.maxBet})</span>`
          }
          <button class="danger" id="b-fold">Desistir</button>
        </div>
        ${draftInfo}
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
      after.push(() => {
        $('b-check')?.addEventListener('click', () => send({ t: 'check' }));
        $('b-call')?.addEventListener('click', () => send({ t: 'call' }));
        $('b-fold').addEventListener('click', () => send({ t: 'fold' }));
        $('b-minus')?.addEventListener('click', () => {
          raiseTo = Math.max(s.currentBet + 1, raiseTo - 1);
          render();
        });
        $('b-plus')?.addEventListener('click', () => {
          raiseTo = Math.min(s.maxBet, raiseTo + 1);
          render();
        });
        $('b-raise')?.addEventListener('click', () => send({ t: 'raise', to: raiseTo }));
      });
    } else {
      const who = s.players.find((p) => p.id === s.turn);
      html = `<div class="action"><p class="muted">Vez de <b>${escapeHtml(who?.name ?? '')}</b> apostar.</p>${draftInfo}</div>`;
    }
  }

  // ----- montar equação -----
  else if (s.phase === 'build') {
    if (inHand && hand) {
      html = `<div class="action">
        ${builderHtml(hand, cards, draft, 'Sua equação (ninguém mais vê)', null)}
        <button class="primary" id="b-ready" ${me!.ready ? 'disabled' : ''}>${me!.ready ? 'Pronto! Aguardando os outros' : 'Pronto'}</button>
        <p class="muted small">Você ainda poderá ajustar a equação na hora de fechar a mão.</p>
      </div>`;
      after.push(() => {
        wireBuilder(els.stage, () => draft, (t) => (draft = t));
        $('b-ready').addEventListener('click', () => send({ t: 'ready' }));
      });
    } else html = `<div class="action"><p class="muted">Os jogadores estão montando suas equações…</p></div>`;
  }

  // ----- declarar (mão fechada) -----
  else if (s.phase === 'declare') {
    if (inHand && hand && !me!.declared) {
      const side: Side | null =
        declSide.low && declSide.high ? 'both' : declSide.low ? 'low' : declSide.high ? 'high' : null;
      const firstTarget = side === 'low' ? 'low' : side ? 'high' : null;
      const p = parse(draft, hand);
      const ok = !!side && p.ok && p.complete;
      html = `<div class="action declare">
        <div class="hand-zone">
          <div class="hand-wrap ${closing ? 'closing' : ''}">${handSvg({ low: declSide.low, high: declSide.high, closed: false })}</div>
          <div class="chip-pick">
            <button class="chip-btn ${declSide.low ? 'on' : ''}" data-c="low"><span class="chip-face white">1</span>Baixa<br><small>chegar perto de 1</small></button>
            <button class="chip-btn ${declSide.high ? 'on' : ''}" data-c="high"><span class="chip-face black">20</span>Alta<br><small>chegar perto de 20</small></button>
            <p class="muted small">Pegue uma ficha, ou as duas para apostar alto e baixo.</p>
          </div>
        </div>
        ${builderHtml(
          hand,
          cards,
          draft,
          side === 'both'
            ? 'Equação da ALTA (a da baixa vem depois, em 20 segundos)'
            : side === 'low'
              ? 'Equação da BAIXA (alvo 1)'
              : side === 'high'
                ? 'Equação da ALTA (alvo 20)'
                : 'Sua equação',
          firstTarget,
        )}
        <button class="primary big" id="b-declare" ${ok ? '' : 'disabled'}>Fechar a mão e confirmar</button>
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
      after.push(() => {
        els.stage.querySelectorAll<HTMLButtonElement>('.chip-btn').forEach((b) =>
          b.addEventListener('click', () => {
            const c = b.dataset.c as 'low' | 'high';
            declSide = { ...declSide, [c]: !declSide[c] };
            render();
          }),
        );
        wireBuilder(els.stage, () => draft, (t) => (draft = t));
        $('b-declare').addEventListener('click', () => {
          if (!side) return;
          mySide = side;
          closing = true;
          const svg = els.stage.querySelector('.hand-svg');
          svg?.classList.add('closed');
          setTimeout(() => send({ t: 'declare', side, equation: draft }), 550);
        });
      });
    } else if (inHand && me!.declared) {
      html = `<div class="action">
        <div class="hand-wrap">${handSvg({ low: false, high: false, closed: true })}</div>
        <p>Mão fechada${mySide ? `: você apostou na <b>${SIDE_LABEL[mySide]}</b>` : ''}. Aguardando os outros…</p>
      </div>`;
    } else html = `<div class="action"><p class="muted">Os jogadores estão escolhendo suas fichas em segredo…</p></div>`;
  }

  // ----- segunda equação (aposta dupla) -----
  else if (s.phase === 'second') {
    if (inHand && hand && mySide === 'both' && !me!.secondDone) {
      const p = parse(secondEq, hand);
      html = `<div class="action">
        <p>Sua equação da alta foi guardada. Agora reorganize as cartas para a <b>baixa (alvo 1)</b>.</p>
        ${builderHtml(hand, cards, secondEq, 'Equação da BAIXA (alvo 1)', 'low')}
        <button class="primary big" id="b-second" ${p.ok && p.complete ? '' : 'disabled'}>Confirmar equação da baixa</button>
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
      after.push(() => {
        wireBuilder(els.stage, () => secondEq, (t) => (secondEq = t));
        $('b-second').addEventListener('click', () => send({ t: 'second', equation: secondEq }));
      });
    } else
      html = `<div class="action"><p class="muted">Quem apostou alto e baixo está reorganizando a equação da baixa…</p></div>`;
  }

  // ----- confronto -----
  else if (s.phase === 'showdown' && s.showdown) {
    const sd = s.showdown;
    const nameOf = (id: string | null) => escapeHtml(s.players.find((p) => p.id === id)?.name ?? '?');
    let body = '';
    if (sd.byFold) {
      const w = Object.keys(sd.pay)[0];
      body = w
        ? `<p class="big-line">${nameOf(w)} leva o pote de <b>${sd.pot}</b>: todos os outros desistiram.</p>`
        : `<p>Ninguém declarou. O pote foi descartado.</p>`;
    } else {
      body = `<div class="results">${sd.entries
        .map((e) => {
          const pl = s.players.find((p) => p.id === e.playerId);
          const pc = pl ? [...(pl.hidden ? [pl.hidden] : []), ...pl.open] : [];
          if (e.folded) return `<div class="res dim"><div class="res-head"><b>${escapeHtml(e.name)}</b> <span class="muted">desistiu</span></div></div>`;
          const lines: string[] = [];
          if (e.eqHigh && e.high !== null)
            lines.push(`<div class="res-eq high ${sd.highWinner === e.playerId ? 'win' : ''}"><span class="lbl">alta</span>${escapeHtml(eqText(e.eqHigh, pc))} = <b>${fmt(e.high)}</b>${sd.highWinner === e.playerId ? ' <span class="crown">venceu</span>' : ''}</div>`);
          if (e.eqLow && e.low !== null)
            lines.push(`<div class="res-eq low ${sd.lowWinner === e.playerId ? 'win' : ''}"><span class="lbl">baixa</span>${escapeHtml(eqText(e.eqLow, pc))} = <b>${fmt(e.low)}</b>${sd.lowWinner === e.playerId ? ' <span class="crown">venceu</span>' : ''}</div>`);
          const gain = sd.pay[e.playerId];
          return `<div class="res ${gain ? 'gain' : ''}">
            <div class="res-hand">${handSvg({ low: e.side !== 'high', high: e.side !== 'low', closed: false, size: 70 })}</div>
            <div class="res-body">
              <div class="res-head"><b>${escapeHtml(e.name)}</b> <span class="muted">apostou ${e.side ? SIDE_LABEL[e.side] : ''}</span>
                ${gain ? `<span class="gain-tag">+${gain}</span>` : ''}
                ${sd.doubleLosers.includes(e.playerId) ? '<span class="lose-tag">não venceu as duas</span>' : ''}</div>
              <div class="res-cards">${pc.map((c) => cardHtml(c, 'mini')).join('')}</div>
              ${lines.join('')}
            </div>
          </div>`;
        })
        .join('')}</div>
        <p class="muted small">Pote: ${sd.pot}${sd.discarded ? ` · ${sd.discarded} ficha descartada (pote ímpar)` : ''}.
        ${sd.highWinner && sd.lowWinner ? 'Cada lado leva metade.' : 'Só um lado teve vencedor: ele leva o pote inteiro.'}</p>`;
    }
    html = `<div class="action wide">${body}
      ${
        isHost
          ? `<div class="row"><button class="primary" id="b-next">Próxima mão</button><button id="b-end">Encerrar partida</button></div>`
          : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} continuar…</p>`
      }</div>`;
    if (isHost)
      after.push(() => {
        $('b-next').addEventListener('click', () => send({ t: 'next' }));
        $('b-end').addEventListener('click', () => send({ t: 'end' }));
      });
  }

  // ----- final -----
  else if (s.phase === 'final') {
    const ranking = [...seated].sort((a, b) => b.chips - a.chips);
    const top = ranking.filter((p) => p.chips === ranking[0]?.chips);
    html = `<div class="panel-card">
      <h3>${top.length > 1 ? 'Empate!' : `${escapeHtml(top[0]?.name ?? '')} venceu!`}</h3>
      <ol class="final-list">${ranking.map((p) => `<li><span>${escapeHtml(p.name)}</span><b>${p.chips}</b></li>`).join('')}</ol>
      ${
        isHost
          ? `<button class="primary big" id="b-again">Nova partida</button>`
          : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')}…</p>`
      }
    </div>`;
    if (isHost) after.push(() => $('b-again').addEventListener('click', () => send({ t: 'again' })));
  }

  els.stage.innerHTML = html;
  for (const fn of after) fn();

  // painel lateral
  els.scoreboard.innerHTML = s.players
    .map(
      (p) => `<li class="${p.id === myId ? 'me' : ''} ${p.role}">
        <span>${escapeHtml(p.name)}${p.isHost ? ' <em>anfitrião</em>' : ''}${p.role === 'spectator' ? ' <em>assistindo</em>' : ''}</span>
        <b>${p.role === 'player' && s.phase !== 'lobby' ? p.chips : ''}</b></li>`,
    )
    .join('');
  els.feed.innerHTML = [...s.feed]
    .reverse()
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');
}

setInterval(() => {
  if (!state) return;
  const left = Math.max(0, deadline - performance.now());
  const running = left > 0 && !['lobby', 'showdown', 'final'].includes(state.phase);
  const sec = Math.ceil(left / 1000);
  els.timer.textContent = running ? (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`) : '';
  els.timer.classList.toggle('urgent', running && left < 10_000);
}, 200);

