import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  createTestEnv,
  HOST_UID,
  OTHER_UID,
  OUTSIDER_UID,
  PLAYER_UID,
  ROOM,
  seedDistributed,
  seedLobby,
  seedVoting,
} from './helpers';

let env: RulesTestEnvironment;

const db = (uid: string | null) =>
  uid === null ? env.unauthenticatedContext().database() : env.authenticatedContext(uid).database();

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
});

describe('acesso básico', () => {
  it('nega tudo para quem não está autenticado', async () => {
    await seedLobby(env);
    await assertFails(db(null).ref(`rooms/${ROOM}/meta`).get());
    await assertFails(db(null).ref(`rooms/${ROOM}/players`).get());
    await assertFails(db(null).ref('rooms').get());
  });

  it('nega leitura da raiz mesmo autenticado', async () => {
    await seedLobby(env);
    await assertFails(db(PLAYER_UID).ref('/').get());
    await assertFails(db(PLAYER_UID).ref('rooms').get());
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}`).get());
  });

  it('usuário de fora não lê a sala', async () => {
    await seedDistributed(env);
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/players`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/secrets`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/secrets/${HOST_UID}`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/votes`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/result`).get());
  });

  it('membro lê a lista de jogadores; quem não é membro, não', async () => {
    await seedLobby(env);
    await assertSucceeds(db(PLAYER_UID).ref(`rooms/${ROOM}/players`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/players`).get());
  });

  it('meta é legível por qualquer autenticado, para validar o código da sala', async () => {
    await seedLobby(env);
    await assertSucceeds(db(OUTSIDER_UID).ref(`rooms/${ROOM}/meta`).get());
  });

  it('nega escrita em caminhos fora do modelo', async () => {
    await seedLobby(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/qualquerCoisa`).set({ a: 1 }));
    await assertFails(db(HOST_UID).ref('outraColecao/x').set(true));
  });
});

describe('criação de sala', () => {
  it('permite criar sala como anfitrião', async () => {
    await assertSucceeds(
      db(HOST_UID)
        .ref(`rooms/NOVASA/meta`)
        .set({
          hostUid: HOST_UID,
          status: 'lobby',
          spyCount: 1,
          maxPlayers: 8,
          createdAt: { '.sv': 'timestamp' },
          playerCount: 1,
        }),
    );
  });

  it('nega criar sala declarando outro anfitrião', async () => {
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/NOVASA/meta`)
        .set({
          hostUid: PLAYER_UID,
          status: 'lobby',
          spyCount: 1,
          maxPlayers: 8,
          createdAt: { '.sv': 'timestamp' },
          playerCount: 1,
        }),
    );
  });

  it('nega createdAt forjado', async () => {
    await assertFails(
      db(HOST_UID).ref(`rooms/NOVASA/meta`).set({
        hostUid: HOST_UID,
        status: 'lobby',
        spyCount: 1,
        maxPlayers: 8,
        createdAt: 12345,
        playerCount: 1,
      }),
    );
  });

  it('nega spyCount e maxPlayers inválidos', async () => {
    const base = {
      hostUid: HOST_UID,
      status: 'lobby',
      maxPlayers: 8,
      createdAt: { '.sv': 'timestamp' },
      playerCount: 1,
    };
    await assertFails(db(HOST_UID).ref(`rooms/NOVAS1/meta`).set({ ...base, spyCount: 3 }));
    await assertFails(
      db(HOST_UID).ref(`rooms/NOVAS2/meta`).set({ ...base, spyCount: 1, maxPlayers: 40 }),
    );
  });

  it('nega campos extras no meta', async () => {
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/NOVASA/meta`)
        .set({
          hostUid: HOST_UID,
          status: 'lobby',
          spyCount: 1,
          maxPlayers: 8,
          createdAt: { '.sv': 'timestamp' },
          playerCount: 1,
          segredo: 'Hospital',
        }),
    );
  });
});

