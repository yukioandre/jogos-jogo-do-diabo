import {
  CHIPS,
  CHIP_NAME,
  LIMIT,
  SUPPORTS,
  SUPPORT_NAME,
  WEIGHTS,
  total,
  type Chip,
  type Support,
} from '../shared/rules';
import type { ClientMsg, RoomState, ServerMsg } from '../shared/protocol';

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
  supports: $('supports'),
  event: $('event'),
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

const chipDot = (c: Chip, extra = '') => `<span class="chip chip-${c} ${extra}" title="Ficha ${CHIP_NAME[c]}"></span>`;
const initials = (name: string) => escapeHtml(name.trim().slice(0, 2).toUpperCase());

// ---------- estado do cliente ----------

let ws: WebSocket | null = null;
let myId: string | null = null;
let roomCode = '';
let state: RoomState | null = null;
let deadline = 0;
let lastError = '';
let pickWeight: number | null = null;
let pickChip: Chip | null = null;
let pickRound = -1;
let myChoice: { weight: number; chip: Chip } | null = null;

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------- tela inicial ----------

els.name.value = store.get('tp-name') ?? '';
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
  store.set('tp-name', name);
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
  choose: 'Escolha em segredo',
  place: 'Colocando cubos',
  roundEnd: 'Fim da rodada',
  final: 'Fim de jogo',
};

function renderSupports(s: RoomState) {
  const nameOf = (id: string) => s.players.find((p) => p.id === id)?.name ?? '?';
  const flash = s.lastEvent?.support;
  els.supports.innerHTML = SUPPORTS.map((sup) => {
    const stack = s.supports[sup];
    const sum = total(stack);
    const room = LIMIT - sum;
    const cubes = stack
      .map(
        (c) => `<div class="cube ${c.ownerId === myId ? 'mine' : ''}" style="--w:${c.w}" title="${escapeHtml(nameOf(c.ownerId))}">
          <b>${c.w}</b><small>${initials(nameOf(c.ownerId))}</small></div>`,
      )
      .join('');
    return `<div class="support sup-${sup} ${flash === sup ? (s.lastEvent!.bust ? 'bust' : 'flash') : ''}">
      <div class="sup-head">
        <span class="sup-name">${SUPPORT_NAME[sup]}</span>
        <span class="sup-total"><b>${sum}</b> / ${LIMIT}</span>
      </div>
      <div class="meter"><i style="width:${Math.min(100, (sum / LIMIT) * 100)}%"></i></div>
      <div class="stack">${cubes || '<span class="empty">vazio</span>'}</div>
      <div class="sup-foot">${room >= 6 ? 'cabe qualquer cubo' : `cabe até <b>${room}</b>`}</div>
    </div>`;
  }).join('');
}

