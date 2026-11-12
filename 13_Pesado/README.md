# 13 Pesado

Jogo online para 2 a 8 jogadores. Há três suportes na mesa: vermelho, verde e azul.
Cada jogador vai colocando cubos com peso de 0 a 6 nesses suportes. **Nenhum suporte
pode passar de 13.** Quem faz um suporte passar de 13 leva a culpa pelos cubos que
caem.

## Objetivo

Terminar as 7 rodadas com a **menor penalidade possível**.

## O que cada jogador tem

- **7 cubos**, com pesos 0, 1, 2, 3, 4, 5 e 6. Cada cubo é usado uma única vez.
- **7 fichas de cor:** 2 vermelhas, 2 verdes, 2 azuis e 1 arco-íris. Cada ficha também
  é usada uma única vez.

Como cada rodada gasta 1 cubo e 1 ficha, a partida tem exatamente **7 rodadas**.

## Como jogar

1. Uma pessoa entra no jogo, digita o nome e clica em **Criar sala**. Ela vira o
   **anfitrião** e compartilha o link ou o código da sala.
2. Os **8 primeiros** a entrar jogam; quem entrar depois assiste. A ordem de chegada é
   a ordem dos lugares na mesa, ou seja, o **sentido horário**.
3. O anfitrião clica em **Começar**.

Cada rodada tem duas etapas.

### 1. Escolha secreta (até 3 minutos)

Todos escolhem, ao mesmo tempo e em segredo, **1 cubo** e **1 ficha**:

- o **cubo** define o peso que você vai colocar;
- a **ficha** define o suporte: vermelha vai no vermelho, verde no verde, azul no azul.
  A **arco-íris** permite escolher qualquer suporte na hora de colocar.

Ninguém vê a escolha dos outros até todos confirmarem. Aí todas as escolhas são
reveladas e a ordem de jogada é definida.

### 2. Colocação, um por vez

**Ordem de jogada:**

1. Quem escolheu a **ficha arco-íris** joga primeiro.
2. Depois, do **cubo mais pesado para o mais leve**.
3. **Empate de peso:** joga antes o **primeiro jogador** da rodada (marcado com **1º**
   na lista de jogadores) e, depois dele, os outros empatados no sentido horário.

O primeiro jogador muda a cada rodada, passando para o próximo no sentido horário.

**Na sua vez, você tem duas opções:**

- **Colocar** o cubo no suporte da sua ficha (ou, com a arco-íris, no suporte que
  quiser);
- **Passar a vez.** Passar não livra você de colocar o cubo: ele será colocado **depois
  que todos jogarem**. Se vários jogadores passarem, os cubos são colocados em **ordem
  inversa**, começando pelo **último que passou**. Quem passou não pode passar de novo.

### Estourou o 13?

Se, depois que você coloca seu cubo, a soma do suporte **passar de 13**:

- **todos os outros cubos** daquele suporte são retirados;
- **o seu cubo fica** no suporte, sozinho;
- você recebe **−1 de penalidade por cubo retirado** (o seu não conta).

> **Exemplo:** o suporte tem cubos de peso 6 e 3 (total 9). Você coloca um 5: o total
> vai a 14 e passa de 13. Os cubos 6 e 3 saem, o seu 5 fica, e você leva **−2**.

Exatamente 13 **não** estoura. Cubos de peso 0 também contam como cubo na hora da
penalidade.

Os cubos **continuam nos suportes de uma rodada para a outra**. Os suportes só esvaziam
quando alguém estoura.

## Fim de jogo

Depois da 7ª rodada, vence quem tiver a **menor penalidade**. Jogadores com a mesma
penalidade empatam.

## Tempo e situações especiais

- **Escolha:** 3 minutos. Quem não escolher a tempo recebe um cubo e uma ficha
  sorteados entre os que ainda tem.
- **Colocação:** 30 segundos por vez. Se o tempo acabar, o cubo é colocado
  automaticamente: no suporte da ficha ou, com a arco-íris, no suporte mais leve.
- **Última rodada:** como só sobra 1 cubo e 1 ficha, a escolha é automática.
- Cubos de quem passou com ficha de cor são colocados automaticamente no fim da
  rodada, já que não há decisão a tomar. Quem passou com a arco-íris escolhe o suporte
  na hora.
- Os cubos e fichas que cada jogador ainda tem ficam visíveis para todos na lista de
  jogadores (os usados já foram revelados nas rodadas anteriores).
- Se um jogador sair no meio da partida, ela é interrompida e a sala volta para a
  espera.

## Dicas de estratégia

- **Conte o que ainda está na mão dos outros.** A lista de jogadores mostra os cubos e
  fichas restantes de cada um. Se ninguém mais tem ficha azul, o suporte azul está
  seguro.
- **Passar é uma arma.** Quem coloca por último sabe exatamente quanto cada suporte
  tem. Mas cuidado: se outros também passarem, a ordem se inverte.
- **Cubos leves no fim, pesados no começo.** Jogar pesado cedo (com o suporte vazio) é
  seguro; jogar pesado tarde é arriscado.
- **A arco-íris joga primeiro.** Ela dá flexibilidade de suporte, mas tira de você a
  vantagem de ver o que os outros vão fazer.

---

## Parte técnica

### Stack

- **Cliente:** TypeScript + Vite, interface em HTML/CSS (`src/client`)
- **Servidor:** Cloudflare Worker + Durable Objects, uma instância por sala (`src/server`)
- **Compartilhado:** regras (ordem de jogada e colocação) e protocolo (`src/shared`)

As escolhas de cada rodada ficam só no servidor até todos confirmarem. Os cubos e
fichas restantes de cada jogador só são atualizados quando as escolhas são reveladas,
para não denunciar o que alguém escolheu.

### Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5175 em várias abas e entre com o mesmo código de sala.

Outros comandos:

- `npm test` roda os testes das regras (ordem de jogada e estouro)
- `npm run typecheck` checa os tipos do cliente e do servidor

### Publicar

```bash
npx wrangler login   # uma vez
npm run deploy
```

O jogo fica em `https://treze-pesado.<sua-conta>.workers.dev`.
