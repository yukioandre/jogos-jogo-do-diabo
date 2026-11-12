// Desenho da mão que segura as fichas: aberta mostra as fichas, fechada esconde.

export interface HandOpts {
  low: boolean; // ficha branca (1)
  high: boolean; // ficha preta (20)
  closed: boolean;
  size?: number;
  label?: string;
}

const chip = (cx: number, cy: number, kind: 'low' | 'high') => {
  const white = kind === 'low';
  return `<g class="chip-g">
    <circle cx="${cx}" cy="${cy}" r="17" fill="${white ? '#f7f6f0' : '#1c1c22'}" stroke="${white ? '#9a978d' : '#55555f'}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="12.5" fill="none" stroke="${white ? '#c9c5b8' : '#4a4a55'}" stroke-width="3" stroke-dasharray="4 3"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${white ? 15 : 13}" font-weight="700"
      font-family="Space Grotesk, sans-serif" fill="${white ? '#1c1c22' : '#f7f6f0'}">${white ? '1' : '20'}</text>
  </g>`;
};

export function handSvg(o: HandOpts): string {
  const size = o.size ?? 160;
  const chips: string[] = [];
  if (o.low && o.high) chips.push(chip(64, 132, 'low'), chip(98, 132, 'high'));
  else if (o.low) chips.push(chip(81, 132, 'low'));
  else if (o.high) chips.push(chip(81, 132, 'high'));
  const fingers = [
    { x: 36, top: 44 },
    { x: 60, top: 30 },
    { x: 84, top: 34 },
    { x: 108, top: 50 },
  ]
    .map(
      (f) =>
        `<rect class="finger" x="${f.x}" y="${f.top}" width="21" height="${108 - f.top}" rx="10.5"/>`,
    )
    .join('');
  return `<svg class="hand-svg ${o.closed ? 'closed' : ''}" viewBox="0 0 160 200" width="${size}" height="${size * 1.25}"
      role="img" aria-label="${o.label ?? (o.closed ? 'Mão fechada' : 'Mão aberta')}">
    <path class="palm" d="M30 100 Q30 92 40 92 L124 92 Q134 92 134 100 L134 150 Q134 192 82 192 Q30 192 30 150 Z"/>
    ${chips.join('')}
    ${fingers}
    <rect class="thumb" x="8" y="104" width="22" height="58" rx="11"/>
  </svg>`;
}
