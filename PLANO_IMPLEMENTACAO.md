# Spycai — Plano de implementação do MVP

## 1. Objetivo deste documento

Este arquivo é o briefing técnico e funcional para uma futura tarefa do Codex implementar o **Spycai**, um jogo inspirado em Spyfall para navegador, otimizado para celulares e destinado a partidas presenciais.

A tarefa futura deve implementar o projeto integralmente, testar, configurar Firebase e GitHub Pages e entregar o app publicado. Este documento não autoriza trocar serviços, adicionar funcionalidades fora do MVP ou contratar planos pagos.

## 2. Contexto já confirmado

- Repositório público: `https://github.com/fcsimone/Spycai.git`
- Branch principal: `main`
- O repositório remoto estava vazio quando este plano foi preparado.
- Fonte de conteúdo: `Papeis.xlsx`
- A planilha contém 100 cenários, cada um com 7 papéis.
- Firebase Project ID: `spycai`
- Realtime Database URL: `https://spycai-default-rtdb.firebaseio.com/`
- Firebase Authentication anônimo foi escolhido para identificar temporariamente cada navegador.
- Usar exclusivamente o plano gratuito Firebase Spark.
- Não associar faturamento e não migrar para Blaze.
- Frontend publicado gratuitamente no GitHub Pages.
- Idioma: português do Brasil.
- Nome público: **Spycai**.
- Aparência inicial: discreta, limpa e mobile-first.

## 3. Decisão técnica aceita

No plano Spark não haverá backend confiável com Cloud Functions. Portanto:

- no modo com vários celulares, o navegador do anfitrião fará o sorteio;
- o anfitrião tecnicamente poderá inspecionar as atribuições usando ferramentas de desenvolvimento;
- esse risco foi explicitamente aceito para o MVP;
- o Firebase Realtime Database fará sincronização, autenticação e controle de acesso;
- o navegador do anfitrião também calculará e publicará o resultado da votação;
- se o anfitrião perder a conexão, a sala poderá ser encerrada ou ficar sem conseguir finalizar; não implementar migração de anfitrião no MVP.

Não introduzir Cloudflare, Supabase, servidor próprio ou Firebase Blaze nesta versão.

## 4. Stack obrigatória

- React
- TypeScript com modo estrito
- Vite
- Firebase JavaScript SDK modular
- Firebase Authentication anônimo
- Firebase Realtime Database
- Firebase Local Emulator Suite para desenvolvimento e testes
- Vitest para testes unitários
- `@firebase/rules-unit-testing` para regras do banco
- Playwright para os fluxos essenciais em navegador mobile
- GitHub Actions para validação e publicação no GitHub Pages
- CSS próprio ou CSS Modules; evitar framework visual pesado no MVP

Escolher uma versão LTS de Node compatível com Vite e Firebase CLI. Fixar a versão em `.nvmrc` e no workflow.

## 5. Escopo funcional

### 5.1 Tela inicial

Exibir duas opções:

1. **Um aparelho**
2. **Vários aparelhos**

Também exibir acesso curto às regras e à política de privacidade simplificada.

### 5.2 Modo “Um aparelho”

Este modo não usa Firebase para a partida.

Fluxo:

1. Cadastrar os nomes de todos os jogadores.
2. Escolher 1 ou 2 espiões.
3. Validar a quantidade de participantes.
4. Sortear cenário, espiões e papéis localmente.
5. Exibir uma tela neutra instruindo a passar o aparelho.
6. Cada jogador confirma seu nome, mantém pressionado ou toca para revelar e depois oculta seu papel.
7. Um espião vê apenas que é espião; não vê cenário nem o outro espião.
8. Após todos visualizarem, mostrar somente que a rodada pode começar.
9. Não implementar votação neste modo.

Não guardar os papéis em `localStorage`, logs ou URLs.

### 5.3 Modo “Vários aparelhos”

#### Criação da sala

1. O anfitrião informa seu nome.
2. Escolhe 1 ou 2 espiões.
3. O app cria uma sala com código curto, não ambíguo e resistente a colisões.
4. Mostrar o código e um QR Code com a URL de entrada.
5. O anfitrião também aparece como jogador.

