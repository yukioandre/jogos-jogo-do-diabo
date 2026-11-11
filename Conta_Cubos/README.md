# Conta Cubos

Jogo multiplayer online: uma figura 3D feita de cubos gira devagar e os jogadores
precisam dizer quantos cubos ela tem. Quem acertar primeiro leva o ponto da rodada.

As regras completas para jogadores estão no [README da raiz](../README.md#conta-cubos).

## Regras de construção das figuras

- Toda figura é um mapa de alturas: cada pilha vai até o chão, sem cubos flutuando.
- O servidor só aceita uma figura se o topo de **toda** pilha (e o fundo de todo buraco)
  ficar visível em algum momento da rotação. Nada precisa ser chutado.
- Cada camada de altura tem uma cor, o que permite contar por camada.
- Famílias de figuras: base com torres, diagonal com torre, pirâmide em degraus,
  pátio murado, plataforma com lacunas, cruz, blocos empilhados e arquibancada
  (`src/shared/shapes.ts`).

| Dificuldade | Grade | Altura máx. | Cubos | Tempo |
|---|---|---|---|---|
| Fácil | 3–5 | 4 | 6–40 | 60 s |
| Médio | 5–8 | 6 | 35–130 | 90 s |
| Difícil | 7–11 | 9 | 110–380 | 150 s |

## Stack

- **Cliente:** TypeScript + Vite + Three.js (`src/client`)
- **Servidor:** Cloudflare Worker + Durable Objects, uma instância por sala (`src/server`)
- **Compartilhado:** gerador de figuras e protocolo de mensagens (`src/shared`)

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para testar com várias pessoas, abra mais abas e entre
com o mesmo código de sala.

Outros comandos:

- `npm run typecheck` checa os tipos do cliente e do servidor
- `npm run check-shapes` gera 300 figuras por dificuldade e mostra estatísticas

## Publicar

```bash
npx wrangler login   # uma vez
npm run deploy
```

O jogo fica em `https://conta-cubos.<sua-conta>.workers.dev`.
