# Jogos do Jogo do Diabo

Coleção de jogos rápidos, online e multiplayer que testam raciocínio. Cada jogo fica
na sua própria pasta.

| Jogo | Pasta | Em uma frase |
|---|---|---|
| Conta Cubos | [`Conta_Cubos`](Conta_Cubos) | Uma figura 3D de cubos gira na tela: quem disser primeiro quantos cubos ela tem leva o ponto. |
| Poker da Memória | [`Poker_da_Memoria`](Poker_da_Memoria) | Memorize 16 cartas em 20 segundos e escolha, de olhos na mesa coberta, as 2 que fazem o melhor jogo. |

---

## Conta Cubos

### Objetivo

Uma figura tridimensional formada por cubos empilhados gira devagar na tela de todos
os jogadores ao mesmo tempo. Conte os cubos e digite o total. **Quem acertar primeiro
ganha a rodada.** Quem tiver mais rodadas no final vence a partida.

### Como jogar

1. Uma pessoa entra no jogo, digita o nome e clica em **Criar sala**. Ela vira o
   **anfitrião**.
2. O anfitrião compartilha o **link** ou o **código da sala** (4 letras/números).
   Os outros jogadores entram com o próprio nome e esse código.
3. O anfitrião escolhe a **dificuldade** e o **número de rodadas** (1, 3, 5 ou 10) e
   clica em **Começar**.
4. A cada rodada aparece uma figura nova. Digite quantos cubos ela tem e clique em
   **Enviar** (ou aperte Enter).
5. Quando alguém acerta, a rodada termina para todos e a resposta é revelada,
   junto com a quantidade de cubos em cada camada. Depois de alguns segundos começa
   a próxima rodada.
6. Ao final, aparece o ranking. O anfitrião pode iniciar uma **nova partida**.

### Regras

- **Vale o primeiro acerto que chega ao servidor.** A ordem é decidida pelo servidor,
  não pelo relógio de cada jogador.
- **Cada acerto vale 1 ponto.** Não há pontos negativos.
- **Errou? Fica 4 segundos sem poder responder.** Isso impede sair chutando números
  em sequência.
- **Tempo da rodada:** 60 s no Fácil, 90 s no Médio e 150 s no Difícil. Se o tempo
  acabar sem acerto, ninguém pontua e a resposta é revelada.
- **Empate no final:** jogadores com a mesma pontuação dividem a posição.
- Se o anfitrião sair, o jogador que está há mais tempo na sala assume o lugar dele.
- Quem entra no meio da partida joga a partir da rodada atual.

### Como as figuras são construídas

As figuras foram pensadas para testar estratégia de contagem, não sorte. Toda figura
segue estas garantias:

- **Nada flutua.** Toda pilha de cubos vai até o chão. Se você vê o topo de uma pilha,
  sabe que há cubos embaixo dele até a base.
- **Nada fica escondido.** O topo de toda pilha e o fundo de todo buraco aparecem em
  algum momento da rotação. Nenhuma resposta depende de chute.
- **Cada cor é uma camada de altura.** Azul é a primeira camada (o chão), laranja a
  segunda, verde a terceira, e assim por diante. A cor de um topo diz a altura daquela
  pilha.

Tipos de figura que podem aparecer: base com torres, diagonal em escada com torre,
pirâmide em degraus (às vezes com cratera ou cantos cortados), pátio murado com
portão, plataforma com lacunas, cruz, blocos empilhados e arquibancada com corredor.

### Dificuldades

| Dificuldade | Tamanho da base | Altura máxima | Total de cubos | Tempo |
|---|---|---|---|---|
| Fácil | até 5 × 5 | 4 camadas | 6 a 40 | 60 s |
| Médio | até 8 × 8 | 6 camadas | 35 a 130 | 90 s |
| Difícil | até 11 × 11 | 9 camadas | 110 a 380 | 150 s |

### Dicas de estratégia

- **Conte por camadas.** Conte quantos cubos tem a camada de baixo, depois a de cima,
  e some. A revelação no fim da rodada mostra exatamente essa conta.
- **Conte por colunas.** Some a altura de cada pilha, usando a cor do topo para saber
  a altura.
- **Conte o cheio e subtraia o vazio.** Numa plataforma 10 × 10 com lacunas, conte
  100 e tire os buracos.
- **Use a rotação.** Torres altas escondem o que está atrás delas. Espere a figura
  girar antes de fechar a conta.

---

## Poker da Memória

### Objetivo

Duelo entre 2 jogadores. Memorize 16 cartas, lembre onde cada uma está e escolha as 2
que, somadas a 3 cartas abertas, formam o **melhor jogo de pôquer**. A melhor mão vence
a rodada; quem vencer mais rodadas vence a partida.

### Como jogar

1. Uma pessoa entra no jogo, digita o nome e clica em **Criar sala**. Ela vira o
   **anfitrião**.
2. O anfitrião compartilha o **link** ou o **código da sala**. Os **dois primeiros** a
   entrar são os jogadores. Quem entrar depois assiste.
3. O anfitrião escolhe o número de rodadas (1, 3, 5 ou 7) e clica em **Começar**.
4. **Memorização (20 segundos):** 16 cartas do baralho aparecem viradas para cima, em
   4 fileiras de 4.
5. **Cobertura:** as cartas são viradas. No verso de cada uma aparece uma letra, na
   ordem de leitura: A, B, C, D na primeira fileira, E a H na segunda, I a L na
   terceira e M a P na quarta.
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

### Regras

- A escolha é **secreta e definitiva**. Depois de confirmar, não dá para trocar. O
  adversário só sabe que você já escolheu, não o quê.
- **Os dois podem escolher as mesmas cartas.** Uma carta escolhida por um jogador não
  fica indisponível para o outro.
- **Quem não confirmar em 60 segundos perde a rodada.** Se nenhum dos dois confirmar,
  a rodada empata.
- **Empate:** se as duas mãos tiverem exatamente o mesmo valor, ninguém pontua.
- Cada rodada usa um baralho novo de 52 cartas, embaralhado.
- Se um dos dois jogadores sair no meio da partida, ela é interrompida e a sala volta
  para a espera.

### Mãos válidas, da melhor para a pior

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

### Dicas de estratégia

- **Olhe as 3 abertas antes de procurar.** Elas dizem que jogo está ao seu alcance: dois
  naipes iguais sugerem flush, valores próximos sugerem sequência, um par aberto pede
  uma trinca ou um full house.
- **Memorize por padrões, não carta a carta.** Grave onde estão os pares, os naipes
  repetidos e as cartas altas (A, K, Q).
- **Use as fileiras.** Lembrar "o par de 7 está na segunda fileira" é mais fácil que
  lembrar 16 posições soltas.

---

Detalhes técnicos de cada jogo (como rodar, stack e publicação) estão no README da
pasta do jogo.
