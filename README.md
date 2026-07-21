# Spyclaudio

Jogo de dedução social presencial, inspirado em Spyfall, feito para navegador de celular.
Todos os jogadores recebem um local e um papel dentro dele — menos o espião, que precisa
descobrir onde está sem se entregar.

- **Repositório:** https://github.com/fcsimone/Spyclaudio
- **Publicação:** https://fcsimone.github.io/Spyclaudio/
- **Firebase:** projeto `spyclaudio-b8252` (plano gratuito Spark)
- **Idioma:** português do Brasil

## Modos de jogo

**Um aparelho.** O celular circula entre os jogadores. Cada um confirma o próprio nome,
revela o papel numa tela protegida e passa adiante. Não usa Firebase: nada sai do navegador.
Neste modo a votação é feita na conversa, fora do app.

**Vários aparelhos.** O anfitrião cria uma sala, compartilha o código curto ou o QR Code, e
cada jogador entra do próprio celular. O anfitrião inicia a partida, conduz a conversa e abre
a votação, que dura 3 minutos. O resultado aparece igual em todos os aparelhos.

Capacidade: 1 espião → de 3 a 8 jogadores; 2 espiões → de 4 a 9 jogadores.
Cada cenário tem 7 papéis, e nenhum papel se repete numa mesma partida.

## Como rodar localmente

```bash
nvm use              # Node 22 (ver .nvmrc)
npm ci
npm run import:papeis   # gera src/data/scenarios.generated.json a partir de Papeis.xlsx
npm run dev             # http://localhost:5173/Spyclaudio/
```

O modo de um aparelho funciona sem nenhuma configuração. Para o modo com vários aparelhos,
use os emuladores:

```bash
cp .env.example .env     # e defina VITE_USE_EMULATORS=true
npm run emulators        # Auth em 9099, Realtime Database em 9000, UI em 4000
npm run dev              # noutro terminal
```

Os emuladores exigem **JDK 21 ou superior** instalado.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Importa a planilha, checa tipos e gera `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript em modo estrito |
| `npm run check:rules` | Verificação estática de `database.rules.json` |
| `npm run test:unit` | Testes unitários (motor, votação, nomes, modo um aparelho) |
| `npm run test:rules` | Testes das regras do banco, com emulador |
| `npm run test:e2e` | E2E do modo um aparelho, em viewports mobile |
| `npm run test:e2e:online` | E2E com vários aparelhos, com emuladores |
| `npm run validate` | Lint + tipos + regras + unitários + build |
| `npm run deploy:rules` | Publica apenas as regras do Realtime Database |
| `npm run import:papeis` | Regera o JSON de cenários a partir da planilha |

## Conteúdo do jogo

`Papeis.xlsx` é a **fonte editorial**: 100 cenários, 7 papéis cada. Para alterar o conteúdo,
edite a planilha e rode `npm run import:papeis`. O script recusa a importação se encontrar
cabeçalho inesperado, ID ausente ou duplicado, cenário vazio ou repetido, quantidade de papéis
diferente de 7, papel vazio ou repetido dentro do cenário, ou número de linhas diferente de 100.

Nunca edite `src/data/scenarios.generated.json` à mão — o CI compara o arquivo com o resultado
da importação e falha se estiverem diferentes.

## Estrutura

```
src/
  app/        rotas por hash, sessão em memória, assinatura da sala
  components/ botões, QR Code, contagem regressiva
  screens/    telas de cada fluxo
  game/       motor puro: sorteio, distribuição, apuração, nomes, código de sala
  firebase/   cliente, configuração e operações de sala
  data/       cenários gerados a partir da planilha
  styles/     CSS global
scripts/      importador da planilha e verificações
tests/        unit, rules, e2e
```

O motor do jogo (`src/game/`) não conhece React nem Firebase, e é onde estão as regras
testáveis do jogo.

## Segurança

As regras estão em `database.rules.json` e negam tudo por padrão. Em resumo:

- toda leitura e escrita exige `auth != null`;
- a sala só é criada por quem se declara anfitrião com o próprio UID;
- só entra quem chega no lobby, respeitando o limite de jogadores;
- a lotação é garantida pelo contador `meta/playerCount`: a linguagem de regras do
  Realtime Database **não consegue contar filhos** (não existem `numChildren()` nem
  `getChildrenCount()` ali), então a entrada de um jogador só é aceita se, na mesma
  escrita atômica, o contador subir exatamente 1 — e ele nunca passa de `maxPlayers`;
- nomes são reservados de forma atômica em `normalizedNames`, sem duplicidade;
- `secrets/{uid}` é legível apenas pelo próprio jogador — nem o anfitrião lê o nó inteiro;
- só o anfitrião grava segredos, e apenas uma vez por jogador;
- cada jogador escreve apenas o próprio voto, uma única vez, em alvo existente e dentro do prazo;
- votos alheios ficam invisíveis até o estado `result` (o anfitrião lê antes porque é quem apura);
- só o anfitrião publica o resultado, e só uma vez;
- transições de estado são monotônicas: `lobby → distributed → voting → result → closed`;
- campos desconhecidos são rejeitados em todos os nós.

Para publicar as regras:

```bash
npx firebase login          # login interativo, uma vez
npm run deploy:rules
```

Nunca use regras abertas de teste, e nunca gere chave privada de Service Account: o app
precisa apenas da configuração pública do Web SDK.

### Aleatoriedade

O sorteio usa `crypto.getRandomValues` com amostragem sem viés e embaralhamento Fisher–Yates.
`Math.random` é proibido pelo ESLint.

## Limitações conhecidas desta versão

1. **O anfitrião sorteia no próprio navegador.** No plano Spark não há Cloud Functions, então o
   anfitrião pode, tecnicamente, inspecionar as atribuições com ferramentas de desenvolvedor.
   Risco aceito para o MVP. Jogue com pessoas em quem confia.
2. **Recarregar a página encerra a participação.** A identidade anônima usa
   `inMemoryPersistence` e desaparece ao recarregar. Não há reconexão nem migração de anfitrião.
3. **Se o anfitrião cair, a sala pode não terminar.** Os participantes recebem um aviso claro.
4. **A lista de jogadores do lobby é legível por qualquer usuário autenticado que conheça o
   código da sala.** São apenas apelidos; o segredo real é o código. Papéis, votos e resultado
   continuam restritos aos membros.
5. **Sair da sala não devolve a vaga; remoção pelo anfitrião, sim.** Só o anfitrião pode
   decrementar `meta/playerCount` — se qualquer jogador pudesse, seria possível burlar o
   limite de lotação. O erro fica sempre no lado seguro: no máximo sobram vagas a menos.
6. **Não há limpeza automática de salas antigas.** Sem backend não existe coleta agendada
   confiável; o anfitrião encerra a sala ao final.
7. **Uma rodada por sala.** Para jogar de novo, crie uma sala nova.

## Publicação

`.github/workflows/ci.yml` roda lint, tipos, verificação das regras, testes unitários, testes
das regras com emulador, E2E mobile e build. `.github/workflows/deploy.yml` publica no GitHub
Pages **somente** se o CI passar inteiro.

Para habilitar: em **Settings → Pages**, defina a origem como **GitHub Actions**. A base do Vite
já está configurada como `/Spyclaudio/`.

## Fora do escopo desta versão

Contas permanentes, recuperação de partida, migração de anfitrião, partidas remotas com voz ou
chat, cronômetro de conversa, pontuação, histórico, várias rodadas na mesma sala, edição de
cenários no app, notificações, painel administrativo, internacionalização, Cloud Functions e
qualquer serviço pago.
