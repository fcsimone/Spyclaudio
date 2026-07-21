#!/usr/bin/env node
/**
 * Verificação estática de database.rules.json.
 * Não substitui os testes com emulador (`npm run test:rules`), mas garante
 * que erros grosseiros não cheguem à publicação: JSON inválido, regra
 * permissiva demais, ou proteção essencial ausente.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(ROOT, 'database.rules.json'), 'utf8');

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error('[check-rules] JSON inválido:', error.message);
  process.exit(1);
}

const errors = [];
const rules = parsed.rules;
if (!rules) errors.push('Objeto "rules" ausente.');

// 1. Negar tudo por padrão.
if (rules['.read'] !== false) errors.push('A raiz deve ter ".read": false.');
if (rules['.write'] !== false) errors.push('A raiz deve ter ".write": false.');

// 2. Nenhuma regra aberta do tipo "auth != null" solta na raiz, nem `true`.
const flatten = (node, path = '') => {
  const entries = [];
  for (const [key, value] of Object.entries(node)) {
    const next = path ? `${path}/${key}` : key;
    if (key.startsWith('.')) entries.push([next, value]);
    else if (value && typeof value === 'object') entries.push(...flatten(value, next));
  }
  return entries;
};

const all = flatten(rules);
for (const [path, value] of all) {
  if (value === true) errors.push(`Regra aberta (true) em ${path}. Regras de teste não são permitidas.`);
  if (typeof value === 'string' && value.trim() === 'true') {
    errors.push(`Regra aberta ("true") em ${path}.`);
  }
}

// 3. Toda regra de escrita/leitura textual precisa exigir autenticação.
for (const [path, value] of all) {
  if (typeof value !== 'string') continue;
  if (!path.endsWith('.read') && !path.endsWith('.write')) continue;
  if (!value.includes('auth')) errors.push(`Regra em ${path} não menciona auth.`);
}

// 4. Só métodos existentes na linguagem de regras do Realtime Database.
// O emulador só acusa isso ao subir; aqui o erro aparece antes.
// ATENÇÃO: a linguagem de regras NÃO tem como contar filhos. Não existem
// numChildren() nem getChildrenCount() — isso é API do SDK cliente, não das
// regras. Lotação é controlada pelo contador meta/playerCount.
const ALLOWED_METHODS = new Set([
  // RuleDataSnapshot
  'val',
  'child',
  'parent',
  'hasChild',
  'hasChildren',
  'exists',
  'getPriority',
  'isNumber',
  'isString',
  'isBoolean',
  // String
  'contains',
  'beginsWith',
  'endsWith',
  'replace',
  'toLowerCase',
  'toUpperCase',
  'matches',
  'length',
]);

for (const [path, value] of all) {
  if (typeof value !== 'string') continue;
  for (const match of value.matchAll(/\.([A-Za-z_]\w*)\s*\(/g)) {
    const method = match[1];
    if (!ALLOWED_METHODS.has(method)) {
      errors.push(`Método inexistente "${method}()" em ${path}.`);
    }
  }
}

// 5. Proteções essenciais que devem existir explicitamente.
const room = rules.rooms?.$roomCode;
if (!room) errors.push('Caminho rooms/$roomCode ausente.');

const required = [
  ['secrets/$uid/.read', room?.secrets?.$uid?.['.read'], 'auth.uid == $uid'],
  ['votes/$uid/.write', room?.votes?.$uid?.['.write'], 'votingDeadline'],
  ['result/.write', room?.result?.['.write'], 'hostUid'],
];
for (const [label, value, needle] of required) {
  if (typeof value !== 'string' || !value.includes(needle)) {
    errors.push(`Regra ${label} deve conter "${needle}".`);
  }
}

// 5. Campos desconhecidos precisam ser bloqueados nos nós de dados.
for (const node of ['meta', 'secrets', 'votes']) {
  const target = node === 'meta' ? room?.meta : room?.[node]?.$uid;
  if (target?.$other?.['.validate'] !== false) {
    errors.push(`O nó ${node} deve bloquear campos extras com "$other": { ".validate": false }.`);
  }
}
if (room?.$other?.['.validate'] !== false) {
  errors.push('A sala deve bloquear caminhos desconhecidos com "$other": { ".validate": false }.');
}

if (errors.length > 0) {
  console.error('[check-rules] Problemas encontrados:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[check-rules] OK — ${all.length} regras analisadas, nenhuma permissiva encontrada.`);
