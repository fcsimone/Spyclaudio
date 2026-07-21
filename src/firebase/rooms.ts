import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import type { Unsubscribe } from 'firebase/database';
import { getFirebaseDatabase } from './client';
import { generateRoomCode } from '../game/roomCode';
import { normalizeName, sanitizeName } from '../game/names';
import { CAPACITY, VOTING_DURATION_MS } from '../game/types';
import type { RoomStatus, SpyCount } from '../game/types';
import { distribute } from '../game/distribution';
import { tally } from '../game/voting';
import type { Ballot } from '../game/voting';
import { scenarios } from '../data/scenarios';

export interface RoomMeta {
  hostUid: string;
  status: RoomStatus;
  spyCount: SpyCount;
  maxPlayers: number;
  createdAt: number;
  votingStartedAt?: number;
  votingDeadline?: number;
  closedReason?: string;
}

export interface RoomPlayer {
  name: string;
  normalizedName: string;
  joinedAt: number;
  connected?: boolean;
  hasVoted?: boolean;
}

export interface PlayerSecret {
  scenarioId?: number;
  role?: string;
  isSpy: boolean;
}

export interface PublicResult {
  scenarioId: number;
  assignments: Record<string, { role?: string; isSpy: boolean }>;
  ballots: Record<string, { targetUid: string; counted: boolean; reason?: string }>;
  tallies: Record<string, number>;
  validVoteCount: number;
  selectedUid: string | null;
  tie: boolean;
  abstained: Record<string, boolean>;
  finalizedAt: number;
}

export class RoomError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

const roomPath = (code: string) => `rooms/${code}`;

/** Cria a sala com código único e insere o anfitrião como jogador. */
export async function createRoom(params: {
  hostUid: string;
  hostName: string;
  spyCount: SpyCount;
}): Promise<string> {
  const db = getFirebaseDatabase();
  const name = sanitizeName(params.hostName);
  const normalizedName = normalizeName(name);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRoomCode();
    const metaRef = ref(db, `${roomPath(code)}/meta`);
    const existing = await get(metaRef);
    if (existing.exists()) continue;

    await set(metaRef, {
      hostUid: params.hostUid,
      status: 'lobby',
      spyCount: params.spyCount,
      maxPlayers: CAPACITY[params.spyCount].max,
      createdAt: serverTimestamp(),
    });

    await set(ref(db, `${roomPath(code)}/normalizedNames/${normalizedName}`), params.hostUid);
    await set(ref(db, `${roomPath(code)}/players/${params.hostUid}`), {
      name,
      normalizedName,
      joinedAt: serverTimestamp(),
      connected: true,
    });
    registerPresence(code, params.hostUid);
    return code;
  }
  throw new RoomError('codigo-indisponivel', 'Não foi possível gerar um código de sala. Tente novamente.');
}

/** Entrada de participante: reserva o nome de forma atômica e cria o registro. */
export async function joinRoom(params: {
  code: string;
  uid: string;
  name: string;
}): Promise<void> {
  const db = getFirebaseDatabase();
  const name = sanitizeName(params.name);
  const normalizedName = normalizeName(name);

  const metaSnapshot = await get(ref(db, `${roomPath(params.code)}/meta`));
  if (!metaSnapshot.exists()) {
    throw new RoomError('sala-inexistente', 'Sala não encontrada. Confira o código.');
  }
  const meta = metaSnapshot.val() as RoomMeta;
  if (meta.status !== 'lobby') {
    throw new RoomError('partida-iniciada', 'Esta partida já começou. Não é possível entrar agora.');
  }

  // A lista de jogadores só é legível por membros da sala, então a capacidade
  // é verificada pelas regras do banco no momento da escrita.

  // Reserva atômica do nome normalizado.
  const nameRef = ref(db, `${roomPath(params.code)}/normalizedNames/${normalizedName}`);
  const reservation = await runTransaction(nameRef, (current: string | null) =>
    current === null || current === params.uid ? params.uid : undefined,
  );
  if (!reservation.committed || reservation.snapshot.val() !== params.uid) {
    throw new RoomError('nome-em-uso', 'Este nome já está em uso nesta sala. Escolha outro.');
  }

  try {
    await set(ref(db, `${roomPath(params.code)}/players/${params.uid}`), {
      name,
      normalizedName,
      joinedAt: serverTimestamp(),
      connected: true,
    });
  } catch {
    await remove(nameRef).catch(() => undefined);
    throw new RoomError(
      'entrada-recusada',
      `Não foi possível entrar. A sala pode estar cheia (limite de ${meta.maxPlayers}) ou a partida já começou.`,
    );
  }
  registerPresence(params.code, params.uid);
}

/** Marca o jogador como desconectado se o navegador cair. */
export function registerPresence(code: string, uid: string): void {
  const db = getFirebaseDatabase();
  const connectedRef = ref(db, `${roomPath(code)}/players/${uid}/connected`);
  onDisconnect(connectedRef).set(false).catch(() => undefined);
}

/** Remoção de participante pelo anfitrião, antes do início. */
export async function removePlayer(code: string, uid: string, normalizedName: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `${roomPath(code)}/players/${uid}`));
  await remove(ref(db, `${roomPath(code)}/normalizedNames/${normalizedName}`));
}

export async function leaveRoom(code: string, uid: string, normalizedName: string): Promise<void> {
  await removePlayer(code, uid, normalizedName).catch(() => undefined);
}