#### Entrada de jogadores

1. O participante acessa por QR Code ou digita o código.
2. Informa um nome anônimo.
3. Nomes precisam ser únicos dentro da sala, comparados sem distinguir maiúsculas, espaços extras ou acentos quando possível.
4. A entrada só é permitida enquanto a sala estiver no lobby.
5. O anfitrião pode remover participantes antes de iniciar.
6. A sala deve mostrar a ocupação atual e o limite.

#### Capacidade

- Com 1 espião: mínimo de 3 e máximo de 8 participantes.
- Com 2 espiões: mínimo de 4 e máximo de 9 participantes.
- Existem 7 papéis por cenário; não repetir papel.
- Impedir o início fora dos limites.
- Impedir novas entradas quando a sala atingir o limite ou a partida começar.

#### Distribuição

1. Somente o anfitrião inicia.
2. O navegador do anfitrião escolhe um cenário aleatório.
3. Sorteia 1 ou 2 espiões conforme a configuração.
4. Distribui papéis únicos aos demais jogadores.
5. Grava a atribuição de cada jogador em um caminho privado no Realtime Database.
6. Cada jogador pode ler apenas a própria atribuição.
7. O estado público nunca contém cenário, papel ou indicação de espião antes do resultado.
8. Os espiões não sabem quem é o outro.

#### Conversa

- Não há cronômetro para a conversa.
- O anfitrião decide quando iniciar a votação.

### 5.4 Votação — somente vários aparelhos

1. O anfitrião inicia a votação.
2. O Firebase registra o horário usando timestamp do servidor.
3. O prazo é de 3 minutos.
4. Cada jogador pode escolher qualquer participante, inclusive a si mesmo.
5. O voto é definitivo e não pode ser alterado.
6. O espião recebe exatamente a mesma interface e a mesma confirmação.
7. O voto do espião é armazenado, mas não entra na contagem válida.
8. Durante a votação, todos podem ver quem já votou, mas não o conteúdo dos votos.
9. O resultado é publicado quando todos votarem ou quando o prazo terminar.
10. Quem não votar até o prazo fica fora do pool de votos.
11. Votos enviados depois do prazo devem ser recusados pelas regras do banco.
12. Se houver empate na maior quantidade de votos válidos, ninguém é considerado escolhido.
13. Não há segunda votação.

Como não há função de servidor no Spark, o anfitrião agenda a finalização no navegador. Usar também eventos de visibilidade/foco para finalizar assim que o navegador voltar caso o timer tenha sido postergado. As regras devem impedir votos tardios mesmo se a tela de resultado atrasar.

### 5.5 Resultado público

Depois da finalização, todos os aparelhos devem mostrar o mesmo resultado:

- cenário sorteado;
- lista completa de jogadores e respectivos papéis;
- todos os espiões;
- destaque visual do espião identificado, se o jogador escolhido for espião;
- lista pública “Jogador A votou em Jogador B”;
- votos de espiões marcados como “desconsiderado”;
- jogadores que não votaram;
- total de votos válidos;
- indicação de empate ou de ausência de votos, quando aplicável.

Com dois espiões, revelar ambos no resultado. Em uma votação só haverá no máximo um escolhido; se houver empate, nenhum será identificado.

## 6. Comportamentos deliberadamente fora do MVP

- Contas permanentes.
- Recuperação da partida após recarregar ou fechar a página.
- Migração de anfitrião.
- Partidas remotas com voz ou chat.
- Cronômetro para conversa.
- Pontuação ou histórico.
- Várias rodadas dentro da mesma sala.
- Criação e edição de cenários no app.
- Importação de planilhas pelo usuário final.
- Notificações push.
- Painel administrativo.
- Internacionalização.
- Cloud Functions.
- Qualquer serviço pago.

## 7. Persistência e ausência de reconexão

- Configurar Firebase Auth com `inMemoryPersistence` antes de `signInAnonymously`.
- A identidade anônima deve desaparecer ao recarregar a página.
- Não armazenar UID, token de sala ou segredo em `localStorage` ou `sessionStorage`.
- Se a página for recarregada durante uma partida, exibir mensagem informando que não é possível retornar nesta versão.
- Usar `onDisconnect` para marcar o jogador como desconectado.
- Se o anfitrião desconectar, informar os participantes de que a sala foi interrompida.
- Expirar e remover salas antigas quando possível pelo cliente anfitrião; documentar que não existe limpeza agendada confiável sem backend.

