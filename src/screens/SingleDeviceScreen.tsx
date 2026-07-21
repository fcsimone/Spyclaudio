import { useMemo, useState } from 'react';
import { BackLink, Card, ErrorMessage } from '../components/ui';
import { navigate } from '../app/router';
import { CAPACITY } from '../game/types';
import type { Distribution, SpyCount } from '../game/types';
import { distribute, validatePlayerCount } from '../game/distribution';
import { isDuplicateName, sanitizeName, validateName } from '../game/names';
import { getScenario, scenarios } from '../data/scenarios';

type Phase = 'cadastro' | 'passar' | 'revelar' | 'pronto';

export function SingleDeviceScreen() {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [spyCount, setSpyCount] = useState<SpyCount>(1);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('cadastro');
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const countError = useMemo(() => validatePlayerCount(names.length, spyCount), [names.length, spyCount]);

  function addName() {
    const problem = validateName(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const name = sanitizeName(draft);
    if (isDuplicateName(name, names)) {
      setError('Esse nome já foi cadastrado.');
      return;
    }
    if (names.length >= CAPACITY[spyCount].max) {
      setError(`O limite é de ${CAPACITY[spyCount].max} jogadores com ${spyCount} espião(ões).`);
      return;
    }
    setNames([...names, name]);
    setDraft('');
    setError(null);
  }

  function start() {
    if (countError) {
      setError(countError);
      return;
    }
    try {
      setDistribution(distribute(names, spyCount, scenarios));
      setIndex(0);
      setRevealed(false);
      setPhase('passar');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível sortear.');
    }
  }

  function nextPlayer() {
    setRevealed(false);
    if (distribution && index + 1 >= distribution.assignments.length) {
      setPhase('pronto');
      return;
    }
    setIndex(index + 1);
    setPhase('passar');
  }

  function restart() {
    setDistribution(null);
    setPhase('cadastro');
    setIndex(0);
    setRevealed(false);
    setError(null);
  }

  if (phase === 'cadastro') {
    return (
      <>
        <BackLink onClick={() => navigate({ name: 'inicio' })} />
        <h1>Um aparelho</h1>

        <Card>
          <h2>Jogadores ({names.length})</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addName();
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nome do jogador"
              maxLength={20}
              aria-label="Nome do jogador"
              autoComplete="off"
            />
            <button type="submit" className="primario" style={{ minWidth: 96 }}>
              Adicionar
            </button>
          </form>

          {names.length > 0 && (
            <ul className="lista">
              {names.map((name, position) => (
                <li key={name}>
                  <span>
                    {position + 1}. {name}
                  </span>
                  <button
                    type="button"
                    className="discreto perigo"
                    onClick={() => setNames(names.filter((item) => item !== name))}
                    aria-label={`Remover ${name}`}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2>Espiões</h2>
          <div className="grupo-opcoes">
            {([1, 2] as SpyCount[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={spyCount === option}
                onClick={() => setSpyCount(option)}
              >
                {option === 1 ? '1 espião' : '2 espiões'}
              </button>
            ))}
          </div>
          <p className="texto-suave">
            De {CAPACITY[spyCount].min} a {CAPACITY[spyCount].max} jogadores.
          </p>
        </Card>

        <ErrorMessage>{error ?? (names.length > 0 ? countError : null)}</ErrorMessage>

        <button type="button" className="primario" onClick={start} disabled={countError !== null}>
          Sortear papéis
        </button>
      </>
    );
  }

  if (phase === 'pronto') {
    return (
      <>
        <h1>Tudo pronto</h1>
        <Card>
          <p>Todos já viram seus papéis. A rodada pode começar.</p>
          <p className="texto-suave">
            Conversem e tentem descobrir quem é o espião. Neste modo a votação é feita fora do app.
          </p>
        </Card>
        <button type="button" className="primario" onClick={restart}>
          Nova partida
        </button>
        <button type="button" onClick={() => navigate({ name: 'inicio' })}>
          Voltar ao início
        </button>
      </>
    );
  }

  const assignment = distribution?.assignments[index];
  const playerName = assignment?.playerId ?? '';

  return (
    <>
      <h1>
        Jogador {index + 1} de {distribution?.assignments.length ?? 0}
      </h1>

      {phase === 'passar' && (
        <Card>
          <div className="tela-neutra">
            <p className="texto-suave">Passe o aparelho para</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{playerName}</p>
            <p className="texto-suave">Só toque em revelar quando estiver com o aparelho em mãos.</p>
          </div>
          <button
            type="button"
            className="primario"
            onClick={() => {
              setPhase('revelar');
              setRevealed(false);
            }}
          >
            Sou {playerName}
          </button>
        </Card>
      )}

      {phase === 'revelar' && assignment && (
        <Card>
          {!revealed ? (
            <>
              <div className="tela-neutra">
                <p>
                  <strong>{playerName}</strong>, confira se ninguém está olhando.
                </p>
              </div>
              <button type="button" className="primario" onClick={() => setRevealed(true)}>
                Revelar meu papel
              </button>
            </>
          ) : (
            <>
              <div className="papel-secreto">
                {assignment.isSpy ? (
                  <>
                    <p className="espiao">Você é o espião</p>
                    <p className="texto-suave">
                      Você não sabe o local. Descubra sem se entregar.
                      {distribution && distribution.assignments.filter((a) => a.isSpy).length > 1
                        ? ' Existe outro espião, mas você não sabe quem é.'
                        : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="cenario">{getScenario(distribution!.scenarioId).name}</p>
                    <p className="papel">{assignment.role}</p>
                  </>
                )}
              </div>
              <button type="button" className="primario" onClick={nextPlayer}>
                Ocultar e passar adiante
              </button>
            </>
          )}
        </Card>
      )}
    </>
  );
}
