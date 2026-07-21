#!/usr/bin/env node
/**
 * Converte Papeis.xlsx em src/data/scenarios.generated.json.
 * Falha (exit 1) diante de qualquer inconsistência editorial.
 * Não edite o JSON gerado manualmente.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'Papeis.xlsx');
const TARGET = resolve(ROOT, 'src/data/scenarios.generated.json');

const ROLES_PER_SCENARIO = 7;
const EXPECTED_ROWS = 100;
const EXPECTED_HEADERS = [
  'ID',
  'Cenário',
  ...Array.from({ length: ROLES_PER_SCENARIO }, (_, i) => `Papel ${i + 1}`),
];

const errors = [];
const fail = (msg) => errors.push(msg);

if (!existsSync(SOURCE)) {
  console.error(`[import-papeis] Planilha não encontrada: ${SOURCE}`);
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(SOURCE), { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });

if (rows.length === 0) {
  console.error('[import-papeis] Planilha vazia.');
  process.exit(1);
}

const headers = rows[0].map((h) => String(h).trim());
if (headers.length !== EXPECTED_HEADERS.length) {
  fail(
    `Cabeçalho com ${headers.length} colunas; esperado ${EXPECTED_HEADERS.length}: ${EXPECTED_HEADERS.join(', ')}`,
  );
} else {
  EXPECTED_HEADERS.forEach((expected, index) => {
    if (headers[index] !== expected) {
      fail(`Cabeçalho inesperado na coluna ${index + 1}: "${headers[index]}" (esperado "${expected}")`);
    }
  });
}

const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== ''));

if (dataRows.length !== EXPECTED_ROWS) {
  fail(`A planilha tem ${dataRows.length} cenários; esperado exatamente ${EXPECTED_ROWS}.`);
}

const seenIds = new Set();
const seenScenarios = new Set();
const scenarios = [];

dataRows.forEach((row, index) => {
  const line = index + 2; // 1-based + cabeçalho
  const rawId = String(row[0] ?? '').trim();
  const name = String(row[1] ?? '').trim();

  if (rawId === '') fail(`Linha ${line}: ID ausente.`);
  const id = Number(rawId);
  if (rawId !== '' && (!Number.isInteger(id) || id <= 0)) {
    fail(`Linha ${line}: ID inválido ("${rawId}"). Use um inteiro positivo.`);
  }
  if (seenIds.has(id)) fail(`Linha ${line}: ID duplicado (${id}).`);
  seenIds.add(id);

  if (name === '') fail(`Linha ${line}: cenário vazio.`);
  const nameKey = name.toLocaleLowerCase('pt-BR');
  if (name !== '' && seenScenarios.has(nameKey)) fail(`Linha ${line}: cenário duplicado ("${name}").`);
  seenScenarios.add(nameKey);

  const roles = row.slice(2, 2 + ROLES_PER_SCENARIO).map((cell) => String(cell ?? '').trim());
  const extras = row.slice(2 + ROLES_PER_SCENARIO).filter((cell) => String(cell ?? '').trim() !== '');
  if (extras.length > 0) fail(`Linha ${line}: colunas extras não esperadas (${extras.length}).`);
  if (roles.length !== ROLES_PER_SCENARIO) {
    fail(`Linha ${line}: ${roles.length} papéis; esperado ${ROLES_PER_SCENARIO}.`);
  }
  roles.forEach((role, roleIndex) => {
    if (role === '') fail(`Linha ${line}: papel ${roleIndex + 1} vazio.`);
  });
  const uniqueRoles = new Set(roles.map((role) => role.toLocaleLowerCase('pt-BR')));
  if (uniqueRoles.size !== roles.length) {
    fail(`Linha ${line}: papel duplicado dentro do cenário "${name}".`);
  }

  scenarios.push({ id, name, roles });
});

if (errors.length > 0) {
  console.error('[import-papeis] Falha na validação da planilha:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

scenarios.sort((a, b) => a.id - b.id);

const payload = {
  comment: 'Arquivo gerado por scripts/import-papeis.mjs a partir de Papeis.xlsx. Não editar manualmente.',
  rolesPerScenario: ROLES_PER_SCENARIO,
  scenarios,
};

writeFileSync(TARGET, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(
  `[import-papeis] ${scenarios.length} cenários x ${ROLES_PER_SCENARIO} papéis gravados em src/data/scenarios.generated.json`,
);
