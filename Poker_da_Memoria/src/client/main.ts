import { SUIT_SYMBOL, isRed, letterOf, rankLabel, type Card } from '../shared/cards';
import { ROUND_OPTIONS, type ClientMsg, type RoomState, type ServerMsg } from '../shared/protocol';

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

function cardFace(c: Card, extra = '') {
  return `<div class="card face ${isRed(c.s) ? 'red' : 'black'} ${extra}">
    <span class="corner">${rankLabel(c.r)}<br>${SUIT_SYMBOL[c.s]}</span>
    <span class="pip">${SUIT_SYMBOL[c.s]}</span>
    <span class="corner br">${rankLabel(c.r)}<br>${SUIT_SYMBOL[c.s]}</span>
  </div>`;
}

// ---------- estado do cliente ----------

let ws: WebSocket | null = null;
let myId: string | null = null;
let roomCode = '';
let state: RoomState | null = null;
let deadline = 0;
let selection: number[] = [];
let selectionRound = -1;
let lastError = '';

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------- tela inicial ----------

els.name.value = store.get('pm-name') ?? '';
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
  store.set('pm-name', name);
  connect(code.toUpperCase(), name);
}

els.create.addEventListener('click', () => enter(randomCode()));
els.join.addEventListener('click', () => enter(els.code.value.trim()));
els.code.addEventListener('keydown', (e) => e.key === 'Enter' && enter(els.code.value.trim()));
els.name.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  enter(els.code.value.trim() || randomCode());
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
        <p class="muted">Seu placar nesta sala foi perdido.</p>
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

// ---------- renderização ----------

const PHASE_LABEL: Record<RoomState['phase'], string> = {
  lobby: '',
  memorize: 'Memorize!',
  choose: 'Escolha 2 cartas',
  reveal: 'Resultado',
  final: '',
};