describe('entrada de jogadores', () => {
  const entrada = (uid: string, name: string, normalized: string, playerCount: number) => ({
    [`players/${uid}`]: {
      name,
      normalizedName: normalized,
      joinedAt: { '.sv': 'timestamp' },
      connected: true,
    },
    'meta/playerCount': playerCount,
  });

  it('permite entrar reservando o nome e incrementando a contagem', async () => {
    await seedLobby(env);
    await assertSucceeds(db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID));
    await assertSucceeds(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 3)),
    );
  });

  it('nega entrar sem incrementar a contagem', async () => {
    await seedLobby(env);
    await db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID);
    await assertFails(
      db(OTHER_UID)
        .ref(`rooms/${ROOM}/players/${OTHER_UID}`)
        .set({
          name: 'Caio',
          normalizedName: 'caio',
          joinedAt: { '.sv': 'timestamp' },
          connected: true,
        }),
    );
  });

  it('nega incrementar a contagem em mais de 1 para entrar', async () => {
    await seedLobby(env);
    await db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID);
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 5)),
    );
  });

  it('nega que um jogador comum diminua a contagem', async () => {
    await seedLobby(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/meta/playerCount`).set(1));
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/meta/playerCount`).set(1));
  });

  it('nega registrar jogador sem reservar o nome antes', async () => {
    await seedLobby(env);
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 3)),
    );
  });

  it('nega roubar nome já reservado por outro', async () => {
    await seedLobby(env);
    await assertFails(db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/bia`).set(OTHER_UID));
  });

  it('nega criar registro em nome de outro jogador', async () => {
    await seedLobby(env);
    await assertFails(
      db(OTHER_UID)
        .ref(`rooms/${ROOM}/players/${OUTSIDER_UID}`)
        .set({
          name: 'Fake',
          normalizedName: 'fake',
          joinedAt: { '.sv': 'timestamp' },
        }),
    );
  });

  it('nega entrada depois que a partida começou', async () => {
    await seedDistributed(env);
    await assertFails(db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID));
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 3)),
    );
  });

  it('nega entrada quando a sala atinge a capacidade', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await context
        .database()
        .ref(`rooms/${ROOM}`)
        .set({
          meta: {
            hostUid: HOST_UID,
            status: 'lobby',
            spyCount: 1,
            maxPlayers: 8,
            createdAt: Date.now(),
            playerCount: 8,
          },
          players: {
            [HOST_UID]: { name: 'Ana', normalizedName: 'ana', joinedAt: Date.now() },
          },
          normalizedNames: { ana: HOST_UID },
        });
    });

    await assertSucceeds(db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID));
    // playerCount já está no limite: qualquer incremento é recusado.
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 9)),
    );
    // E entrar sem incrementar também é recusado.
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'Caio', 'caio', 8)),
    );
  });

  it('nega campos extras no registro do jogador', async () => {
    await seedLobby(env);
    await db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID);
    await assertFails(
      db(OTHER_UID)
        .ref(`rooms/${ROOM}`)
        .update({
          [`players/${OTHER_UID}`]: {
            name: 'Caio',
            normalizedName: 'caio',
            joinedAt: { '.sv': 'timestamp' },
            isSpy: false,
          },
          'meta/playerCount': 3,
        }),
    );
  });

  it('nega nome maior que o limite', async () => {
    await seedLobby(env);
    await db(OTHER_UID).ref(`rooms/${ROOM}/normalizedNames/caio`).set(OTHER_UID);
    await assertFails(
      db(OTHER_UID).ref(`rooms/${ROOM}`).update(entrada(OTHER_UID, 'C'.repeat(40), 'caio', 3)),
    );
  });
});

describe('controle do anfitrião', () => {
  it('permite ao anfitrião remover jogador no lobby', async () => {
    await seedLobby(env);
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/players/${PLAYER_UID}`).remove());
  });

  it('nega que jogador comum remova outro', async () => {
    await seedLobby(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/players/${HOST_UID}`).remove());
  });

  it('permite ao jogador sair da sala no lobby', async () => {
    await seedLobby(env);
    await assertSucceeds(db(PLAYER_UID).ref(`rooms/${ROOM}/players/${PLAYER_UID}`).remove());
    await assertSucceeds(db(PLAYER_UID).ref(`rooms/${ROOM}/normalizedNames/bia`).remove());
  });

  it('nega sair depois que a partida começou', async () => {
    await seedDistributed(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/players/${PLAYER_UID}`).remove());
  });

  it('nega que não anfitrião inicie a partida', async () => {
    await seedLobby(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/meta/status`).set('distributed'));
  });

  it('permite ao anfitrião iniciar a partida', async () => {
    await seedLobby(env);
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/meta/status`).set('distributed'));
  });

  it('nega retroceder o estado', async () => {
    await seedDistributed(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/meta/status`).set('lobby'));
  });

  it('nega pular direto para result', async () => {
    await seedDistributed(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/meta/status`).set('result'));
  });

  it('nega trocar o anfitrião', async () => {
    await seedLobby(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/meta/hostUid`).set(PLAYER_UID));
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/meta/hostUid`).set(PLAYER_UID));
  });
});

describe('segredos', () => {
  it('cada jogador lê apenas o próprio segredo', async () => {
    await seedDistributed(env);
    await assertSucceeds(db(PLAYER_UID).ref(`rooms/${ROOM}/secrets/${PLAYER_UID}`).get());
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/secrets/${HOST_UID}`).get());
  });

  it('nem o anfitrião lê o nó de segredos inteiro', async () => {
    await seedDistributed(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/secrets`).get());
  });

  it('jogador não escreve segredo — nem o próprio', async () => {
    await seedLobby(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/secrets/${PLAYER_UID}`).set({ isSpy: false }));
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/secrets/${HOST_UID}`).set({ isSpy: true }));
  });

  it('anfitrião grava segredos durante a distribuição', async () => {
    await seedLobby(env);
    await assertSucceeds(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/secrets/${PLAYER_UID}`)
        .set({ isSpy: false, scenarioId: 3, role: 'Enfermeiro' }),
    );
  });

  it('anfitrião não reescreve segredo já gravado', async () => {
    await seedDistributed(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/secrets/${PLAYER_UID}`).set({ isSpy: false }));
  });

  it('nega segredo para quem não está na sala', async () => {
    await seedLobby(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/secrets/${OUTSIDER_UID}`).set({ isSpy: true }));
  });

  it('nega campos extras no segredo', async () => {
    await seedLobby(env);
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/secrets/${PLAYER_UID}`)
        .set({ isSpy: false, role: 'Piloto', outroEspiao: HOST_UID }),
    );
  });
});

