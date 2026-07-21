import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get, ref, remove } from 'firebase/database';
import { setDatabaseForTests } from '../../src/firebase/client';
import {
  createRoom,
  finalizeRound,
  joinRoom,
  removePlayer,
  RoomError,
  startGame,
  startVoting,
  submitVote,
} from '../../src/firebase/rooms';
import type { PlayerSecret, PublicResult, RoomPlayer } from '../../src/firebase/rooms';
import { createTestPlayer, destroyTestPlayers } from './players';
import type { TestPlayer } from './players';
import { getScenario } from '../../src/data/scenarios';

/**
 * Exercita o fluxo online real — o mesmo código que o app usa no navegador —
 * contra os emuladores. Cobre o que os testes E2E cobrem da parte online,
 * sem depender de navegador.
 */

let players: TestPlayer[] = [];

/** Executa uma ação do app agindo como um jogador específico. */
async function como<T>(player: TestPlayer, action: () => Promise<T>): Promise<T> {
  setDatabaseForTests(player.db);
  try {
    return await action();
  } finally {
    setDatabaseForTests(null);
  }
}

async function novoJogador(label: string): Promise<TestPlayer> {
  const player = await createTestPlayer(label);
  players.push(player);
  return player;
}

beforeEach(() => {
  players = [];
});

afterEach(async () => {
  const first = players[0];
  if (first) await remove(ref(first.db, 'rooms')).catch(() => undefined);
  await destroyTestPlayers(players);
  setDatabaseForTests(null);
});

describe('criação e entrada', () => {
  it('o anfitrião cria a sala e aparece como jogador', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );

    expect(code).toHaveLength(6);

    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();
    expect(meta.hostUid).toBe(host.uid);
    expect(meta.status).toBe('lobby');
    expect(meta.spyCount).toBe(1);
    expect(meta.maxPlayers).toBe(8);
    expect(meta.playerCount).toBe(1);

    const playersNode = (await get(ref(host.db, `rooms/${code}/players`))).val() as Record<
      string,
      RoomPlayer
    >;
    expect(Object.keys(playersNode)).toEqual([host.uid]);
    expect(playersNode[host.uid]?.name).toBe('Ana');
  });

  it('participantes entram pelo código e a contagem acompanha', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );

    for (const name of ['Bia', 'Caio']) {
      const player = await novoJogador(name);
      await como(player, () => joinRoom({ code, uid: player.uid, name }));
    }

    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();
    expect(meta.playerCount).toBe(3);

    const playersNode = (await get(ref(host.db, `rooms/${code}/players`))).val() as Record<
      string,
      RoomPlayer
    >;
    expect(Object.keys(playersNode)).toHaveLength(3);
  });

  it('recusa nome repetido, ignorando acento e caixa', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'João', spyCount: 1 }),
    );

    const intruso = await novoJogador('bia');
    await expect(
      como(intruso, () => joinRoom({ code, uid: intruso.uid, name: 'joao' })),
    ).rejects.toThrow(RoomError);

    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();
    expect(meta.playerCount).toBe(1);
  });

  it('recusa entrada em sala inexistente', async () => {
    const player = await novoJogador('ana');
    await expect(
      como(player, () => joinRoom({ code: 'XXXXXX', uid: player.uid, name: 'Ana' })),
    ).rejects.toThrow(/não encontrada/i);
  });

  it('recusa entrada depois que a partida começa', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );
    const bia = await novoJogador('bia');
    await como(bia, () => joinRoom({ code, uid: bia.uid, name: 'Bia' }));
    const caio = await novoJogador('caio');
    await como(caio, () => joinRoom({ code, uid: caio.uid, name: 'Caio' }));

    await como(host, () =>
      startGame({ code, spyCount: 1, playerIds: [host.uid, bia.uid, caio.uid] }),
    );

    const atrasado = await novoJogador('duda');
    await expect(
      como(atrasado, () => joinRoom({ code, uid: atrasado.uid, name: 'Duda' })),
    ).rejects.toThrow(/já começou/i);
  });

  it('o anfitrião remove um participante e devolve a vaga', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );
    const bia = await novoJogador('bia');
    await como(bia, () => joinRoom({ code, uid: bia.uid, name: 'Bia' }));

    await como(host, () => removePlayer(code, bia.uid, 'bia'));

    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();
    expect(meta.playerCount).toBe(1);
    const playersNode = (await get(ref(host.db, `rooms/${code}/players`))).val();
    expect(Object.keys(playersNode)).toEqual([host.uid]);
  });
});

