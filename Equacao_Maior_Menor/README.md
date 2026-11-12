# Equação Maior-Menor

Jogo online para 2 a 6 jogadores que mistura cálculo e pôquer. Cada um monta uma
equação com as próprias cartas, aposta fichas e decide em segredo se quer chegar perto
de **1** (aposta baixa), de **20** (aposta alta) ou dos dois.

## Objetivo

Ficar com o maior número de fichas. Quem chega mais perto do alvo escolhido leva metade
do pote de cada mão.

## As cartas

**Cartas de operação (de cada jogador):** todos começam com **+**, **−** e **÷**. Elas
ficam com o jogador a mão inteira.

**Baralho (distribuído pelo computador):**

| Carta | Quantidade | Observação |
|---|---|---|
| Números de 0 a 10 | 44 (11 de cada metal) | Cada número existe em 4 metais: **ouro**, **prata**, **bronze** e **terra** |
| √ (raiz quadrada) | 4 | Vale para um único número |
| × (multiplicação) | 4 | Substitui o + ou o − |

## Como jogar

1. Uma pessoa entra no jogo, digita o nome e clica em **Criar sala**. Ela vira o
   **anfitrião** e escolhe com quantas fichas cada jogador começa (**de 1 a 99**).
2. Os **6 primeiros** a entrar jogam; quem entrar depois assiste. A ordem de chegada é a
   ordem na mesa.
3. O anfitrião clica em **Começar**. A partida é jogada em **mãos**, e cada mão segue os
   passos abaixo.

### 1. Aposta básica

Cada jogador coloca **1 ficha** no pote.

### 2. Distribuição

- **Carta oculta:** cada jogador recebe 1 carta que só ele vê. Ela é sempre um
  **número**: se sair √ ou ×, a carta volta para o baralho e outra é dada no lugar.
- **Duas cartas abertas:** todos veem. Se sair uma carta especial:
  - **√:** o jogador fica com ela e recebe **mais uma carta**.
  - **×:** o jogador fica com ela, **descarta o + ou o −** (ele escolhe qual) e recebe
    **mais uma carta**. O descarte é visível para todos.
  - **Segunda carta especial:** cada jogador só pode ter uma. Se vier outra, ela é
    descartada e o jogador recebe uma nova carta, até sair um número.

### 3. Primeira rodada de apostas

Na sua vez, você pode:

- **passar a vez**, se ninguém apostou ainda nesta rodada;
- **apostar** ou **aumentar** a aposta;
- **igualar** a aposta atual;
- **desistir**, saindo da mão e perdendo o que já apostou.

Depois que alguém aposta, ninguém pode mais passar: é preciso igualar, aumentar ou
desistir. A rodada termina quando todos igualaram a maior aposta.

> **Limite de aposta:** o total que cada jogador coloca no pote numa mão não pode passar
> da quantidade de fichas do jogador **com menos fichas** no começo da mão.

### 4. Mais uma carta aberta

Cada jogador que continua na mão recebe **mais uma carta aberta**, com as mesmas regras
de √ e ×.

No fim, todo jogador tem **4 números** e **3 operações** (+, −, ÷, ou × no lugar de + ou
−), e talvez uma **√**.

### 5. Montar a equação (90 segundos)

Cada jogador monta, em segredo, uma equação usando **todas as suas cartas**:

- números e operações se alternam, e não há parênteses;
- **× e ÷ são calculados antes de + e −**;
- a **√** vale para um único número (ex.: √9 vale 3);
- divisão por zero não vale.

> **Exemplo:** com 8, 2, 5, 3 e as operações +, −, ÷: `8 ÷ 2 + 5 − 3 = 6`.

### 6. Segunda rodada de apostas

Igual à primeira. Agora cada um já sabe o que sua equação consegue alcançar.

### 7. Alta, baixa ou as duas (60 segundos)

Cada jogador pega em segredo uma ficha e **fecha a mão**:

- **ficha branca (1): aposta baixa**, chegar o mais perto possível de **1**;
- **ficha preta (20): aposta alta**, chegar o mais perto possível de **20**;
- **as duas fichas: aposta dupla**, apostar alto e baixo ao mesmo tempo.

Junto com a ficha, o jogador confirma a equação. Ninguém vê a escolha dos outros até o
resultado; só aparece que a mão de cada um está fechada.