## 8. Modelo sugerido no Realtime Database

O formato exato pode ser refinado, mas deve separar dados públicos, privados e votos:

```text
rooms/{roomCode}/
  meta/
    hostUid
    status
    spyCount
    maxPlayers
    createdAt
    votingStartedAt
    votingDeadline
  players/{uid}/
    name
    normalizedName
    joinedAt
    connected
    hasVoted
  normalizedNames/{normalizedName}/
    uid
  secrets/{uid}/
    scenarioId
    role
    isSpy
  votes/{uid}/
    targetUid
    submittedAt
  result/
    scenarioId
    assignments
    spies
    ballots
    validTallies
    selectedUid
    tie
    finalizedAt
```

Estados permitidos:

```text
lobby -> distributed -> voting -> result -> closed
```

Transições devem ser monotônicas. Não permitir voltar a um estado anterior.

## 9. Regras de segurança do Firebase

Criar `database.rules.json` e testes automatizados. Requisitos mínimos:

- negar tudo por padrão;
- exigir `auth != null`;
- permitir criação de sala somente quando `hostUid == auth.uid`;
- permitir que um participante crie e altere somente seu próprio registro nos casos previstos;
- limitar o número de jogadores conforme `maxPlayers`;
- impedir entrada depois do lobby;
- impedir nomes duplicados usando `normalizedNames` e operação atômica;
- permitir ao anfitrião escrever configurações e iniciar a partida;
- permitir escrita de cada segredo somente pelo anfitrião e apenas durante a distribuição;
- permitir leitura de `secrets/{uid}` somente quando `auth.uid == uid`;
- permitir que cada jogador escreva apenas o próprio voto;
- exigir que o alvo exista na sala;
- impedir segundo voto ou alteração do voto;
- recusar voto quando `now > votingDeadline`;
- ocultar votos alheios até o estado `result`, exceto para o anfitrião, que precisa calcular;
- permitir leitura do resultado apenas para membros da sala;
- validar tipos, comprimentos máximos e campos esperados;
- impedir que clientes escrevam campos adicionais;
- testar explicitamente acessos negados.

Nunca usar regras de teste abertas.

## 10. Conteúdo da planilha

Manter `Papeis.xlsx` como fonte editorial do projeto.

Criar um script versionado que converta a planilha para JSON no build ou em comando dedicado. O script deve falhar se encontrar:

- cabeçalhos inesperados;
- ID ausente ou duplicado;
- cenário vazio ou duplicado;
- quantidade diferente de 7 papéis;
- papel vazio;
- papel duplicado dentro do mesmo cenário;
- menos ou mais de 100 linhas na versão inicial.

Gerar um arquivo tipado, por exemplo `src/data/scenarios.generated.json`. Não editar o JSON manualmente.

## 11. Regras de aleatoriedade

- Usar `crypto.getRandomValues`, nunca `Math.random`, para o sorteio.
- Implementar Fisher–Yates usando fonte criptográfica.
- Separar o motor do jogo da interface.
- Garantir papéis únicos.
- Garantir exatamente a quantidade configurada de espiões.
- Não repetir participantes nem atribuições.

## 12. UX e aparência

- Mobile-first, funcionando a partir de 320 px de largura.
- Visual discreto: fundo neutro, alto contraste e poucas cores.
- Tipografia legível e controles grandes para toque.
- Não mostrar conteúdo secreto em notificações, títulos da página ou logs.
- Antes de revelar o papel, usar uma tela neutra que possa ser vista por terceiros.
- Incluir confirmação clara depois do voto definitivo.
- Desabilitar duplo toque e submissão duplicada.
- Respeitar `prefers-reduced-motion`.
- Garantir navegação básica por teclado e leitores de tela.
- Mensagens e erros sempre em português brasileiro.

## 13. Estrutura sugerida

