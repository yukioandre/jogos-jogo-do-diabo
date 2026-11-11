# Poker da Memória

Duelo online para 2 jogadores: memorize 16 cartas em 20 segundos e depois, com a mesa
coberta, escolha as 2 cartas que formam o melhor jogo de pôquer com 3 cartas abertas.

As regras completas para jogadores estão no [README da raiz](../README.md#poker-da-memória).

## Stack

- **Cliente:** TypeScript + Vite, cartas em HTML/CSS (`src/client`)
- **Servidor:** Cloudflare Worker + Durable Objects, uma instância por sala (`src/server`)
- **Compartilhado:** baralho, avaliador de mãos e protocolo (`src/shared`)

O servidor embaralha com aleatoriedade criptográfica e só envia as faces das cartas
durante a memorização e a revelação. Na fase de escolha, o navegador recebe apenas as
letras.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5174 em duas abas (ou dois navegadores) e entre com o mesmo
código de sala.

Outros comandos:

- `npm test` roda os testes do avaliador de mãos
- `npm run typecheck` checa os tipos do cliente e do servidor

## Publicar

```bash
npx wrangler login   # uma vez
npm run deploy
```

O jogo fica em `https://poker-da-memoria.<sua-conta>.workers.dev`.
