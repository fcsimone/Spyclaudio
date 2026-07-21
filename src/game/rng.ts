/**
 * Fonte de aleatoriedade criptográfica. Math.random é proibido no projeto
 * (ver regra `no-restricted-properties` no eslint.config.js).
 */

export interface RandomSource {
  /** Inteiro uniformemente distribuído em [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Amostragem sem viés (rejection sampling) sobre crypto.getRandomValues. */
export const cryptoRandom: RandomSource = {
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive deve ser um inteiro positivo.');
    }
    if (maxExclusive === 1) return 0;

    const limit = 0x1_0000_0000; // 2^32
    // Maior múltiplo de maxExclusive que cabe em 2^32; acima disso, rejeitamos.
    const threshold = limit - (limit % maxExclusive);
    const buffer = new Uint32Array(1);

    for (;;) {
      globalThis.crypto.getRandomValues(buffer);
      const value = buffer[0]!;
      if (value < threshold) return value % maxExclusive;
    }
  },
};

/** Fisher–Yates. Não muta a entrada. */
export function shuffle<T>(items: readonly T[], random: RandomSource = cryptoRandom): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = random.nextInt(i + 1);
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Escolhe `count` elementos distintos, sem repetição. */
export function sample<T>(items: readonly T[], count: number, random: RandomSource = cryptoRandom): T[] {
  if (count < 0 || count > items.length) {
    throw new RangeError(`Não é possível sortear ${count} de ${items.length} itens.`);
  }
  return shuffle(items, random).slice(0, count);
}

/** Escolhe um elemento. */
export function pickOne<T>(items: readonly T[], random: RandomSource = cryptoRandom): T {
  if (items.length === 0) throw new RangeError('Lista vazia.');
  return items[random.nextInt(items.length)]!;
}