function render() {
  if (!state) return;
  const s = state;
  const me = s.players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;
  const host = s.players.find((p) => p.isHost);
  const seated = s.players.filter((p) => p.role === 'player');
  const iPlay = me?.role === 'player';

  if (selectionRound !== s.round || s.phase !== 'choose') {
    if (s.phase !== 'choose') selection = [];
    if (selectionRound !== s.round) selection = [];
    selectionRound = s.round;
  }

  els.roundLabel.textContent = s.round && s.phase !== 'lobby' ? `Rodada ${s.round}/${s.totalRounds}` : '';
  els.phaseLabel.textContent = PHASE_LABEL[s.phase];

  // ----- lobby -----
  if (s.phase === 'lobby') {
    const roundOpts = ROUND_OPTIONS.map(
      (r) => `<option value="${r}" ${r === s.config.rounds ? 'selected' : ''}>${r}</option>`,
    ).join('');
    const seat = (i: number) =>
      seated[i]
        ? `<div class="seat filled"><b>${escapeHtml(seated[i].name)}</b>${seated[i].id === myId ? '<small>você</small>' : ''}</div>`
        : `<div class="seat empty">Aguardando jogador…</div>`;
    els.stage.innerHTML = `
      <div class="panel-card">
        <h3>Sala ${roomCode}</h3>
        <p class="muted">Duelo para 2 jogadores. Quem entrar depois assiste.</p>
        <div class="seats">${seat(0)}<span class="vs">x</span>${seat(1)}</div>
        ${
          isHost
            ? `<label class="field"><span>Rodadas</span><select id="cfg-rounds">${roundOpts}</select></label>
               <button class="primary big" id="btn-start" ${seated.length < 2 ? 'disabled' : ''}>Começar</button>`
            : `<p>${s.config.rounds} rodada(s)</p>
               <p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} começar…</p>`
        }
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
    if (isHost) {
      $('cfg-rounds').addEventListener('change', (e) =>
        send({ t: 'config', rounds: Number((e.target as HTMLSelectElement).value) }),
      );
      $('btn-start').addEventListener('click', () => send({ t: 'start' }));
    }
  }

  // ----- memorização -----
  else if (s.phase === 'memorize' && s.board) {
    els.stage.innerHTML = `
      <div class="board">${s.board.map((c) => (c ? cardFace(c) : '')).join('')}</div>
      <p class="hint">Grave as cartas e as posições. Em seguida elas serão cobertas e ganharão letras de A a P.</p>`;
  }

  // ----- escolha -----
  else if (s.phase === 'choose' && s.board && s.open) {
    const done = !!me?.chosen;
    const canPick = iPlay && !done;
    const waiting = seated
      .map((p) => `<span class="${p.chosen ? 'ok' : ''}">${escapeHtml(p.name)}: ${p.chosen ? 'escolheu' : 'pensando…'}</span>`)
      .join('');
    els.stage.innerHTML = `
      <div class="open-row">
        <div class="label">Cartas abertas</div>
        <div class="open">${s.open.map((c) => cardFace(c)).join('')}</div>
      </div>
      <div class="board ${canPick ? 'pickable' : ''}">
        ${s.board
          .map(
            (_, i) =>
              `<button class="card back ${selection.includes(i) ? 'selected' : ''}" data-i="${i}" ${canPick ? '' : 'disabled'}>
                 <span>${letterOf(i)}</span></button>`,
          )
          .join('')}
      </div>
      <div class="pick-bar">
        ${
          !iPlay
            ? `<p class="muted">Você está assistindo.</p>`
            : done
              ? `<p>Escolha enviada. Aguardando o adversário…</p>`
              : `<p>Sua escolha: <b>${selection.map(letterOf).join(' + ') || '—'}</b></p>
                 <button class="primary" id="btn-confirm" ${selection.length === 2 ? '' : 'disabled'}>Confirmar</button>`
        }
        <div class="status">${waiting}</div>
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
    if (canPick) {
      els.stage.querySelectorAll<HTMLButtonElement>('.card.back').forEach((b) =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.i);
          if (selection.includes(i)) selection = selection.filter((x) => x !== i);
          else selection = [...selection, i].slice(-2);
          render();
        }),
      );
      $('btn-confirm')?.addEventListener('click', () => {
        if (selection.length === 2) send({ t: 'pick', picks: [selection[0], selection[1]] });
      });
    }
  }

  // ----- revelação -----
  else if (s.phase === 'reveal' && s.board && s.open && s.result) {
    const r = s.result;
    const markers = new Map<number, string[]>();
    r.results.forEach((res, k) => res.picks?.forEach((i) => markers.set(i, [...(markers.get(i) ?? []), `p${k}`])));
    const winner = r.results.find((x) => x.playerId === r.winnerId);
    const headline = r.winnerId
      ? r.winnerId === myId
        ? 'Você venceu a rodada!'
        : `${escapeHtml(winner?.name ?? '')} venceu a rodada`
      : 'Empate';
    const handsHtml = r.results
      .map((res, k) => {
        const cards = res.picks ? [s.board![res.picks[0]]!, s.board![res.picks[1]]!, ...s.open!] : null;
        return `<div class="hand p${k} ${res.playerId === r.winnerId ? 'win' : ''}">
          <div class="who"><i></i>${escapeHtml(res.name)}
            <span>${res.picks ? `${letterOf(res.picks[0])} + ${letterOf(res.picks[1])}` : ''}</span></div>
          <div class="hand-name">${res.hand ? res.hand.name : 'Não escolheu a tempo'}</div>
          ${cards ? `<div class="mini">${cards.map((c, j) => cardFace(c, j < 2 ? 'mine' : '')).join('')}</div>` : ''}
        </div>`;
      })
      .join('');
    const last = s.round >= s.totalRounds;
    els.stage.innerHTML = `
      <div class="reveal-head"><h3>${headline}</h3></div>
      <div class="hands">${handsHtml}</div>
      <div class="board revealed">
        ${s.board
          .map((c, i) => {
            const m = markers.get(i) ?? [];
            return `<div class="slot ${m.length ? 'picked' : ''}">
              ${cardFace(c!)}
              <span class="tag">${letterOf(i)}</span>
              ${m.map((cls) => `<span class="dot ${cls}"></span>`).join('')}
            </div>`;
          })
          .join('')}
      </div>
      <div class="pick-bar">
        ${
          isHost
            ? `<button class="primary" id="btn-next">${last ? 'Ver resultado final' : 'Próxima rodada'}</button>`
            : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} continuar…</p>`
        }
      </div>`;
    if (isHost) $('btn-next').addEventListener('click', () => send({ t: 'next' }));
  }

  // ----- final -----
  else if (s.phase === 'final') {
    const ranking = [...seated].sort((a, b) => b.score - a.score);
    const tie = ranking.length === 2 && ranking[0].score === ranking[1].score;
    els.stage.innerHTML = `
      <div class="panel-card">
        <h3>${tie ? 'Empate!' : `${escapeHtml(ranking[0]?.name ?? '')} venceu!`}</h3>
        <ol class="final-list">${ranking
          .map((p) => `<li><span>${escapeHtml(p.name)}</span><b>${p.score}</b></li>`)
          .join('')}</ol>
        ${
          isHost
            ? `<button class="primary big" id="btn-again">Nova partida</button>`
            : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')}…</p>`
        }
      </div>`;
    if (isHost) $('btn-again').addEventListener('click', () => send({ t: 'again' }));
  }

  // placar
  els.scoreboard.innerHTML = s.players
    .map(
      (p) => `<li class="${p.id === myId ? 'me' : ''} ${p.role}">
        <span>${escapeHtml(p.name)}${p.isHost ? ' <em>anfitrião</em>' : ''}${p.role === 'spectator' ? ' <em>assistindo</em>' : ''}</span>
        <b>${p.role === 'player' ? p.score : ''}</b></li>`,
    )
    .join('');

  els.feed.innerHTML = [...s.feed]
    .reverse()
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');
}

setInterval(() => {
  if (!state) return;
  const running = state.phase === 'memorize' || state.phase === 'choose';
  const left = Math.max(0, deadline - performance.now());
  els.timer.textContent = running ? `${Math.ceil(left / 1000)}s` : '';
  els.timer.classList.toggle('urgent', running && left < 5_000);
}, 200);
