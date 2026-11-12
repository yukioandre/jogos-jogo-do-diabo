# Poker da Memória

Duelo online para 2 jogadores: memorize 16 cartas em 20 segundos e depois, com a mesa
coberta, escolha as 2 cartas que formam o melhor jogo de pôquer com 3 cartas abertas.

## Objetivo

Memorize as 16 cartas, lembre onde cada uma está e escolha as 2 que, somadas a 3
cartas abertas, formam o **melhor jogo de pôquer**. A melhor mão vence a rodada; quem
vencer mais rodadas vence a partida.

## Como jogar

1. Uma pessoa entra no jogo, digita o nome e clica em **Criar sala**. Ela vira o
   **anfitrião**.
2. O anfitrião compartilha o **link** ou o **código da sala**. Os **dois primeiros** a
   entrar são os jogadores. Quem entrar depois assiste.
3. O anfitrião escolhe o número de rodadas (1, 3, 5 ou 7) e clica em **Começar**.
4. **Memorização (20 segundos):** 16 cartas do baralho aparecem viradas para cima, em
   4 fileiras de 4.
5. **Cobertura:** as cartas são viradas. No verso de cada uma aparece uma letra, na
   ordem de leitura:
   ```
   A  B  C  D
   E  F  G  H
   I  J  K  L
   M  N  O  P
   ```
6. **Cartas abertas:** 3 cartas novas, que não estão entre as 16, são abertas para os
   dois jogadores.
7. **Escolha (60 segundos):** cada jogador escolhe, em segredo, **2 letras** e confirma.
   As 2 cartas escolhidas + as 3 abertas formam a mão de 5 cartas.
8. **Revelação:** todas as cartas são desviradas, as mãos são comparadas e o vencedor
   da rodada ganha 1 ponto. O anfitrião avança para a próxima rodada.

## Regras

- A escolha é **secreta e definitiva**. Depois de confirmar, não dá para trocar. O
  adversário só sabe que você já escolheu, não o quê.
- **Os dois podem escolher as mesmas cartas.** Uma carta escolhida por um jogador não
  fica indisponível para o outro.
- **Quem não confirmar em 60 segundos perde a rodada.** Se nenhum dos dois confirmar, a
  rodada empata.
- **Empate:** se as duas mãos tiverem exatamente o mesmo valor, ninguém pontua.
- Cada rodada usa um baralho novo de 52 cartas, embaralhado.
- Se um dos dois jogadores sair no meio da partida, ela é interrompida e a sala volta
  para a espera.

## Mãos válidas, da melhor para a pior

| # | Mão | O que é | Exemplo |
|---|---|---|---|
| 1 | **Straight flush** | Sequência de 5 cartas do mesmo naipe | 5♥ 6♥ 7♥ 8♥ 9♥ |
| 2 | **Quadra** | 4 cartas do mesmo valor | K♠ K♥ K♦ K♣ 3♠ |
| 3 | **Full house** | Uma trinca + um par | 8♠ 8♥ 8♦ 4♣ 4♠ |
| 4 | **Flush** | 5 cartas do mesmo naipe, fora de sequência | 2♦ 7♦ 9♦ J♦ K♦ |
| 5 | **Sequência** | 5 cartas de valores seguidos, naipes variados | 6♣ 7♦ 8♠ 9♥ 10♣ |
| 6 | **Trinca** | 3 cartas do mesmo valor | Q♠ Q♥ Q♦ 7♣ 2♠ |
| 7 | **Dois pares** | Dois pares diferentes | J♠ J♦ 5♥ 5♣ A♠ |
| 8 | **Par** | 2 cartas do mesmo valor | 10♥ 10♣ K♠ 6♦ 3♥ |
| 9 | **Carta alta** | Nenhuma das anteriores; vale a maior carta | A♣ J♦ 8♠ 5♥ 2♣ |

**Valores das cartas:** 2 < 3 < … < 10 < J < Q < K < A. O Ás também vale 1 na sequência
mais baixa (A-2-3-4-5). Não existe sequência "dando a volta" (Q-K-A-2-3 não vale).

**Desempate dentro da mesma mão** (regras padrão do pôquer):

- Vence o jogo de valor mais alto: par de reis ganha de par de dez; sequência até o 9
  ganha de sequência até o 8.
- No full house, compara-se primeiro a trinca e depois o par.
- Em dois pares, compara-se o par maior, depois o menor, depois a carta que sobra.
- Se os jogos forem iguais, comparam-se as cartas restantes (os *kickers*), da maior
  para a menor.
- Naipes nunca desempatam.

## Dicas de estratégia

- **Olhe as 3 abertas antes de procurar.** Elas dizem que jogo está ao seu alcance: dois
  naipes iguais sugerem flush, valores próximos sugerem sequência, um par aberto pede
  uma trinca ou um full house.
- **Memorize por padrões, não carta a carta.** Grave onde estão os pares, os naipes
  repetidos e as cartas altas (A, K, Q).
- **Use as fileiras.** Lembrar "o par de 7 está na segunda fileira" é mais fácil que
  lembrar 16 posições soltas.

---

## Parte técnica

### Stack

- **Cliente:** TypeScript + Vite, cartas em HTML/CSS (`src/client`)
- **Servidor:** Cloudflare Worker + Durable Objects, uma instância por sala (`src/server`)
- **Compartilhado:** baralho, avaliador de mãos e protocolo (`src/shared`)

O servidor embaralha com aleatoriedade criptográfica e só envia as faces das cartas
durante a memorização e a revelação. Na fase de escolha, o navegador recebe apenas as
letras.

### Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5174 em duas abas (ou dois navegadores) e entre com o mesmo
código de sala.

Outros comandos:

- `npm test` roda os testes do avaliador de mãos
- `npm run typecheck` checa os tipos do cliente e do servidor

### Publicar

```bash
npx wrangler login   # uma vez
npm run deploy
```

O jogo fica em `https://poker-da-memoria.<sua-conta>.workers.dev`.