**Aposta dupla:** a equação confirmada vale para a **alta**. O jogo guarda essa equação
e dá **20 segundos** para o jogador reorganizar as mesmas cartas numa equação para a
**baixa**.

### 8. Resultado

As mãos se abrem e todas as equações são mostradas.

- Quem apostou **alto** disputa com quem apostou alto; quem apostou **baixo**, com quem
  apostou baixo.
- **Vence cada lado quem chegar mais perto do alvo** (20 na alta, 1 na baixa). Passar do
  alvo também vale: 21 e 19 estão à mesma distância de 20.
- **Cada lado leva metade do pote**, não importa quantos jogadores disputaram cada lado.
  Se o pote for ímpar, **1 ficha é descartada**.
- Se **ninguém apostou num dos lados**, o vencedor do outro lado leva o **pote
  inteiro**.
- **Aposta dupla:** o jogador precisa **vencer os dois lados**. Se perder qualquer um,
  perde a aposta toda e sai da disputa dos dois lados, que são decididos entre os
  demais.
- Se todos desistirem durante as apostas, quem sobrou leva o pote sem mostrar a
  equação.

### Desempate

Se dois jogadores ficarem à mesma distância do alvo:

1. **Na alta**, vence quem tiver a **maior carta** na equação. **Na baixa**, vence quem
   tiver a **menor carta**.
2. Se as cartas tiverem o mesmo número, decide o **metal**: **ouro > prata > bronze >
   terra**. Na alta vence o metal mais valioso; na baixa, o menos valioso.

> **Exemplo:** dois jogadores apostam alto e chegam a 19. Os dois têm um 9 como maior
> carta, mas um é 9 de **prata** e o outro 9 de **terra**. Vence o 9 de prata.

## Fim da partida

Jogadores sem fichas ficam de fora das mãos seguintes. A partida acaba quando só um
jogador tem fichas ou quando o anfitrião clica em **Encerrar partida** (ao fim de
qualquer mão). Vence quem tiver mais fichas.

## Tempos e situações especiais

- **Vez de apostar:** 30 segundos. Se o tempo acabar, o jogo passa a vez se for possível;
  se houver aposta a igualar, o jogador desiste.
- **Descarte do + ou −:** 20 segundos. Se o tempo acabar, o descarte é sorteado.
- **Montar a equação:** 90 segundos, ou até todos clicarem em **Pronto**. A equação
  ainda pode ser ajustada na hora de fechar a mão.
- **Fechar a mão:** 60 segundos. Quem não fechar a tempo fica de fora da mão.
- **Equação da baixa na aposta dupla:** 20 segundos. Se o tempo acabar, vale a mesma
  equação da alta.
- O primeiro a apostar muda a cada mão, passando para o próximo jogador na mesa.
- Se um jogador sair da sala no meio da partida, ela é interrompida e a sala volta
  para a espera.

## Dicas de estratégia

- **Olhe as cartas abertas dos outros.** Elas mostram 3 das 4 cartas de cada um e
  dizem muito sobre o que eles conseguem alcançar.
- **A ÷ é a ferramenta da baixa.** Dividir um número pelo outro de valor próximo dá
  resultados perto de 1.
- **O × é a ferramenta da alta**, mas custa um + ou um −.
- **A aposta dupla leva o pote inteiro**, mas exige uma mão que sirva para os dois
  alvos.

---

## Parte técnica

### Stack

- **Cliente:** TypeScript + Vite, interface em HTML/CSS e SVG (`src/client`)
- **Servidor:** Cloudflare Worker + Durable Objects, uma instância por sala (`src/server`)
- **Compartilhado:** baralho, validação e cálculo das equações, resolução do confronto
  e protocolo (`src/shared`)

Cada jogador recebe do servidor um estado próprio: a carta oculta dos outros, as fichas
escolhidas e as equações só saem do servidor no resultado. A equação enviada é validada
no servidor.

### Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5176 em várias abas e entre com o mesmo código de sala.

Outros comandos:

- `npm test` roda os testes das regras (equações, desempates, aposta dupla, divisão do
  pote)
- `npm run typecheck` checa os tipos do cliente e do servidor
- `npm run sim` joga 8 mãos com 3 bots contra o servidor local (precisa de
  `npx wrangler dev --port 8790` rodando) e confere a conservação de fichas e o sigilo
  da carta oculta

### Publicar

```bash
npx wrangler login   # uma vez
npm run deploy
```

O jogo fica em `https://equacao-maior-menor.<sua-conta>.workers.dev`.
