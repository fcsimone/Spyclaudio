import { describe, expect, it } from 'vitest';
import { shouldFinalize, tally } from '../../src/game/voting';
import type { Ballot } from '../../src/game/voting';

const DEADLINE = 1_000_000;
const ballot = (voterId: string, targetId: string, offset = -1000): Ballot => ({
  voterId,
  targetId,
  submittedAt: DEADLINE + offset,
});

const base = {
  playerIds: ['ana', 'bia', 'caio', 'davi'],
  spyIds: ['davi'],
  deadline: DEADLINE,
};

describe('apuração', () => {
  it('permite voto em si mesmo', () => {
    const result = tally({ ...base, ballots: [ballot('ana', 'ana'), ballot('bia', 'ana'), ballot('caio', 'bia')] });
    expect(result.tallies['ana']).toBe(2);
    expect(result.selectedId).toBe('ana');
  });

  it('ignora o segundo voto do mesmo jogador', () => {
    const result = tally({
      ...base,
      ballots: [ballot('ana', 'bia', -5000), ballot('ana', 'caio', -1000)],
    });
    expect(result.validVoteCount).toBe(1);
    expect(result.tallies['bia']).toBe(1);
    expect(result.discardedBallots.some((b) => b.reason === 'voto repetido')).toBe(true);
  });

  it('descarta votos enviados após o prazo', () => {
    const result = tally({ ...base, ballots: [ballot('ana', 'bia', 1)] });
    expect(result.validVoteCount).toBe(0);
    expect(result.discardedBallots[0]?.reason).toBe('fora do prazo');
    expect(result.selectedId).toBeNull();
  });

  it('armazena, mas desconsidera o voto do espião', () => {
    const result = tally({ ...base, ballots: [ballot('davi', 'ana'), ballot('ana', 'bia')] });
    expect(result.validVoteCount).toBe(1);
    expect(result.tallies['ana']).toBeUndefined();
    expect(result.discardedBallots.some((b) => b.voterId === 'davi' && b.reason === 'espião')).toBe(true);
    expect(result.selectedId).toBe('bia');
  });

  it('descarta voto em alvo inexistente', () => {
    const result = tally({ ...base, ballots: [ballot('ana', 'fantasma')] });
    expect(result.validVoteCount).toBe(0);
    expect(result.discardedBallots[0]?.reason).toBe('alvo inválido');
  });

  it('lista quem não votou', () => {
    const result = tally({ ...base, ballots: [ballot('ana', 'bia')] });
    expect([...result.abstainedIds].sort()).toEqual(['bia', 'caio', 'davi']);
  });

  it('empate não escolhe ninguém', () => {
    const result = tally({
      ...base,
      ballots: [ballot('ana', 'bia'), ballot('bia', 'ana'), ballot('caio', 'caio')],
    });
    expect(result.tie).toBe(true);
    expect(result.selectedId).toBeNull();
    expect(result.validVoteCount).toBe(3);
  });

  it('zero votos válidos não escolhe ninguém e não marca empate', () => {
    const result = tally({ ...base, ballots: [] });
    expect(result.selectedId).toBeNull();
    expect(result.tie).toBe(false);
    expect(result.validVoteCount).toBe(0);
  });

  it('dois espiões: nenhum voto de espião entra na contagem', () => {
    const result = tally({
      playerIds: ['ana', 'bia', 'caio', 'davi', 'eva'],
      spyIds: ['davi', 'eva'],
      deadline: DEADLINE,
      ballots: [ballot('davi', 'ana'), ballot('eva', 'ana'), ballot('ana', 'davi'), ballot('bia', 'davi')],
    });
    expect(result.validVoteCount).toBe(2);
    expect(result.selectedId).toBe('davi');
    expect(result.tallies['ana']).toBeUndefined();
  });

  it('ignora votos de quem não está na sala', () => {
    const result = tally({ ...base, ballots: [ballot('intruso', 'ana')] });
    expect(result.validVoteCount).toBe(0);
    expect(result.discardedBallots).toHaveLength(0);
  });
});

describe('encerramento', () => {
  it('encerra quando todos votaram', () => {
    expect(
      shouldFinalize({
        playerIds: ['ana', 'bia'],
        votedIds: ['ana', 'bia'],
        now: DEADLINE - 60_000,
        deadline: DEADLINE,
      }),
    ).toBe(true);
  });

  it('não encerra antes do prazo se faltam votos', () => {
    expect(
      shouldFinalize({
        playerIds: ['ana', 'bia'],
        votedIds: ['ana'],
        now: DEADLINE - 60_000,
        deadline: DEADLINE,
      }),
    ).toBe(false);
  });

  it('encerra ao atingir o prazo', () => {
    expect(
      shouldFinalize({ playerIds: ['ana', 'bia'], votedIds: [], now: DEADLINE, deadline: DEADLINE }),
    ).toBe(true);
  });
});
