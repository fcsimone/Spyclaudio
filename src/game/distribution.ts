import { CAPACITY, ROLES_PER_SCENARIO } from './types';
import type { Assignment, Distribution, Scenario, SpyCount } from './types';
import { cryptoRandom, pickOne, sample, shuffle } from './rng';
import type { RandomSource } from './rng';

export class DistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributionError';
  }
}

/** Valida a quantidade de participantes para a quantidade de espiões escolhida. */
export function validatePlayerCount(playerCount: number, spyCount: SpyCount): string | null {
  const { min, max } = CAPACITY[spyCount];
  if (playerCount < min) {
    return `Com ${spyCount} ${spyCount === 1 ? 'espião' : 'espiões'} são necessários pelo menos ${min} jogadores.`;
  }
  if (playerCount > max) {
    return `Com ${spyCount} ${spyCount === 1 ? 'espião' : 'espiões'} o limite é de ${max} jogadores.`;
  }
  const nonSpies = playerCount - spyCount;
  if (nonSpies > ROLES_PER_SCENARIO) {
    return `Cada cenário tem apenas ${ROLES_PER_SCENARIO} papéis; reduza o número de jogadores.`;
  }
  return null;
}

export function isValidPlayerCount(playerCount: number, spyCount: SpyCount): boolean {
  return validatePlayerCount(playerCount, spyCount) === null;
}

/**
 * Sorteia cenário, espiões e papéis únicos.
 * - exatamente `spyCount` espiões;
 * - papéis distintos entre os não-espiões;
 * - espiões não recebem papel nem cenário (o cenário fica fora da atribuição do espião).
 */
export function distribute(
  playerIds: readonly string[],
  spyCount: SpyCount,
  scenarios: readonly Scenario[],
  random: RandomSource = cryptoRandom,
): Distribution {
  const unique = new Set(playerIds);
  if (unique.size !== playerIds.length) {
    throw new DistributionError('Há jogadores duplicados na distribuição.');
  }
  const problem = validatePlayerCount(playerIds.length, spyCount);
  if (problem) throw new DistributionError(problem);
  if (scenarios.length === 0) throw new DistributionError('Nenhum cenário disponível.');

  const scenario = pickOne(scenarios, random);
  if (scenario.roles.length !== ROLES_PER_SCENARIO) {
    throw new DistributionError(
      `Cenário "${scenario.name}" tem ${scenario.roles.length} papéis; esperado ${ROLES_PER_SCENARIO}.`,
    );
  }

  const spies = new Set(sample(playerIds, spyCount, random));
  const civilians = playerIds.filter((id) => !spies.has(id));
  const roles = shuffle(scenario.roles, random).slice(0, civilians.length);

  if (roles.length !== civilians.length) {
    throw new DistributionError('Papéis insuficientes para os jogadores não-espiões.');
  }

  const assignments: Assignment[] = playerIds.map((playerId) => {
    if (spies.has(playerId)) {
      return { playerId, isSpy: true, role: null };
    }
    const index = civilians.indexOf(playerId);
    return { playerId, isSpy: false, role: roles[index]! };
  });

  return { scenarioId: scenario.id, assignments };
}

/** Verificação de sanidade usada em testes e como guarda em runtime. */
export function assertValidDistribution(
  distribution: Distribution,
  playerIds: readonly string[],
  spyCount: SpyCount,
): void {
  const { assignments } = distribution;
  if (assignments.length !== playerIds.length) {
    throw new DistributionError('Quantidade de atribuições diferente da quantidade de jogadores.');
  }
  const ids = new Set(assignments.map((a) => a.playerId));
  if (ids.size !== playerIds.length) throw new DistributionError('Atribuições duplicadas.');
  for (const id of playerIds) {
    if (!ids.has(id)) throw new DistributionError(`Jogador sem atribuição: ${id}`);
  }
  const spies = assignments.filter((a) => a.isSpy);
  if (spies.length !== spyCount) {
    throw new DistributionError(`Esperado ${spyCount} espiões; obtido ${spies.length}.`);
  }
  if (spies.some((a) => a.role !== null)) {
    throw new DistributionError('Espião não pode receber papel.');
  }
  const civilianRoles = assignments.filter((a) => !a.isSpy).map((a) => a.role);
  if (civilianRoles.some((role) => role === null || role === '')) {
    throw new DistributionError('Jogador não-espião sem papel.');
  }
  if (new Set(civilianRoles).size !== civilianRoles.length) {
    throw new DistributionError('Papéis repetidos entre jogadores.');
  }
}