describe('distribuição', () => {
  it('cada jogador lê só o próprio papel, e há exatamente 1 espião', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );
    const outros: TestPlayer[] = [];
    for (const name of ['Bia', 'Caio']) {
      const player = await novoJogador(name);
      await como(player, () => joinRoom({ code, uid: player.uid, name }));
      outros.push(player);
    }

    const todos = [host, ...outros];
    await como(host, () =>
      startGame({ code, spyCount: 1, playerIds: todos.map((p) => p.uid) }),
    );

    const secrets: PlayerSecret[] = [];
    for (const player of todos) {
      const own = await get(ref(player.db, `rooms/${code}/secrets/${player.uid}`));
      expect(own.exists()).toBe(true);
      secrets.push(own.val() as PlayerSecret);

      // Não consegue ler o segredo de ninguém mais.
      const alheio = todos.find((p) => p.uid !== player.uid)!;
      await expect(get(ref(player.db, `rooms/${code}/secrets/${alheio.uid}`))).rejects.toThrow();
      await expect(get(ref(player.db, `rooms/${code}/secrets`))).rejects.toThrow();
    }

    const espioes = secrets.filter((s) => s.isSpy);
    expect(espioes).toHaveLength(1);
    for (const spy of espioes) {
      expect(spy.role).toBeUndefined();
      expect(spy.scenarioId).toBeUndefined();
    }

    const civis = secrets.filter((s) => !s.isSpy);
    expect(new Set(civis.map((c) => c.role)).size).toBe(civis.length);
    const cenarios = new Set(civis.map((c) => c.scenarioId));
    expect(cenarios.size).toBe(1);
    const cenario = getScenario([...cenarios][0]!);
    for (const civil of civis) expect(cenario.roles).toContain(civil.role);
  });

  it('sorteia 2 espiões quando configurado', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 2 }),
    );
    const todos = [host];
    for (const name of ['Bia', 'Caio', 'Duda']) {
      const player = await novoJogador(name);
      await como(player, () => joinRoom({ code, uid: player.uid, name }));
      todos.push(player);
    }

    await como(host, () =>
      startGame({ code, spyCount: 2, playerIds: todos.map((p) => p.uid) }),
    );

    let espioes = 0;
    for (const player of todos) {
      const secret = (await get(ref(player.db, `rooms/${code}/secrets/${player.uid}`))).val() as PlayerSecret;
      if (secret.isSpy) espioes += 1;
    }
    expect(espioes).toBe(2);
  });
});

describe('votação e resultado', () => {
  it('roda a partida completa e publica o mesmo resultado para todos', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );
    const todos = [host];
    for (const name of ['Bia', 'Caio']) {
      const player = await novoJogador(name);
      await como(player, () => joinRoom({ code, uid: player.uid, name }));
      todos.push(player);
    }
    const ids = todos.map((p) => p.uid);

    await como(host, () => startGame({ code, spyCount: 1, playerIds: ids }));
    await como(host, () => startVoting(code));

    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();
    expect(meta.status).toBe('voting');
    expect(meta.votingDeadline).toBeGreaterThan(Date.now() - 5000);

    // Todos votam no mesmo alvo: o segundo jogador.
    const alvo = ids[1]!;
    for (const player of todos) {
      await como(player, () => submitVote({ code, uid: player.uid, targetUid: alvo }));
    }

    // Segundo voto é recusado pelas regras.
    await expect(
      como(host, () => submitVote({ code, uid: host.uid, targetUid: ids[2]! })),
    ).rejects.toThrow();

    await como(host, () =>
      finalizeRound({ code, playerIds: ids, deadline: meta.votingDeadline }),
    );

    for (const player of todos) {
      const result = (await get(ref(player.db, `rooms/${code}/result`))).val() as PublicResult;
      expect(result).toBeTruthy();
      expect(Object.keys(result.assignments).sort()).toEqual([...ids].sort());
      expect(result.scenarioId).toBeGreaterThan(0);

      const espioes = ids.filter((uid) => result.assignments[uid]?.isSpy);
      expect(espioes).toHaveLength(1);

      // O voto do espião é registrado, mas não conta.
      const espiao = espioes[0]!;
      expect(result.ballots[espiao]?.counted).toBe(false);
      expect(result.validVoteCount).toBe(espiao === alvo ? 2 : 2);
      expect(result.selectedUid).toBe(alvo);
    }

    const statusFinal = (await get(ref(host.db, `rooms/${code}/meta/status`))).val();
    expect(statusFinal).toBe('result');
  });

  it('empate não escolhe ninguém', async () => {
    const host = await novoJogador('ana');
    const code = await como(host, () =>
      createRoom({ hostUid: host.uid, hostName: 'Ana', spyCount: 1 }),
    );
    const todos = [host];
    for (const name of ['Bia', 'Caio', 'Duda']) {
      const player = await novoJogador(name);
      await como(player, () => joinRoom({ code, uid: player.uid, name }));
      todos.push(player);
    }
    const ids = todos.map((p) => p.uid);

    await como(host, () => startGame({ code, spyCount: 1, playerIds: ids }));

    // Descobre quem é o espião para montar um empate entre os votos válidos.
    const espiao = (
      await Promise.all(
        todos.map(async (player) => {
          const secret = (
            await get(ref(player.db, `rooms/${code}/secrets/${player.uid}`))
          ).val() as PlayerSecret;
          return secret.isSpy ? player : null;
        }),
      )
    ).find((p) => p !== null)!;

    const civis = todos.filter((p) => p.uid !== espiao.uid);
    await como(host, () => startVoting(code));
    const meta = (await get(ref(host.db, `rooms/${code}/meta`))).val();

    // Três civis votam em três alvos diferentes: empate de 1 a 1 a 1.
    await como(civis[0]!, () => submitVote({ code, uid: civis[0]!.uid, targetUid: ids[0]! }));
    await como(civis[1]!, () => submitVote({ code, uid: civis[1]!.uid, targetUid: ids[1]! }));
    await como(civis[2]!, () => submitVote({ code, uid: civis[2]!.uid, targetUid: ids[2]! }));

    await como(host, () =>
      finalizeRound({ code, playerIds: ids, deadline: meta.votingDeadline }),
    );

    const result = (await get(ref(host.db, `rooms/${code}/result`))).val() as PublicResult;
    expect(result.validVoteCount).toBe(3);
    expect(result.tie).toBe(true);
    expect(result.selectedUid ?? null).toBeNull();
    expect(result.abstained[espiao.uid]).toBe(true);
  });
});