export function subscribeMeta(code: string, callback: (meta: RoomMeta | null) => void): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(ref(db, `${roomPath(code)}/meta`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as RoomMeta) : null);
  });
}

export function subscribePlayers(
  code: string,
  callback: (players: Record<string, RoomPlayer>) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(ref(db, `${roomPath(code)}/players`), (snapshot) => {
    callback((snapshot.val() as Record<string, RoomPlayer> | null) ?? {});
  });
}

export function subscribeSecret(
  code: string,
  uid: string,
  callback: (secret: PlayerSecret | null) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(ref(db, `${roomPath(code)}/secrets/${uid}`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as PlayerSecret) : null);
  });
}

export function subscribeResult(
  code: string,
  callback: (result: PublicResult | null) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(ref(db, `${roomPath(code)}/result`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as PublicResult) : null);
  });
}

/** Sorteio feito pelo navegador do anfitrião (limitação aceita do plano Spark). */
export async function startGame(params: {
  code: string;
  spyCount: SpyCount;
  playerIds: readonly string[];
}): Promise<void> {
  const db = getFirebaseDatabase();
  const distribution = distribute(params.playerIds, params.spyCount, scenarios);

  const updates: Record<string, unknown> = {};
  for (const assignment of distribution.assignments) {
    updates[`secrets/${assignment.playerId}`] = assignment.isSpy
      ? { isSpy: true }
      : { isSpy: false, scenarioId: distribution.scenarioId, role: assignment.role };
  }
  await update(ref(db, roomPath(params.code)), updates);
  await set(ref(db, `${roomPath(params.code)}/meta/status`), 'distributed');
}

export async function startVoting(code: string): Promise<void> {
  const db = getFirebaseDatabase();
  // O horário de início vem do servidor; o prazo é derivado dele.
  const offsetSnapshot = await get(ref(db, '.info/serverTimeOffset'));
  const offset = (offsetSnapshot.val() as number | null) ?? 0;
  const deadline = Date.now() + offset + VOTING_DURATION_MS;

  await update(ref(db, `${roomPath(code)}/meta`), {
    votingStartedAt: serverTimestamp(),
    votingDeadline: deadline,
    status: 'voting',
  });
}

export async function submitVote(params: {
  code: string;
  uid: string;
  targetUid: string;
}): Promise<void> {
  const db = getFirebaseDatabase();
  await set(ref(db, `${roomPath(params.code)}/votes/${params.uid}`), {
    targetUid: params.targetUid,
    submittedAt: serverTimestamp(),
  });
  await set(ref(db, `${roomPath(params.code)}/players/${params.uid}/hasVoted`), true);
}

/** Apuração e publicação do resultado — somente o anfitrião. */
export async function finalizeRound(params: {
  code: string;
  playerIds: readonly string[];
  deadline: number;
}): Promise<void> {
  const db = getFirebaseDatabase();
  const [votesSnapshot, secretsSnapshot] = await Promise.all([
    get(ref(db, `${roomPath(params.code)}/votes`)),
    get(ref(db, `${roomPath(params.code)}/secrets`)),
  ]);

  const secrets = (secretsSnapshot.val() as Record<string, PlayerSecret> | null) ?? {};
  const spyIds = Object.entries(secrets)
    .filter(([, secret]) => secret.isSpy)
    .map(([uid]) => uid);
  const scenarioId =
    Object.values(secrets).find((secret) => typeof secret.scenarioId === 'number')?.scenarioId ?? 0;

  const rawVotes = (votesSnapshot.val() as Record<string, { targetUid: string; submittedAt: number }> | null) ?? {};
  const ballots: Ballot[] = Object.entries(rawVotes).map(([voterId, vote]) => ({
    voterId,
    targetId: vote.targetUid,
    submittedAt: vote.submittedAt,
  }));

  const outcome = tally({
    playerIds: params.playerIds,
    spyIds,
    ballots,
    deadline: params.deadline,
  });

  const assignments: PublicResult['assignments'] = {};
  for (const uid of params.playerIds) {
    const secret = secrets[uid];
    assignments[uid] = secret?.isSpy
      ? { isSpy: true }
      : { isSpy: false, ...(secret?.role ? { role: secret.role } : {}) };
  }

  const publicBallots: PublicResult['ballots'] = {};
  for (const ballot of outcome.validBallots) {
    publicBallots[ballot.voterId] = { targetUid: ballot.targetId, counted: true };
  }
  for (const ballot of outcome.discardedBallots) {
    publicBallots[ballot.voterId] = {
      targetUid: ballot.targetId,
      counted: false,
      reason: ballot.reason,
    };
  }

  const abstained: Record<string, boolean> = {};
  for (const uid of outcome.abstainedIds) abstained[uid] = true;

  const result = {
    scenarioId,
    assignments,
    ballots: publicBallots,
    tallies: outcome.tallies,
    validVoteCount: outcome.validVoteCount,
    selectedUid: outcome.selectedId,
    tie: outcome.tie,
    abstained,
    finalizedAt: serverTimestamp(),
  };

  await set(ref(db, `${roomPath(params.code)}/result`), result);
  await set(ref(db, `${roomPath(params.code)}/meta/status`), 'result');
}

export async function closeRoom(code: string, reason: string): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `${roomPath(code)}/meta`), { status: 'closed', closedReason: reason });
}

/** Melhor esforço de limpeza: sem backend não há coleta agendada confiável. */
export async function deleteRoom(code: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, roomPath(code))).catch(() => undefined);
}
