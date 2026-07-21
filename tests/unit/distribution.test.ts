import { describe, expect, it } from 'vitest';
import {
  assertValidDistribution,
  distribute,
  DistributionError,
  isValidPlayerCount,
  validatePlayerCount,
} from '../../src/game/distribution';
import { scenarios } from '../../src/data/scenarios';
import { CAPACITY, ROLES_PER_SCENARIO } from '../../src/game/types';
import type { SpyCount } from '../../src/game/types';

const ids = (count: number) => Array.from({ length: count }, (_, i) => `jogador-${i + 1}`);

describe('planilha importada', () => {
  it('tem 100 cenários com 7 papéis únicos cada', () => {
    expect(scenarios).toHaveLength(100);
    for (const scenario of scenarios) {
      expect(scenario.roles).toHaveLength(ROLES_PER_SCENARIO);
      expect(new Set(scenario.roles).size).toBe(ROLES_PER_SCENARIO);
      expect(scenario.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('não tem IDs nem cenários duplicados', () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    expect(new Set(scenarios.map((s) => s.name.toLowerCase())).size).toBe(scenarios.length);
  });
});

describe('limites de jogadores', () => {
  it('aceita apenas de 3 a 8 com 1 espião', () => {
    expect(isValidPlayerCount(2, 1)).toBe(false);
    expect(isValidPlayerCount(3, 1)).toBe(true);
    expect(isValidPlayerCount(8, 1)).toBe(true);
    expect(isValidPlayerCount(9, 1)).toBe(false);
  });

  it('aceita apenas de 4 a 9 com 2 espiões', () => {
    expect(isValidPlayerCount(3, 2)).toBe(false);
    expect(isValidPlayerCount(4, 2)).toBe(true);
    expect(isValidPlayerCount(9, 2)).toBe(true);
    expect(isValidPlayerCount(10, 2)).toBe(false);
  });

  it('nunca exige mais papéis do que os 7 disponíveis', () => {
    for (const spyCount of [1, 2] as SpyCount[]) {
      const max = CAPACITY[spyCount].max;
      expect(max - spyCount).toBeLessThanOrEqual(ROLES_PER_SCENARIO);
    }
  });

  it('explica o problema em português', () => {
    expect(validatePlayerCount(2, 1)).toMatch(/pelo menos 3/);
    expect(validatePlayerCount(9, 1)).toMatch(/limite é de 8/);
  });
});

describe('distribuição', () => {
  it('recusa quantidades fora dos limites', () => {
    expect(() => distribute(ids(2), 1, scenarios)).toThrow(DistributionError);
    expect(() => distribute(ids(10), 2, scenarios)).toThrow(DistributionError);
  });

  it('recusa jogadores duplicados', () => {
    expect(() => distribute(['a', 'a', 'b', 'c'], 1, scenarios)).toThrow(DistributionError);
  });

  it('mantém invariantes em milhares de sorteios', () => {
    for (const spyCount of [1, 2] as SpyCount[]) {
      const { min, max } = CAPACITY[spyCount];
      for (let count = min; count <= max; count += 1) {
        const playerIds = ids(count);
        for (let round = 0; round < 200; round += 1) {
          const distribution = distribute(playerIds, spyCount, scenarios);
          assertValidDistribution(distribution, playerIds, spyCount);
        }
      }
    }
  });

  it('não dá cenário nem papel ao espião', () => {
    for (let round = 0; round < 500; round += 1) {
      const playerIds = ids(6);
      const distribution = distribute(playerIds, 2, scenarios);
      const spies = distribution.assignments.filter((a) => a.isSpy);
      expect(spies).toHaveLength(2);
      for (const spy of spies) expect(spy.role).toBeNull();
    }
  });

  it('usa papéis do cenário sorteado, sem repetição', () => {
    for (let round = 0; round < 300; round += 1) {
      const playerIds = ids(8);
      const distribution = distribute(playerIds, 1, scenarios);
      const scenario = scenarios.find((item) => item.id === distribution.scenarioId);
      expect(scenario).toBeDefined();
      const roles = distribution.assignments.filter((a) => !a.isSpy).map((a) => a.role!);
      expect(new Set(roles).size).toBe(roles.length);
      for (const role of roles) expect(scenario!.roles).toContain(role);
    }
  });

  it('sorteia cenários variados', () => {
    const seen = new Set<number>();
    for (let round = 0; round < 500; round += 1) {
      seen.add(distribute(ids(4), 1, scenarios).scenarioId);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('distribui o papel de espião entre jogadores diferentes ao longo das rodadas', () => {
    const playerIds = ids(5);
    const spyCounts = new Map<string, number>();
    for (let round = 0; round < 500; round += 1) {
      for (const assignment of distribute(playerIds, 1, scenarios).assignments) {
        if (assignment.isSpy) spyCounts.set(assignment.playerId, (spyCounts.get(assignment.playerId) ?? 0) + 1);
      }
    }
    expect(spyCounts.size).toBe(playerIds.length);
  });
});
