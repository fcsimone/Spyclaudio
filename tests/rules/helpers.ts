import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'spyclaudio-b8252';
const HOST = process.env['DATABASE_EMULATOR_HOST'] ?? process.env['FIREBASE_DATABASE_EMULATOR_HOST'] ?? '127.0.0.1:9000';
const [host, port] = HOST.split(':');

export const HOST_UID = 'uid-anfitriao-000000000000001';
export const PLAYER_UID = 'uid-jogador-0000000000000002';
export const OTHER_UID = 'uid-jogador-0000000000000003';
export const OUTSIDER_UID = 'uid-forasteiro-000000000004';
export const ROOM = 'K7MQ3D';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      rules: readFileSync(resolve(__dirname, '../../database.rules.json'), 'utf8'),
      host: host ?? '127.0.0.1',
      port: Number(port ?? 9000),
    },
  });
}

/** Estado base: sala em lobby com anfitrião e um jogador. */
export async function seedLobby(env: RulesTestEnvironment, overrides: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.database().ref(`rooms/${ROOM}`).set({
      meta: {
        hostUid: HOST_UID,
        status: 'lobby',
        spyCount: 1,
        maxPlayers: 8,
        createdAt: Date.now(),
      },
      players: {
        [HOST_UID]: { name: 'Ana', normalizedName: 'ana', joinedAt: Date.now(), connected: true },
        [PLAYER_UID]: { name: 'Bia', normalizedName: 'bia', joinedAt: Date.now(), connected: true },
      },
      normalizedNames: { ana: HOST_UID, bia: PLAYER_UID },
      ...overrides,
    });
  });
}

/** Sala com papéis distribuídos: Bia é espiã, Ana é civil. */
export async function seedDistributed(env: RulesTestEnvironment) {
  await seedLobby(env, {
    meta: {
      hostUid: HOST_UID,
      status: 'distributed',
      spyCount: 1,
      maxPlayers: 8,
      createdAt: Date.now(),
    },
    secrets: {
      [HOST_UID]: { isSpy: false, scenarioId: 1, role: 'Piloto' },
      [PLAYER_UID]: { isSpy: true },
    },
  });
}

/** Sala em votação, com prazo válido. */
export async function seedVoting(env: RulesTestEnvironment, deadlineOffsetMs = 120_000) {
  await seedLobby(env, {
    meta: {
      hostUid: HOST_UID,
      status: 'voting',
      spyCount: 1,
      maxPlayers: 8,
      createdAt: Date.now(),
      votingStartedAt: Date.now(),
      votingDeadline: Date.now() + deadlineOffsetMs,
    },
    secrets: {
      [HOST_UID]: { isSpy: false, scenarioId: 1, role: 'Piloto' },
      [PLAYER_UID]: { isSpy: true },
    },
  });
}