```text
Spycai/
  src/
    app/
    components/
    screens/
    game/
    firebase/
    data/
    styles/
  scripts/
    import-papeis.ts
  tests/
    unit/
    rules/
    e2e/
  public/
  Papeis.xlsx
  database.rules.json
  firebase.json
  .firebaserc
  .env.example
  vite.config.ts
  README.md
```

Evitar abstrações prematuras. Manter lógica de domínio pura e testável.

## 14. Configuração Firebase para a tarefa futura

O Codex deve:

1. Instalar `firebase-tools` como dependência de desenvolvimento, não globalmente.
2. Solicitar ao usuário apenas a conclusão do login interativo quando necessário.
3. Confirmar acesso com `firebase projects:list`.
4. Associar o repositório ao projeto `spycai`.
5. Descobrir o Web App existente com a CLI.
6. Obter a configuração pública do SDK com a CLI quando possível.
7. Nunca solicitar ou gerar chave privada de Service Account.
8. Nunca commitar token do Firebase CLI.
9. Configurar e usar os emuladores durante o desenvolvimento.
10. Publicar somente as regras do Realtime Database no Firebase.

Dados conhecidos:

```text
projectId=spycai
databaseURL=https://spycai-default-rtdb.firebaseio.com/
```

Ainda será necessário obter do Web App os valores públicos como `apiKey`, `authDomain` e `appId`. Esses valores não são segredos, mas devem ser obtidos pela CLI ou pelo console, sem usar credenciais administrativas.

## 15. Configuração GitHub

- Repositório: `fcsimone/Spycai`.
- Publicar o frontend no GitHub Pages.
- Configurar Vite com base `/Spycai/`.
- Criar workflow que execute instalação limpa, lint, typecheck, testes e build antes do deploy.
- Não publicar se alguma verificação falhar.
- Não colocar tokens, credenciais administrativas ou arquivos locais no repositório.
- O frontend pode conter a configuração pública do Firebase Web SDK.

URL esperada:

```text
https://fcsimone.github.io/Spycai/
```

## 16. Plano de execução em fases

### Fase 0 — Preparação segura

- Inspecionar arquivos e estado do Git antes de alterar.
- Se a pasta ainda não for um repositório, inicializá-la com branch `main` e associar o remoto.
- Preservar `Papeis.xlsx`.
- Criar README inicial, `.gitignore`, estrutura e comandos.
- Autenticar Firebase CLI de forma interativa.
- Confirmar que o plano continua Spark.

### Fase 1 — Fundação do frontend

- Criar React + TypeScript + Vite.
- Configurar lint, typecheck, Vitest e Playwright.
- Criar sistema visual mínimo e rotas/telas.
- Configurar o SDK Firebase e os emuladores.

### Fase 2 — Conteúdo e motor do jogo

- Criar conversor Excel -> JSON.
- Implementar tipos e validações.
- Implementar sorteio seguro.
- Cobrir distribuição com testes unitários.

### Fase 3 — Modo de um aparelho

- Implementar cadastro, validação, revelação sequencial e encerramento.
- Testar proteção visual e fluxo completo.

### Fase 4 — Lobby online

- Implementar autenticação anônima em memória.
- Criar/entrar/remover jogador.
- Gerar código e QR Code.
- Implementar presença e desconexão.
- Criar regras e testes do lobby.

### Fase 5 — Distribuição online

- Implementar sorteio pelo anfitrião.
- Gravar segredos individualmente.
- Garantir leitura privada com regras e testes.
- Implementar tela de papel de cada jogador.

### Fase 6 — Votação

- Implementar início, deadline, voto imutável e sinalização de participação.
- Excluir votos dos espiões no cálculo.
- Implementar finalização antecipada e por prazo.
- Implementar empate sem escolhido.
- Cobrir todos os casos com testes.

### Fase 7 — Resultado e robustez

- Implementar resultado público idêntico em todos os dispositivos.
- Revelar cenário, papéis, espiões e votos.
- Tratar desconexões, sala lotada e erros de permissão.

### Fase 8 — QA e publicação

