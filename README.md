# Jogos do Jogo do Diabo

Coleção de jogos rápidos, online e multiplayer que testam raciocínio. Cada jogo fica
na sua própria pasta.

| Jogo | Pasta | Em uma frase |
|---|---|---|
| Conta Cubos | [`Conta_Cubos`](Conta_Cubos) | Uma figura 3D de cubos gira na tela: quem disser primeiro quantos cubos ela tem leva o ponto. |

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

Detalhes técnicos de cada jogo (como rodar, stack e publicação) estão no README da
pasta do jogo.
