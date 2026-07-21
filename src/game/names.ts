/** Normalização e validação de nomes de jogadores. */

export const MAX_NAME_LENGTH = 20;
export const MIN_NAME_LENGTH = 1;

/**
 * Normaliza para comparação: minúsculas, sem acentos, espaços colapsados.
 * Usado como chave em `rooms/{code}/normalizedNames` para garantir unicidade.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s/g, '-');
}

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function validateName(raw: string): string | null {
  const name = sanitizeName(raw);
  if (name.length < MIN_NAME_LENGTH) return 'Informe um nome.';
  if (name.length > MAX_NAME_LENGTH) return `Use no máximo ${MAX_NAME_LENGTH} caracteres.`;
  if (normalizeName(name).length === 0) return 'Use pelo menos uma letra ou número.';
  return null;
}

/** Verifica duplicidade dentro de uma lista já existente. */
export function isDuplicateName(raw: string, existing: readonly string[]): boolean {
  const key = normalizeName(raw);
  return existing.some((name) => normalizeName(name) === key);
}
