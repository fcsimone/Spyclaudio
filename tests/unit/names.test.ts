import { describe, expect, it } from 'vitest';
import { isDuplicateName, normalizeName, sanitizeName, validateName } from '../../src/game/names';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../src/game/roomCode';
import { canTransition } from '../../src/game/types';

describe('nomes', () => {
  it('ignora acentos, maiúsculas e espaços extras na comparação', () => {
    expect(normalizeName('  José  Antônio ')).toBe(normalizeName('jose antonio'));
    expect(normalizeName('ANA')).toBe(normalizeName('ana'));
  });

  it('detecta duplicidade insensível a acento e caixa', () => {
    expect(isDuplicateName('Joao', ['João'])).toBe(true);
    expect(isDuplicateName('Bia', ['João', 'Ana'])).toBe(false);
  });

  it('valida tamanho e conteúdo', () => {
    expect(validateName('')).not.toBeNull();
    expect(validateName('   ')).not.toBeNull();
    expect(validateName('!!!')).not.toBeNull();
    expect(validateName('Ana')).toBeNull();
  });

  it('corta nomes muito longos', () => {
    expect(sanitizeName('a'.repeat(50))).toHaveLength(20);
  });
});

describe('código de sala', () => {
  it('gera códigos válidos de 6 caracteres', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('não usa caracteres ambíguos', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateRoomCode()).not.toMatch(/[01OILSZBGU]/);
    }
  });

  it('normaliza a digitação do usuário', () => {
    expect(normalizeRoomCode('k7 mq-3d')).toBe('K7MQ3D');
    expect(normalizeRoomCode('sz')).toBe('52');
    expect(normalizeRoomCode('u')).toBe('V');
    expect(normalizeRoomCode('abcdefghij')).toHaveLength(6);
  });

  it('gera códigos distintos', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(490);
  });
});

describe('transições de estado', () => {
  it('só avança', () => {
    expect(canTransition('lobby', 'distributed')).toBe(true);
    expect(canTransition('voting', 'result')).toBe(true);
    expect(canTransition('result', 'voting')).toBe(false);
    expect(canTransition('distributed', 'lobby')).toBe(false);
    expect(canTransition('lobby', 'lobby')).toBe(false);
  });
});