describe('votação', () => {
  it('permite votar durante o prazo', async () => {
    await seedVoting(env);
    await assertSucceeds(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('permite votar em si mesmo', async () => {
    await seedVoting(env);
    await assertSucceeds(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: HOST_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('nega votar por outro jogador', async () => {
    await seedVoting(env);
    await assertFails(
      db(PLAYER_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('nega segundo voto e alteração do voto', async () => {
    await seedVoting(env);
    await db(HOST_UID)
      .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
      .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } });

    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: HOST_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/votes/${HOST_UID}/targetUid`).set(HOST_UID));
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/votes/${HOST_UID}`).remove());
  });

  it('nega voto após o prazo', async () => {
    await seedVoting(env, -1000);
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('nega voto fora do estado de votação', async () => {
    await seedDistributed(env);
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('nega voto em alvo que não está na sala', async () => {
    await seedVoting(env);
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
        .set({ targetUid: OUTSIDER_UID, submittedAt: { '.sv': 'timestamp' } }),
    );
  });

  it('nega submittedAt forjado', async () => {
    await seedVoting(env);
    await assertFails(
      db(HOST_UID).ref(`rooms/${ROOM}/votes/${HOST_UID}`).set({ targetUid: PLAYER_UID, submittedAt: 1 }),
    );
  });

  it('esconde os votos alheios até o resultado', async () => {
    await seedVoting(env);
    await db(HOST_UID)
      .ref(`rooms/${ROOM}/votes/${HOST_UID}`)
      .set({ targetUid: PLAYER_UID, submittedAt: { '.sv': 'timestamp' } });

    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/votes`).get());
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/votes/${HOST_UID}`).get());
    // O anfitrião precisa ler para apurar.
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/votes`).get());
  });

  it('marca hasVoted apenas uma vez e apenas para si', async () => {
    await seedVoting(env);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/players/${PLAYER_UID}/hasVoted`).set(true));
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/players/${HOST_UID}/hasVoted`).set(true));
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/players/${HOST_UID}/hasVoted`).set(false));
  });
});

describe('resultado', () => {
  const validResult = {
    scenarioId: 1,
    assignments: {
      [HOST_UID]: { isSpy: false, role: 'Piloto' },
      [PLAYER_UID]: { isSpy: true },
    },
    ballots: { [HOST_UID]: { targetUid: PLAYER_UID, counted: true } },
    tallies: { [PLAYER_UID]: 1 },
    validVoteCount: 1,
    selectedUid: PLAYER_UID,
    tie: false,
    abstained: { [PLAYER_UID]: true },
    finalizedAt: { '.sv': 'timestamp' },
  };

  it('somente o anfitrião publica o resultado', async () => {
    await seedVoting(env);
    await assertFails(db(PLAYER_UID).ref(`rooms/${ROOM}/result`).set(validResult));
    await assertSucceeds(db(HOST_UID).ref(`rooms/${ROOM}/result`).set(validResult));
  });

  it('nega republicar o resultado', async () => {
    await seedVoting(env);
    await db(HOST_UID).ref(`rooms/${ROOM}/result`).set(validResult);
    await assertFails(db(HOST_UID).ref(`rooms/${ROOM}/result`).set(validResult));
  });

  it('nega resultado com campos extras', async () => {
    await seedVoting(env);
    await assertFails(
      db(HOST_UID).ref(`rooms/${ROOM}/result`).set({ ...validResult, mensagemOculta: 'x' }),
    );
  });

  it('nega atribuição para quem não está na sala', async () => {
    await seedVoting(env);
    await assertFails(
      db(HOST_UID)
        .ref(`rooms/${ROOM}/result`)
        .set({
          ...validResult,
          assignments: { ...validResult.assignments, [OUTSIDER_UID]: { isSpy: true } },
        }),
    );
  });

  it('só membros da sala leem o resultado', async () => {
    await seedVoting(env);
    await db(HOST_UID).ref(`rooms/${ROOM}/result`).set(validResult);
    await assertSucceeds(db(PLAYER_UID).ref(`rooms/${ROOM}/result`).get());
    await assertFails(db(OUTSIDER_UID).ref(`rooms/${ROOM}/result`).get());
  });
});
