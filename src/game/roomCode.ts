import { cryptoRandom } from './rng';
import type { RandomSource } from './rng';

/**
 * Alfabeto sem caracteres ambíguos.
 * Excluídos: 0/O, 1/I/L, G (confunde com 6), S (com 5), Z (com 2), B (com 8), U (com V).
 * 26 símbolos x 6 posições => ~309 milhões de combinações.
 */
export const ROOM_CODE_ALPHABET = '23456789ACDEFHJKMNPQRTVWXY';
export const ROOM_CODE_LENGTH = 6;

/** Confusões comuns na digitação, mapeadas para o símbolo canônico do alfabeto. */
const TYPO_MAP: Record<string, string> = {
  O: '', // 0/O não existem no alfabeto: mantidos fora para gerar erro claro
  '0': '',
  I: '',
  L: '',
  '1': '',
  S: '5',
  Z: '2',
  B: '8',
  G: '6',
  U: 'V',
};

export function generateRoomCode(random: RandomSource = cryptoRandom): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[random.nextInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Aceita o código digitado com espaços, hífens, minúsculas e confusões comuns. */
export function normalizeRoomCode(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  let result = '';
  for (const character of upper) {
    const mapped = TYPO_MAP[character] ?? character;
    if (mapped !== '' && ROOM_CODE_ALPHABET.includes(mapped)) result += mapped;
  }
  return result.slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((character) => ROOM_CODE_ALPHABET.includes(character))
  );
}
