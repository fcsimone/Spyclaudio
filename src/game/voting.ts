/** Apuração da votação. Função pura: mesma entrada, mesmo resultado em todos os aparelhos. */

export interface Ballot {
  readonly voterId: string;
  readonly targetId: string;
  readonly submittedAt: number;
}

export interface TallyInput {
  /** Todos os participantes da sala. */
  readonly playerIds: readonly string[];
  /** Quem é espião (votos de espião são armazenados, mas desconsiderados). */
  readonly spyIds: readonly string[];
  readonly ballots: readonly Ballot[];
  /** Prazo em epoch ms; votos com submittedAt > deadline são descartados. */
  readonly deadline: number;
}

export interface TallyResult {
  /** Votos considerados válidos (dentro do prazo, de não-espiões, em alvos existentes). */
  readonly validBallots: readonly Ballot[];
  /** Votos armazenados porém desconsiderados, com o motivo. */
  readonly discardedBallots: readonly (Ballot & { reason: DiscardReason })[];
  /** Contagem por alvo, apenas de votos válidos. */
  readonly tallies: Readonly<Record<string, number>>;
  readonly validVoteCount: number;
  /** Quem não votou dentro do prazo. */
  readonly abstainedIds: readonly string[];
  /** Jogador escolhido; null em caso de empate ou zero votos válidos. */
  readonly selectedId: string | null;
  readonly tie: boolean;
}

export type DiscardReason = 'espião' | 'fora do prazo' | 'alvo inválido' | 'voto repetido';

export function tally(input: TallyInput): TallyResult {
  const players = new Set(input.playerIds);
  const spies = new Set(input.spyIds);

  const valid: Ballot[] = [];
  const discarded: (Ballot & { reason: DiscardReason })[] = [];
  const seenVoters = new Set<string>();

  // Ordem determinística: primeiro voto de cada eleitor prevalece.
  const ordered = [...input.ballots].sort(
    (a, b) => a.submittedAt - b.submittedAt || a.voterId.localeCompare(b.voterId),
  );

  for (const ballot of ordered) {
    if (!players.has(ballot.voterId)) continue; // voto de quem não está na sala é ignorado
    if (seenVoters.has(ballot.voterId)) {
      discarded.push({ ...ballot, reason: 'voto repetido' });
      continue;
    }
    seenVoters.add(ballot.voterId);

    if (ballot.submittedAt > input.deadline) {
      discarded.push({ ...ballot, reason: 'fora do prazo' });
      continue;
    }
    if (!players.has(ballot.targetId)) {
      discarded.push({ ...ballot, reason: 'alvo inválido' });
      continue;
    }
    if (spies.has(ballot.voterId)) {
      discarded.push({ ...ballot, reason: 'espião' });
      continue;
    }
    valid.push(ballot);
  }

  const tallies: Record<string, number> = {};
  for (const ballot of valid) {
    tallies[ballot.targetId] = (tallies[ballot.targetId] ?? 0) + 1;
  }

  const abstainedIds = input.playerIds.filter((id) => !seenVoters.has(id));

  let selectedId: string | null = null;
  let tie = false;
  const counts = Object.entries(tallies);
  if (counts.length > 0) {
    const max = Math.max(...counts.map(([, count]) => count));
    const leaders = counts.filter(([, count]) => count === max).map(([id]) => id);
    if (leaders.length === 1) {
      selectedId = leaders[0]!;
    } else {
      tie = true;
    }
  }

  return {
    validBallots: valid,
    discardedBallots: discarded,
    tallies,
    validVoteCount: valid.length,
    abstainedIds,
    selectedId,
    tie,
  };
}

/** A votação pode ser encerrada quando todos votaram ou o prazo expirou. */
export function shouldFinalize(params: {
  playerIds: readonly string[];
  votedIds: readonly string[];
  now: number;
  deadline: number;
}): boolean {
  if (params.now >= params.deadline) return true;
  const voted = new Set(params.votedIds);
  return params.playerIds.every((id) => voted.has(id));
}
