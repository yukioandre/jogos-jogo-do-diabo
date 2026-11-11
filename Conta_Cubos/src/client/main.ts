import { CubeScene, LAYER_COLORS } from './scene';
import { DIFFICULTY_LABEL, generateShape, type Difficulty } from '../shared/shapes';
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
  canvasHost: $('canvas-host'),
  overlay: $('overlay'),
  roundLabel: $('round-label'),
  timer: $('timer'),
  guessForm: $<HTMLFormElement>('guess-form'),
  guess: $<HTMLInputElement>('guess'),
  guessStatus: $('guess-status'),
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

// ---------- estado do cliente ----------

let scene: CubeScene | null = null;
let ws: WebSocket | null = null;
let myId: string | null = null;
let roomCode = '';
let state: RoomState | null = null;
let deadline = 0; // performance.now() em que a fase atual termina
let lockedUntil = 0;
let demoId = -1;

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------- tela inicial ----------

els.name.value = store.get('cc-name') ?? '';
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
  store.set('cc-name', name);
  connect(code.toUpperCase(), name);
}

els.create.addEventListener('click', () => enter(randomCode()));
els.join.addEventListener('click', () => enter(els.code.value.trim()));
els.code.addEventListener('keydown', (e) => e.key === 'Enter' && enter(els.code.value.trim()));
els.name.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (els.code.value.trim()) enter(els.code.value.trim());
  else enter(randomCode());
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
    showOverlay(`
      <div class="card">
        <h3>Conexão perdida</h3>
        <p class="muted">Seu placar nesta sala foi perdido.</p>
        <button class="primary" id="btn-reconnect">Entrar de novo</button>
      </div>`);
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
      openRoom();
      break;
    case 'error':
      if (!myId) els.homeError.textContent = msg.message;
      else els.guessStatus.textContent = msg.message;
      break;
    case 'wrong':
      lockedUntil = performance.now() + msg.lockMs;
      els.guess.select();
      break;
    case 'state':
      state = msg.state;
      deadline = performance.now() + msg.state.endsInMs;
      render();
      break;
  }
}

function openRoom() {
  els.home.classList.add('hidden');
  els.room.classList.remove('hidden');
  els.roomCode.textContent = roomCode;
  history.replaceState(null, '', `?sala=${roomCode}`);
  if (!scene) scene = new CubeScene(els.canvasHost);
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

els.guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = els.guess.value.trim();
  if (!v || performance.now() < lockedUntil) return;
  send({ t: 'guess', value: Number(v) });
});

// ---------- renderização ----------

function showOverlay(html: string) {
  els.overlay.innerHTML = html;
  els.overlay.classList.remove('hidden');
}
function hideOverlay() {
  els.overlay.classList.add('hidden');
  els.overlay.innerHTML = '';
}

function layersHtml(layers: number[]) {
  return layers
    .map(
      (n, i) =>
        `<span class="layer"><i style="background:${LAYER_COLORS[i % LAYER_COLORS.length]}"></i>${i + 1}ª: <b>${n}</b></span>`,
    )
    .join('');
}

