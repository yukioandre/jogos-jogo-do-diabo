// Gerador de figuras. Toda figura é um "mapa de alturas": cada célula da grade
// tem uma pilha de cubos que vai até o chão. Isso garante a regra do jogo:
// nenhum cubo flutua e nenhum cubo fica escondido dentro de outro.
// Além disso, cada topo de pilha (e cada buraco) precisa ser visível de algum
// ângulo durante a rotação — ver isFullyVisible.

export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface Shape {
  nx: number;
  nz: number;
  /** alturas em ordem de linha: heights[x + z * nx] */
  heights: number[];
  name: string;
}

/** Elevação da câmera no cliente (graus). */
export const CAMERA_ELEVATION_DEG = 38;
/** A checagem de visibilidade usa um ângulo mais baixo que a câmera: margem de segurança. */
const CHECK_ELEVATION_DEG = 30;

type Rng = () => number;

const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (rng: Rng, p: number) => rng() < p;

interface Params {
  minN: number;
  maxN: number;
  maxH: number;
  minTotal: number;
  maxTotal: number;
}

export const PARAMS: Record<Difficulty, Params> = {
  facil: { minN: 3, maxN: 5, maxH: 4, minTotal: 6, maxTotal: 40 },
  medio: { minN: 5, maxN: 8, maxH: 6, minTotal: 35, maxTotal: 130 },
  dificil: { minN: 7, maxN: 11, maxH: 9, minTotal: 110, maxTotal: 380 },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

class Grid {
  n: number;
  h: number[];
  constructor(n: number) {
    this.n = n;
    this.h = new Array(n * n).fill(0);
  }
  in(x: number, z: number) {
    return x >= 0 && z >= 0 && x < this.n && z < this.n;
  }
  get(x: number, z: number) {
    return this.in(x, z) ? this.h[x + z * this.n] : 0;
  }
  set(x: number, z: number, v: number) {
    if (this.in(x, z)) this.h[x + z * this.n] = Math.max(0, v);
  }
  raise(x: number, z: number, v: number) {
    if (this.in(x, z)) this.set(x, z, Math.max(this.get(x, z), v));
  }
  rect(x0: number, z0: number, w: number, d: number, v: number, mode: 'max' | 'set' | 'add' = 'max') {
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++) {
        if (mode === 'max') this.raise(x, z, v);
        else if (mode === 'set') this.set(x, z, v);
        else this.set(x, z, this.get(x, z) + v);
      }
  }
  each(fn: (x: number, z: number) => void) {
    for (let z = 0; z < this.n; z++) for (let x = 0; x < this.n; x++) fn(x, z);
  }
}

interface Template {
  name: string;
  minN: number;
  build: (rng: Rng, n: number, maxH: number) => Grid;
}

