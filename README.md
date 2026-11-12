# Jogos do Jogo do Diabo

Coleção de jogos rápidos, online e multiplayer que testam raciocínio, contagem e
memória. Cada jogo é um projeto independente, na sua própria pasta, com regras,
código e instruções de publicação.

## Jogos

| Jogo | Jogadores | Dinâmica |
|---|---|---|
| [Conta Cubos](Conta_Cubos) | 2 a 30 | Uma figura 3D de cubos empilhados gira na tela. Quem disser primeiro quantos cubos ela tem leva o ponto. |
| [Poker da Memória](Poker_da_Memoria) | 2 (+ espectadores) | 16 cartas ficam à mostra por 20 segundos e depois são cobertas. Cada jogador escolhe 2 delas para formar, com 3 cartas abertas, a melhor mão de pôquer. |

As regras completas de cada jogo estão no README da pasta dele.

## Estrutura do repositório

```
jogos-jogo-do-diabo/
├── Conta_Cubos/        regras, código e configuração do Conta Cubos
├── Poker_da_Memoria/   regras, código e configuração do Poker da Memória
└── README.md           este arquivo
```

## Stack comum

Todos os jogos seguem a mesma base:

- **Linguagem:** TypeScript no cliente e no servidor.
- **Cliente:** Vite (com Three.js quando o jogo é em 3D).
- **Tempo real:** WebSockets com servidor autoritativo: é o servidor que decide a ordem
  das jogadas e quem venceu.
- **Hospedagem:** Cloudflare Workers + Durable Objects. Cada sala de jogo é um Durable
  Object, e o mesmo deploy serve o site e as conexões em tempo real.

## Rodar um jogo

Entre na pasta do jogo e rode:

```bash
npm install
npm run dev
```

O endereço local e os demais comandos estão no README de cada jogo.

## Publicar

Dentro da pasta do jogo:

```bash
npx wrangler login   # uma vez por computador
npm run deploy
```

Cada jogo é publicado como um Worker separado na Cloudflare.

## Adicionar um jogo novo

1. Crie uma pasta com o nome do jogo (ex.: `Nome_Do_Jogo/`).
2. Siga a estrutura dos jogos existentes: `src/client`, `src/server`, `src/shared` e um
   `wrangler.jsonc` com nome próprio.
3. Escreva um `README.md` na pasta com objetivo, regras e parte técnica.
4. Adicione uma linha na tabela de jogos acima.
