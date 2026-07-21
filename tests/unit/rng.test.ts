import { describe, expect, it } from 'vitest';
import { cryptoRandom, pickOne, sample, shuffle } from '../../src/game/rng';

describe('cryptoRandom', () => {
  it('respeita o intervalo [0, max)', () => {
    for (let i = 0; i < 5000; i += 1) {
      const value = cryptoRandom.nextInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('rejeita limites inválidos', () => {
    expect(() => cryptoRandom.nextInt(0)).toThrow(RangeError);
    expect(() => cryptoRandom.nextInt(-3)).toThrow(RangeError);
    expect(() => cryptoRandom.nextInt(2.5)).toThrow(RangeError);
  });

  it('cobre todos os valores possíveis ao longo de muitas amostras', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) seen.add(cryptoRandom.nextInt(5));
    expect(seen.size).toBe(5);
  });
});

describe('shuffle', () => {
  it('preserva todos os elementos e não muta a entrada', () => {
    const original = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const copy = [...original];
    const result = shuffle(original);
    expect(original).toEqual(copy);
    expect([...result].sort()).toEqual([...original].sort());
  });

  it('produz ordens diferentes em execuções repetidas', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = new Set<string>();
    for (let i = 0; i < 200; i += 1) orders.add(shuffle(items).join(''));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('sample e pickOne', () => {
  it('retorna elementos distintos', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < 200; i += 1) {
      const picked = sample(items, 3);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
    }
  });

  it('rejeita amostra maior que a lista', () => {
    expect(() => sample(['a'], 2)).toThrow(RangeError);
  });

  it('pickOne rejeita lista vazia', () => {
    expect(() => pickOne([])).toThrow(RangeError);
  });
});
