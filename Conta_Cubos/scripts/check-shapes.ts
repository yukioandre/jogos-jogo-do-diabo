// Gera muitas figuras por dificuldade e mostra estatísticas.
// Uso: npm run check-shapes
import { generateShape, totalCubes, type Difficulty } from '../src/shared/shapes.ts';

for (const d of ['facil', 'medio', 'dificil'] as Difficulty[]) {
  const t0 = performance.now();
  const N = 300;
  const totals: number[] = [];
  const byName = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const s = generateShape(d);
    totals.push(totalCubes(s.heights));
    byName.set(s.name, (byName.get(s.name) ?? 0) + 1);
  }
  const ms = (performance.now() - t0) / N;
  totals.sort((a, b) => a - b);
  console.log(
    `${d}: ${ms.toFixed(1)} ms/figura | cubos min ${totals[0]} mediana ${totals[N >> 1]} max ${totals[N - 1]}`,
  );
  console.log('  ', Object.fromEntries(byName));
}