const TEMPLATES: Template[] = [
  {
    name: 'Base com torres',
    minN: 3,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const b = ri(rng, 1, Math.min(2, maxH - 1));
      const bw = ri(rng, Math.max(2, n - 2), n);
      const bd = ri(rng, Math.max(2, n - 2), n);
      g.rect(0, 0, bw, bd, b);
      const k = ri(rng, 1, 3);
      for (let i = 0; i < k; i++) {
        const w = ri(rng, 1, Math.max(1, Math.floor(n / 3)));
        const d = chance(rng, 0.6) ? w : ri(rng, 1, Math.max(1, Math.floor(n / 3)));
        g.rect(ri(rng, 0, bw - w), ri(rng, 0, bd - d), w, d, ri(rng, b + 1, maxH));
      }
      return g;
    },
  },
  {
    name: 'Diagonal com torre',
    minN: 4,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const b = ri(rng, 0, 1);
      if (b) g.rect(0, 0, n, n, b);
      const w = ri(rng, 1, 2);
      const flip = chance(rng, 0.5);
      const top = Math.max(b + 1, maxH - 1);
      for (let x = 0; x < n; x++)
        for (let z = 0; z < n; z++) {
          const zz = flip ? n - 1 - z : z;
          const k = zz - x;
          if (k >= 0 && k < w) g.raise(x, z, b + 1 + Math.floor((x * (top - b - 1)) / (n - 1)));
        }
      if (chance(rng, 0.7)) {
        const s = ri(rng, 1, 2);
        const tx = chance(rng, 0.5) ? 0 : n - s;
        const tz = chance(rng, 0.5) ? 0 : n - s;
        g.rect(tx, tz, s, s, maxH);
      }
      return g;
    },
  },
  {
    name: 'Pirâmide em degraus',
    minN: 3,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const s = n >= 7 && chance(rng, 0.4) ? 2 : 1;
      const c = (n - 1) / 2;
      const L = Math.min(maxH, Math.ceil(n / 2 / s) + ri(rng, 0, 1));
      g.each((x, z) => {
        const cheb = Math.max(Math.abs(x - c), Math.abs(z - c));
        g.set(x, z, L - Math.floor((cheb + 0.01) / s));
      });
      if (chance(rng, 0.35) && n >= 7) {
        // cratera no topo
        const r = 1;
        g.each((x, z) => {
          const cheb = Math.max(Math.abs(x - c), Math.abs(z - c));
          if (cheb <= r) g.set(x, z, g.get(x, z) - 2);
        });
      }
      if (chance(rng, 0.5)) {
        // cantos mordidos
        const m = ri(rng, 1, Math.max(1, Math.floor(n / 4)));
        for (const [cx, cz] of [
          [0, 0],
          [n - m, 0],
          [0, n - m],
          [n - m, n - m],
        ])
          if (chance(rng, 0.6)) g.rect(cx, cz, m, m, 0, 'set');
      }
      return g;
    },
  },
  {
    name: 'Pátio murado',
    minN: 5,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const f = ri(rng, 0, 1);
      const hw = ri(rng, 2, Math.max(2, maxH - 2));
      const t = n >= 8 && chance(rng, 0.4) ? 2 : 1;
      g.rect(0, 0, n, n, hw);
      g.rect(t, t, n - 2 * t, n - 2 * t, f, 'set');
      // portão em um dos lados
      const gw = ri(rng, 1, 2);
      const pos = ri(rng, t, n - t - gw);
      const side = ri(rng, 0, 3);
      if (side === 0) g.rect(pos, 0, gw, t, f, 'set');
      if (side === 1) g.rect(pos, n - t, gw, t, f, 'set');
      if (side === 2) g.rect(0, pos, t, gw, f, 'set');
      if (side === 3) g.rect(n - t, pos, t, gw, f, 'set');
      // torres nos cantos
      for (const [cx, cz] of [
        [0, 0],
        [n - t, 0],
        [0, n - t],
        [n - t, n - t],
      ])
        if (chance(rng, 0.5)) g.rect(cx, cz, t, t, Math.min(maxH, hw + ri(rng, 1, 2)), 'set');
      return g;
    },
  },
  {
    name: 'Plataforma com lacunas',
    minN: 4,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const b = ri(rng, 1, Math.min(2, maxH - 1));
      g.rect(0, 0, n, n, b);
      const k = ri(rng, 2, 4);
      for (let i = 0; i < k; i++) {
        if (chance(rng, 0.5)) {
          // reentrância a partir da borda
          const w = ri(rng, 1, 2);
          const depth = ri(rng, 1, Math.floor(n / 2));
          const side = ri(rng, 0, 3);
          const pos = ri(rng, 0, n - w);
          if (side === 0) g.rect(pos, 0, w, depth, 0, 'set');
          if (side === 1) g.rect(pos, n - depth, w, depth, 0, 'set');
          if (side === 2) g.rect(0, pos, depth, w, 0, 'set');
          if (side === 3) g.rect(n - depth, pos, depth, w, 0, 'set');
        } else {
          // buraco largo no meio
          const w = ri(rng, 2, 3);
          const d = ri(rng, 2, 3);
          g.rect(ri(rng, 0, n - w), ri(rng, 0, n - d), w, d, ri(rng, 0, b - 1), 'set');
        }
      }
      const towers = ri(rng, 0, 2);
      for (let i = 0; i < towers; i++) {
        const x = ri(rng, 0, n - 1);
        const z = ri(rng, 0, n - 1);
        if (g.get(x, z) > 0) g.set(x, z, ri(rng, b + 2, maxH));
      }
      return g;
    },
  },
  {
    name: 'Cruz',
    minN: 5,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const b = ri(rng, 0, 1);
      if (b) g.rect(0, 0, n, n, b);
      const aw = n % 2 === 1 ? 1 : 2;
      const c0 = Math.floor((n - aw) / 2);
      const decay = chance(rng, 0.6);
      for (let i = 0; i < n; i++) {
        const dist = Math.max(0, Math.max(c0 - i, i - (c0 + aw - 1)));
        const h = decay ? Math.max(b + 1, maxH - dist) : ri(rng, b + 1, maxH);
        for (let a = 0; a < aw; a++) {
          g.raise(c0 + a, i, h);
          g.raise(i, c0 + a, h);
        }
      }
      return g;
    },
  },
  {
    name: 'Blocos empilhados',
    minN: 3,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const k = ri(rng, 3, 6);
      for (let i = 0; i < k; i++) {
        const w = ri(rng, 1, Math.ceil(n / 2));
        const d = ri(rng, 1, Math.ceil(n / 2));
        g.rect(ri(rng, 0, n - w), ri(rng, 0, n - d), w, d, ri(rng, 1, maxH));
      }
      return g;
    },
  },
  {
    name: 'Arquibancada',
    minN: 4,
    build(rng, n, maxH) {
      const g = new Grid(n);
      const top = Math.min(maxH, n);
      const depth = ri(rng, Math.max(2, n - 3), n);
      for (let x = 0; x < n; x++) {
        const h = 1 + Math.floor((x * (top - 1)) / (n - 1));
        g.rect(x, 0, 1, depth, h);
      }
      // corredor (lacuna) cortando os degraus
      if (chance(rng, 0.7) && depth >= 4) {
        const z = ri(rng, 1, depth - 3);
        g.rect(0, z, n, ri(rng, 1, 2), 0, 'set');
      }
      return g;
    },
  },
];

