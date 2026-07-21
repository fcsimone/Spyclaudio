import generated from './scenarios.generated.json';
import { ROLES_PER_SCENARIO } from '../game/types';
import type { Scenario } from '../game/types';

interface GeneratedFile {
  readonly rolesPerScenario: number;
  readonly scenarios: readonly { id: number; name: string; roles: string[] }[];
}

const file = generated as GeneratedFile;

if (file.rolesPerScenario !== ROLES_PER_SCENARIO) {
  throw new Error(
    `scenarios.generated.json declara ${file.rolesPerScenario} papéis por cenário; esperado ${ROLES_PER_SCENARIO}.`,
  );
}

export const scenarios: readonly Scenario[] = file.scenarios.map((scenario) => ({
  id: scenario.id,
  name: scenario.name,
  roles: Object.freeze([...scenario.roles]),
}));

const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

export function getScenario(id: number): Scenario {
  const scenario = byId.get(id);
  if (!scenario) throw new Error(`Cenário desconhecido: ${id}`);
  return scenario;
}