function render() {
  if (!state) return;
  const s = state;
  const me = s.players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;
  const host = s.players.find((p) => p.isHost);
  const seated = s.players.filter((p) => p.role === 'player');
  const iPlay = me?.role === 'player';

  if (pickRound !== s.round) {
    pickRound = s.round;
    pickWeight = null;
    pickChip = null;
    myChoice = null;
  }

  els.roundLabel.textContent = s.round && s.phase !== 'lobby' ? `Rodada ${s.round}/${s.totalRounds}` : '';
  els.phaseLabel.textContent = PHASE_LABEL[s.phase];
  renderSupports(s);

  const ev = s.lastEvent;
  els.event.className = ev ? (ev.bust ? 'bust' : 'info') : '';
  els.event.textContent = ev && (s.phase === 'place' || s.phase === 'roundEnd') ? ev.text : '';

  // ----- lobby -----
  if (s.phase === 'lobby') {
    els.stage.innerHTML = `
      <div class="panel-card">
        <h3>Sala ${roomCode}</h3>
        <p class="muted">De 2 a 8 jogadores. A ordem de chegada é a ordem na mesa (sentido horário).</p>
        <ol class="seat-list">${seated.map((p) => `<li>${escapeHtml(p.name)}${p.id === myId ? ' <small>você</small>' : ''}</li>`).join('')}</ol>
        ${
          isHost
            ? `<button class="primary big" id="btn-start" ${seated.length < 2 ? 'disabled' : ''}>Começar</button>`
            : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} começar…</p>`
        }
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
    if (isHost) $('btn-start').addEventListener('click', () => send({ t: 'start' }));
  }

  // ----- escolha secreta -----
  else if (s.phase === 'choose') {
    const waiting = seated.filter((p) => !p.chosen).map((p) => escapeHtml(p.name));
    if (!iPlay) {
      els.stage.innerHTML = `<div class="action"><p class="muted">Você está assistindo. Aguardando: ${waiting.join(', ')}</p></div>`;
    } else if (me!.chosen) {
      els.stage.innerHTML = `<div class="action">
        <p>Sua escolha: ${myChoice ? `cubo <b>${myChoice.weight}</b> com ficha ${chipDot(myChoice.chip)} <b>${CHIP_NAME[myChoice.chip]}</b>` : 'enviada'}.</p>
        <p class="muted">Aguardando: ${waiting.join(', ') || '—'}</p></div>`;
    } else {
      const cubeBtns = WEIGHTS.map((w) => {
        const has = me!.cubesLeft.includes(w);
        return `<button class="pick-cube ${pickWeight === w ? 'on' : ''}" data-w="${w}" ${has ? '' : 'disabled'}>${w}</button>`;
      }).join('');
      const chipBtns = CHIPS.map((c) => {
        const n = me!.chipsLeft[c];
        return `<button class="pick-chip ${pickChip === c ? 'on' : ''}" data-c="${c}" ${n > 0 ? '' : 'disabled'}>
          ${chipDot(c)}<span>${CHIP_NAME[c]}</span><small>×${n}</small></button>`;
      }).join('');
      els.stage.innerHTML = `<div class="action">
        <div class="pick-group"><div class="label">Seu cubo (peso)</div><div class="row">${cubeBtns}</div></div>
        <div class="pick-group"><div class="label">Sua ficha (suporte)</div><div class="row">${chipBtns}</div></div>
        <button class="primary" id="btn-choose" ${pickWeight !== null && pickChip ? '' : 'disabled'}>
          Confirmar${pickWeight !== null && pickChip ? `: cubo ${pickWeight}, ficha ${CHIP_NAME[pickChip]}` : ''}</button>
        <p class="muted small">Ninguém vê sua escolha até todos confirmarem. Aguardando: ${waiting.join(', ')}</p>
        ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
      </div>`;
      els.stage.querySelectorAll<HTMLButtonElement>('.pick-cube').forEach((b) =>
        b.addEventListener('click', () => {
          pickWeight = Number(b.dataset.w);
          render();
        }),
      );
      els.stage.querySelectorAll<HTMLButtonElement>('.pick-chip').forEach((b) =>
        b.addEventListener('click', () => {
          pickChip = b.dataset.c as Chip;
          render();
        }),
      );
      $('btn-choose').addEventListener('click', () => {
        if (pickWeight === null || !pickChip) return;
        myChoice = { weight: pickWeight, chip: pickChip };
        send({ t: 'choose', weight: pickWeight, chip: pickChip });
      });
    }
  }

  // ----- colocação / fim de rodada -----
  else if ((s.phase === 'place' || s.phase === 'roundEnd') && s.order) {
    const turn = s.turn;
    const orderHtml = s.order
      .map((e) => {
        const active = turn?.playerId === e.playerId;
        const status = e.placed
          ? e.removed
            ? `<span class="st bust">−${e.removed}</span>`
            : `<span class="st ok">${e.support ? SUPPORT_NAME[e.support] : ''}</span>`
          : e.passed
            ? `<span class="st pass">passou</span>`
            : active
              ? `<span class="st now">jogando</span>`
              : '';
        return `<li class="${active ? 'active' : ''} ${e.playerId === myId ? 'me' : ''}">
          ${chipDot(e.chip)}<b class="w">${e.weight}</b><span class="nm">${escapeHtml(e.name)}</span>${status}</li>`;
      })
      .join('');

    let action = '';
    if (s.phase === 'roundEnd') {
      const pens = s.order
        .filter((e) => s.roundPenalties[e.playerId])
        .map((e) => `${escapeHtml(e.name)} −${s.roundPenalties[e.playerId]}`);
      action = `<p><b>Fim da rodada ${s.round}.</b> ${pens.length ? `Penalidades: ${pens.join(', ')}` : 'Ninguém foi penalizado.'}</p>
        <p class="muted small">${s.round < s.totalRounds ? 'A próxima rodada começa em instantes.' : 'Calculando o resultado final…'}</p>`;
    } else if (turn) {
      const e = s.order.find((x) => x.playerId === turn.playerId)!;
      if (turn.playerId === myId) {
        const passBtn = turn.forced ? '' : `<button id="btn-pass">Passar a vez</button>`;
        const warn = (sup: Support) => {
          const after = total(s.supports[sup]) + e.weight;
          return after > LIMIT
            ? `<small class="danger">estoura: −${s.supports[sup].length}</small>`
            : `<small>fica ${after}</small>`;
        };
        action =
          e.chip === 'W'
            ? `<p><b>Sua vez.</b> Ficha arco-íris: escolha onde colocar seu cubo <b>${e.weight}</b>${turn.forced ? '' : ', ou passe'}.</p>
               <div class="row">${SUPPORTS.map(
                 (sup) => `<button class="place-btn sup-${sup}" data-s="${sup}">${SUPPORT_NAME[sup]} ${warn(sup)}</button>`,
               ).join('')}${passBtn}</div>`
            : `<p><b>Sua vez.</b> Cubo <b>${e.weight}</b> no suporte <b>${SUPPORT_NAME[e.chip as Support]}</b>.</p>
               <div class="row"><button class="primary place-btn" data-s="${e.chip}">Colocar ${warn(e.chip as Support)}</button>${passBtn}</div>`;
        if (turn.forced) action += `<p class="muted small">Você passou antes: agora precisa colocar.</p>`;
      } else {
        action = `<p class="muted">${
          turn.forced && e.chip !== 'W'
            ? `Colocando o cubo de ${escapeHtml(e.name)}, que passou a vez…`
            : `Vez de <b>${escapeHtml(e.name)}</b>${turn.forced ? ' (passou antes, agora coloca)' : ''}.`
        }</p>`;
      }
    }
    els.stage.innerHTML = `<div class="action">
      <ol class="order">${orderHtml}</ol>
      ${action}
      ${lastError ? `<p class="error">${escapeHtml(lastError)}</p>` : ''}
    </div>`;
    els.stage.querySelectorAll<HTMLButtonElement>('.place-btn').forEach((b) =>
      b.addEventListener('click', () => send({ t: 'place', support: b.dataset.s as Support })),
    );
    $('btn-pass')?.addEventListener('click', () => send({ t: 'pass' }));
  }

  // ----- final -----
  else if (s.phase === 'final') {
    const ranking = [...seated].sort((a, b) => a.penalty - b.penalty);
    const best = ranking.filter((p) => p.penalty === ranking[0].penalty);
    els.stage.innerHTML = `
      <div class="panel-card">
        <h3>${best.length > 1 ? 'Empate!' : `${escapeHtml(best[0].name)} venceu!`}</h3>
        <p class="muted">Vence quem levou menos penalidade.</p>
        <ol class="final-list">${ranking
          .map((p) => `<li><span>${escapeHtml(p.name)}</span><b>${p.penalty ? `−${p.penalty}` : '0'}</b></li>`)
          .join('')}</ol>
        ${
          isHost
            ? `<button class="primary big" id="btn-again">Nova partida</button>`
            : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')}…</p>`
        }
      </div>`;
    if (isHost) $('btn-again').addEventListener('click', () => send({ t: 'again' }));
  }

  // ----- painel lateral -----
  const inGame = s.phase !== 'lobby';
  els.scoreboard.innerHTML = s.players
    .map((p) => {
      const chips = CHIPS.flatMap((c) => Array.from({ length: p.chipsLeft[c] }, () => chipDot(c, 'sm'))).join('');
      return `<li class="${p.id === myId ? 'me' : ''} ${p.role}">
        <div class="pl-top">
          <span>${p.isFirst ? '<i class="first" title="Primeiro jogador da rodada">1º</i>' : ''}${escapeHtml(p.name)}${
            p.isHost ? ' <em>anfitrião</em>' : ''
          }${p.role === 'spectator' ? ' <em>assistindo</em>' : ''}</span>
          <b>${p.role === 'player' && inGame ? (p.penalty ? `−${p.penalty}` : '0') : ''}</b>
        </div>
        ${
          p.role === 'player' && inGame
            ? `<div class="pl-left"><span class="cubes">${p.cubesLeft.map((w) => `<i>${w}</i>`).join('')}</span><span class="chips">${chips}</span></div>`
            : ''
        }
      </li>`;
    })
    .join('');

  els.feed.innerHTML = [...s.feed]
    .reverse()
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');
}

setInterval(() => {
  if (!state) return;
  const running = (state.phase === 'choose' || state.phase === 'place') && deadline > performance.now();
  const left = Math.max(0, deadline - performance.now());
  const sec = Math.ceil(left / 1000);
  els.timer.textContent = running ? (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`) : "";
  els.timer.classList.toggle('urgent', running && left < 10_000);
}, 200);