function render() {
  if (!state || !scene) return;
  const s = state;
  const me = s.players.find((p) => p.id === myId);
  const isHost = !!me?.isHost;
  const host = s.players.find((p) => p.isHost);

  // figura
  if (s.shape) {
    scene.setShape(s.shape.id, s.shape.nx, s.shape.nz, s.shape.heights);
  } else if (scene.currentId === null || scene.currentId >= 0) {
    // figura de demonstração no lobby / final
    const demo = generateShape('medio');
    scene.setShape(demoId--, demo.nx, demo.nz, demo.heights);
  }

  // hud
  els.roundLabel.textContent =
    s.phase === 'round' || s.phase === 'reveal' ? `Rodada ${s.round} de ${s.totalRounds}` : '';

  // formulário de resposta
  const playing = s.phase === 'round';
  els.guessForm.classList.toggle('hidden', !playing);
  if (playing && s.shape && els.guessForm.dataset.shape !== String(s.shape.id)) {
    els.guessForm.dataset.shape = String(s.shape.id);
    els.guess.value = '';
    lockedUntil = 0;
    els.guess.focus();
  }

  // overlay
  if (s.phase === 'lobby') {
    const diffOpts = (Object.keys(DIFFICULTY_LABEL) as Difficulty[])
      .map((d) => `<option value="${d}" ${d === s.config.difficulty ? 'selected' : ''}>${DIFFICULTY_LABEL[d]}</option>`)
      .join('');
    const roundOpts = ROUND_OPTIONS.map(
      (r) => `<option value="${r}" ${r === s.config.rounds ? 'selected' : ''}>${r}</option>`,
    ).join('');
    showOverlay(`
      <div class="card">
        <h3>Sala ${roomCode}</h3>
        <p class="muted">Chame a turma: compartilhe o link ou o código.</p>
        ${
          isHost
            ? `<div class="config">
                 <label class="field"><span>Dificuldade</span><select id="cfg-diff">${diffOpts}</select></label>
                 <label class="field"><span>Rodadas</span><select id="cfg-rounds">${roundOpts}</select></label>
               </div>
               <button class="primary big" id="btn-start">Começar</button>`
            : `<p>Dificuldade <b>${DIFFICULTY_LABEL[s.config.difficulty]}</b> · ${s.config.rounds} rodada(s)</p>
               <p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')} começar…</p>`
        }
      </div>`);
    if (isHost) {
      const sendCfg = () =>
        send({
          t: 'config',
          difficulty: ($('cfg-diff') as HTMLSelectElement).value as Difficulty,
          rounds: Number(($('cfg-rounds') as HTMLSelectElement).value),
        });
      $('cfg-diff').addEventListener('change', sendCfg);
      $('cfg-rounds').addEventListener('change', sendCfg);
      $('btn-start').addEventListener('click', () => send({ t: 'start' }));
    }
  } else if (s.phase === 'reveal' && s.reveal) {
    const r = s.reveal;
    const who = r.winnerId
      ? r.winnerId === myId
        ? 'Você acertou primeiro!'
        : `${escapeHtml(r.winnerName ?? '')} acertou primeiro`
      : 'Ninguém acertou a tempo';
    showOverlay(`
      <div class="card reveal">
        <p class="muted">${who}</p>
        <div class="answer">${r.answer} <small>cubos</small></div>
        <p class="muted small">${escapeHtml(r.shapeName)} · cubos por camada:</p>
        <div class="layers">${layersHtml(r.layers)}</div>
      </div>`);
    els.overlay.classList.add('bottom');
  } else if (s.phase === 'final') {
    const ranking = [...s.players].sort((a, b) => b.score - a.score);
    const top = ranking[0];
    const tie = ranking.length > 1 && ranking[1].score === top.score;
    showOverlay(`
      <div class="card">
        <h3>${tie ? 'Empate!' : `${escapeHtml(top.name)} venceu!`}</h3>
        <ol class="final-list">${ranking
          .map((p) => `<li><span>${escapeHtml(p.name)}</span><b>${p.score}</b></li>`)
          .join('')}</ol>
        ${
          isHost
            ? `<button class="primary big" id="btn-again">Nova partida</button>`
            : `<p class="muted">Aguardando ${escapeHtml(host?.name ?? 'o anfitrião')}…</p>`
        }
      </div>`);
    if (isHost) $('btn-again').addEventListener('click', () => send({ t: 'again' }));
  } else {
    hideOverlay();
  }
  if (s.phase !== 'reveal') els.overlay.classList.remove('bottom');

  // placar
  els.scoreboard.innerHTML = [...s.players]
    .sort((a, b) => b.score - a.score)
    .map(
      (p) => `<li class="${p.id === myId ? 'me' : ''}">
        <span>${escapeHtml(p.name)}${p.isHost ? ' <em>anfitrião</em>' : ''}</span><b>${p.score}</b></li>`,
    )
    .join('');

  els.feed.innerHTML = [...s.feed]
    .reverse()
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');
}

// relógio e bloqueio após erro
setInterval(() => {
  if (!state) return;
  const left = Math.max(0, deadline - performance.now());
  els.timer.textContent = state.phase === 'round' ? `${Math.ceil(left / 1000)}s` : '';
  els.timer.classList.toggle('urgent', state.phase === 'round' && left < 10_000);

  if (state.phase === 'round') {
    const lock = lockedUntil - performance.now();
    const locked = lock > 0;
    els.guess.disabled = locked;
    els.guessStatus.textContent = locked
      ? `Errou! Aguarde ${Math.ceil(lock / 1000)}s para tentar de novo.`
      : '';
    if (!locked && els.guess.dataset.wasLocked === '1') els.guess.focus();
    els.guess.dataset.wasLocked = locked ? '1' : '0';
  }
}, 200);