- Executar lint, typecheck, testes unitários, regras e E2E.
- Testar Android/Chrome, iPhone/Safari e viewport de 320 px.
- Verificar que segredos não aparecem no snapshot público.
- Publicar regras Firebase.
- Configurar GitHub Pages e workflow.
- Validar a URL pública em navegador real.
- Atualizar README com operação, limites e manutenção.

## 17. Testes obrigatórios

### Motor do jogo

- 1 e 2 espiões exatamente.
- 7 papéis únicos.
- limites de jogadores.
- distribuição sem duplicatas.
- espiões sem cenário e sem conhecer um ao outro.
- repetição de milhares de sorteios sem estado inválido.

### Votação

- voto em si mesmo permitido;
- segundo voto negado;
- alteração negada;
- voto tardio negado;
- voto de espião armazenado e desconsiderado;
- não votante fora do pool;
- encerramento quando todos votam;
- encerramento no prazo;
- empate resulta em ninguém escolhido;
- zero votos resulta em ninguém escolhido;
- todos os espiões revelados no resultado;
- somente o espião escolhido recebe destaque de identificado.

### Segurança

- usuário de fora não lê sala;
- jogador não lê segredo alheio;
- jogador não escreve segredo;
- não anfitrião não inicia partida;
- não anfitrião não publica resultado;
- jogador não vota por outro;
- participante não entra após início;
- sala não ultrapassa capacidade;
- campos extras e payloads inválidos são rejeitados.

### E2E

- partida completa em um aparelho;
- anfitrião + participantes em múltiplas páginas;
- entrada por código;
- QR Code contém URL correta;
- distribuição privada;
- votação completa;
- votação com timeout;
- empate;
- dois espiões;
- recarga perde acesso conforme especificado;
- desconexão do anfitrião mostra erro claro.

## 18. Critérios de aceite do MVP

O trabalho só estará concluído quando:

- os 100 cenários da planilha forem importados e validados;
- os dois modos funcionarem em telas mobile;
- a sala respeitar os limites de 8 ou 9 participantes;
- cada jogador visualizar somente seu papel durante a partida;
- o voto for único, definitivo e protegido por regras;
- votos de espiões não entrarem na contagem;
- empate não escolher ninguém;
- o resultado revelar cenário, papéis, votos e todos os espiões;
- testes de regras provarem que segredos alheios são inacessíveis;
- nenhuma credencial privada estiver no Git;
- o plano Firebase continuar Spark;
- as regras estiverem publicadas no projeto `spycai`;
- o frontend estiver disponível no GitHub Pages;
- o README explicar execução local, emuladores, testes, publicação e limitações.

## 19. Forma de trabalho esperada do Codex

- Trabalhar autonomamente até cumprir os critérios de aceite.
- Fazer suposições pequenas e reversíveis quando necessário e documentá-las.
- Parar apenas para autenticação interativa, aprovação de publicação ou decisão que altere materialmente o produto.
- Não pedir ao usuário tarefas que o Codex possa executar com segurança.
- Não sobrescrever mudanças do usuário.
- Criar commits pequenos e temáticos.
- Executar validações após cada fase relevante.
- Não afirmar conclusão sem testar o app publicado.

Commits sugeridos:

```text
chore: initialize Spycai web app
feat: import and validate game scenarios
feat: implement shared-device mode
feat: add Firebase multiplayer lobby
feat: distribute private player roles
feat: implement synchronized voting
feat: reveal public round results
test: cover Firebase rules and mobile flows
ci: deploy Spycai to GitHub Pages
```

## 20. Prompt sugerido para a nova tarefa

Use este prompt em uma nova tarefa do Codex apontada para o repositório:

```text
Implemente integralmente o MVP descrito em PLANO_IMPLEMENTACAO.md.

Trabalhe com autonomia até cumprir todos os critérios de aceite. Preserve a
planilha Papeis.xlsx como fonte do conteúdo. Use somente Firebase Spark e GitHub
Pages, sem serviços pagos. Nunca crie ou solicite chave privada de Service
Account. Quando for necessário autenticar Firebase ou aprovar uma publicação,
peça apenas essa intervenção específica. Antes de cada publicação, execute lint,
typecheck, testes unitários, testes das regras, E2E e build. Ao final, valide o
site publicado e entregue os links, os testes executados e as limitações restantes.
```