function trim(g: Grid, name: string): Shape {
  let x0 = g.n, x1 = -1, z0 = g.n, z1 = -1;
  g.each((x, z) => {
    if (g.get(x, z) > 0) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  });
  const nx = x1 - x0 + 1;
  const nz = z1 - z0 + 1;
  const heights: number[] = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) heights.push(g.get(x, z));
  return { nx, nz, heights, name };
}

export function totalCubes(heights: number[]): number {
  return heights.reduce((a, b) => a + b, 0);
}

/** Quantos cubos há em cada camada (camada 1 = chão). */
export function layerCounts(heights: number[]): number[] {
  const max = Math.max(0, ...heights);
  const out: number[] = [];
  for (let k = 1; k <= max; k++) out.push(heights.filter((h) => h >= k).length);
  return out;
}

/**
 * Para cada célula (pilha ou buraco), verifica se o centro do topo é visível
 * de pelo menos um ângulo de rotação, com a câmera elevada CHECK_ELEVATION_DEG.
 * Se algum topo nunca aparece, o jogador teria que chutar: a figura é rejeitada.
 */
export function isFullyVisible(s: Shape, elevationDeg = CHECK_ELEVATION_DEG): boolean {
  const { nx, nz, heights } = s;
  const maxH = Math.max(...heights);
  const el = (elevationDeg * Math.PI) / 180;
  const cosE = Math.cos(el);
  const sinE = Math.sin(el);
  const AZ = 24;
  const dirs: [number, number, number][] = [];
  for (let k = 0; k < AZ; k++) {
    const az = (2 * Math.PI * k) / AZ + 0.01;
    dirs.push([Math.sin(az) * cosE, sinE, Math.cos(az) * cosE]);
  }
  const hAt = (x: number, z: number) =>
    x >= 0 && z >= 0 && x < nx && z < nz ? heights[x + z * nx] : 0;
  const STEP = 0.08;

  const clear = (px: number, py: number, pz: number, d: [number, number, number]) => {
    for (let t = STEP; ; t += STEP) {
      const y = py + d[1] * t;
      if (y >= maxH) return true;
      const x = px + d[0] * t;
      const z = pz + d[2] * t;
      if (x < 0 || z < 0 || x >= nx || z >= nz) return true;
      if (y < hAt(Math.floor(x), Math.floor(z))) return false;
    }
  };

  for (let z = 0; z < nz; z++)
    for (let x = 0; x < nx; x++) {
      const h = hAt(x, z);
      if (h >= maxH) continue;
      if (!dirs.some((d) => clear(x + 0.5, h, z + 0.5, d))) return false;
    }
  return true;
}

export function generateShape(difficulty: Difficulty, rng: Rng = Math.random): Shape {
  const p = PARAMS[difficulty];
  for (let attempt = 0; attempt < 600; attempt++) {
    const n = ri(rng, p.minN, p.maxN);
    const tpl = pick(rng, TEMPLATES);
    if (n < tpl.minN) continue;
    const s = trim(tpl.build(rng, n, p.maxH), tpl.name);
    if (s.nx < 1) continue;
    const total = totalCubes(s.heights);
    if (total < p.minTotal || total > p.maxTotal) continue;
    if (!isFullyVisible(s)) continue;
    return s;
  }
  // fallback garantido: pirâmide simples
  const n = p.maxN % 2 ? p.maxN : p.maxN - 1;
  const g = new Grid(n);
  const c = (n - 1) / 2;
  g.each((x, z) => g.set(x, z, Math.ceil(n / 2) - Math.max(Math.abs(x - c), Math.abs(z - c))));
  return trim(g, 'Pirâmide em degraus');
}
