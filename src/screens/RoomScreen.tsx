import { useEffect, useRef, useState } from 'react';
import { Card, Countdown, ErrorMessage, Notice } from '../components/ui';
import { QrCode } from '../components/QrCode';
import { joinUrl, navigate } from '../app/router';
import { useSession } from '../app/SessionContext';
import { sortPlayers, useRoom } from '../app/useRoom';
import { CAPACITY } from '../game/types';
import { validatePlayerCount } from '../game/distribution';
import { getScenario } from '../data/scenarios';
import {
  closeRoom,
  finalizeRound,
  removePlayer,
  startGame,
  startVoting,
  submitVote,
} from '../firebase/rooms';
import type { RoomPlayer } from '../firebase/rooms';

export function RoomScreen({ code }: { code: string }) {
  const { session } = useSession();
  const room = useRoom(code, session?.uid ?? null);
  const [error, setError] = useState<string | null>(null);

  const players = sortPlayers(room.players);
  const playerIds = players.map(([uid]) => uid);
  const isHost = session?.isHost === true && room.meta?.hostUid === session.uid;

  // Finalização agendada pelo anfitrião: timer + retomada de foco/visibilidade.
  // Sem backend no plano Spark, é o navegador do anfitrião que apura.
  const finalizing = useRef(false);
  const status = room.meta?.status;
  const deadline = room.meta?.votingDeadline;
  const votedCount = playerIds.filter((uid) => room.players[uid]?.hasVoted === true).length;
  const playerIdsKey = playerIds.join(',');

  useEffect(() => {
    if (!isHost || status !== 'voting' || !deadline) return;
    const ids = playerIdsKey === '' ? [] : playerIdsKey.split(',');

    const check = () => {
      if (finalizing.current) return;
      const serverNow = Date.now() + room.serverOffset;
      const everyoneVoted = ids.length > 0 && votedCount === ids.length;
      if (serverNow < deadline && !everyoneVoted) return;

      finalizing.current = true;
      void finalizeRound({ code, playerIds: ids, deadline }).catch((cause: unknown) => {
        finalizing.current = false;
        setError(cause instanceof Error ? cause.message : 'Falha ao apurar a votação.');
      });
    };

    check();
    const interval = window.setInterval(check, 1000);
    window.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [code, deadline, isHost, playerIdsKey, room.serverOffset, status, votedCount]);

  // Sessão perdida (recarregou a página): não há retorno nesta versão.
  if (!session || session.code !== code) {
    return (
      <>
        <h1>Spyclaudio</h1>
        <Notice>
          Não é possível voltar para uma partida em andamento nesta versão. A identificação é
          temporária e desaparece ao recarregar a página.
        </Notice>
        <button type="button" className="primario" onClick={() => navigate({ name: 'inicio' })}>
          Voltar ao início
        </button>
      </>
    );
  }

  if (room.loading) {
    return <p className="texto-suave">Carregando sala…</p>;
  }

  if (!room.meta) {
    return (
      <>
        <h1>Sala encerrada</h1>
        <Notice>Esta sala não existe mais.</Notice>
        <button type="button" className="primario" onClick={() => navigate({ name: 'inicio' })}>
          Voltar ao início
        </button>
      </>
    );
  }

  if (room.meta.status === 'closed') {
    return (
      <>
        <h1>Sala interrompida</h1>
        <Notice>{room.meta.closedReason ?? 'O anfitrião encerrou a sala.'}</Notice>
        <button type="button" className="primario" onClick={() => navigate({ name: 'inicio' })}>
          Voltar ao início
        </button>
      </>
    );
  }

  const hostConnected = room.players[room.meta.hostUid]?.connected !== false;

  return (
    <>
      {!hostConnected && room.meta.status !== 'result' && (
        <Notice>O anfitrião perdeu a conexão. A partida pode não ser concluída.</Notice>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      {room.meta.status === 'lobby' && (
        <LobbyView
          code={code}
          isHost={isHost}
          players={players}
          meta={room.meta}
          selfUid={session.uid}
          onError={setError}
        />
      )}

      {room.meta.status === 'distributed' && (
        <RoleView room={room} isHost={isHost} code={code} onError={setError} />
      )}

      {room.meta.status === 'voting' && (
        <VotingView
          code={code}
          players={players}
          selfUid={session.uid}
          deadline={room.meta.votingDeadline ?? 0}
          serverOffset={room.serverOffset}
          hasVoted={room.players[session.uid]?.hasVoted === true}
          onError={setError}
        />
      )}

      {room.meta.status === 'result' && room.result && (
        <ResultView players={room.players} result={room.result} selfUid={session.uid} />
      )}

      {room.meta.status === 'result' && !room.result && (
        <p className="texto-suave">Apurando os votos…</p>
      )}

      {isHost && room.meta.status !== 'result' && (
        <button
          type="button"
          className="perigo discreto"
          onClick={() => void closeRoom(code, 'O anfitrião encerrou a sala.')}
        >
          Encerrar sala
        </button>
      )}
    </>
  );
}

function LobbyView({
  code,
  isHost,
  players,
  meta,
  selfUid,
  onError,
}: {
  code: string;
  isHost: boolean;
  players: [string, RoomPlayer][];
  meta: { spyCount: 1 | 2; maxPlayers: number };
  selfUid: string;
  onError: (message: string | null) => void;
}) {
  const problem = validatePlayerCount(players.length, meta.spyCount);

  return (
    <>
      <h1>Sala {code}</h1>
      <Card>
        <p className="codigo-sala" aria-label={`Código da sala: ${code.split('').join(' ')}`}>
          {code}
        </p>
        <QrCode value={joinUrl(code)} label={`QR Code para entrar na sala ${code}`} />
        <p className="texto-suave" style={{ textAlign: 'center' }}>
          Aponte a câmera ou digite o código no app.
        </p>
      </Card>

      <Card>
        <h2>
          Jogadores {players.length}/{meta.maxPlayers}
        </h2>
        <ul className="lista">
          {players.map(([uid, player]) => (
            <li key={uid}>
              <span>
                {player.name}
                {uid === selfUid ? ' (você)' : ''}
                {player.connected === false ? ' — desconectado' : ''}
              </span>
              {isHost && uid !== selfUid && (
                <button
                  type="button"
                  className="discreto perigo"
                  onClick={() => void removePlayer(code, uid, player.normalizedName)}
                  aria-label={`Remover ${player.name}`}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="texto-suave">
          {meta.spyCount === 1 ? '1 espião' : '2 espiões'} · de {CAPACITY[meta.spyCount].min} a{' '}
          {CAPACITY[meta.spyCount].max} jogadores.
        </p>
      </Card>

      {isHost ? (
        <>
          {problem && <p className="texto-suave">{problem}</p>}
          <button
            type="button"
            className="primario"
            disabled={problem !== null}
            onClick={() => {
              onError(null);
              void startGame({
                code,
                spyCount: meta.spyCount,
                playerIds: players.map(([uid]) => uid),
              }).catch((cause: unknown) =>
                onError(cause instanceof Error ? cause.message : 'Falha ao iniciar a partida.'),
              );
            }}
          >
            Iniciar partida
          </button>
        </>
      ) : (
        <p className="texto-suave">Aguardando o anfitrião iniciar a partida.</p>
      )}
    </>
  );
}

function RoleView({
  room,
  isHost,
  code,
  onError,
}: {
  room: ReturnType<typeof useRoom>;
  isHost: boolean;
  code: string;
  onError: (message: string | null) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const secret = room.secret;

  return (
    <>
      <h1>Seu papel</h1>
      <Card>
        {!secret ? (
          <p className="texto-suave">Recebendo seu papel…</p>
        ) : !revealed ? (
          <>
            <div className="tela-neutra">
              <p>Confira se ninguém está olhando a sua tela.</p>
            </div>
            <button type="button" className="primario" onClick={() => setRevealed(true)}>
              Revelar meu papel
            </button>
          </>
        ) : (
          <>
            <div className="papel-secreto">
              {secret.isSpy ? (
                <>
                  <p className="espiao">Você é o espião</p>
                  <p className="texto-suave">Você não sabe o local. Descubra sem se entregar.</p>
                </>
              ) : (
                <>
                  <p className="cenario">{secret.scenarioId ? getScenario(secret.scenarioId).name : ''}</p>
                  <p className="papel">{secret.role}</p>
                </>
              )}
            </div>
            <button type="button" onClick={() => setRevealed(false)}>
              Ocultar
            </button>
          </>
        )}
      </Card>

      {isHost ? (
        <button
          type="button"
          className="primario"
          onClick={() => {
            onError(null);
            void startVoting(code).catch((cause: unknown) =>
              onError(cause instanceof Error ? cause.message : 'Falha ao iniciar a votação.'),
            );
          }}
        >
          Iniciar votação
        </button>
      ) : (
        <p className="texto-suave">Conversem à vontade. O anfitrião inicia a votação.</p>
      )}
    </>
  );
}

function VotingView({
  code,
  players,
  selfUid,
  deadline,
  serverOffset,
  hasVoted,
  onError,
}: {
  code: string;
  players: [string, RoomPlayer][];
  selfUid: string;
  deadline: number;
  serverOffset: number;
  hasVoted: boolean;
  onError: (message: string | null) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const chosenName = players.find(([uid]) => uid === choice)?.[1].name ?? '';

  async function send() {
    if (!choice || sending) return;
    setSending(true);
    onError(null);
    try {
      await submitVote({ code, uid: selfUid, targetUid: choice });
      setConfirming(false);
    } catch {
      onError('Não foi possível registrar seu voto. Talvez o prazo tenha terminado.');
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <h1>Votação</h1>
      <Countdown deadline={deadline} offset={serverOffset} />

      {hasVoted ? (
        <Card>
          <p className="marcador-ok">Voto registrado. Ele é definitivo e não pode ser alterado.</p>
          <p className="texto-suave">Aguardando os demais jogadores ou o fim do prazo.</p>
        </Card>
      ) : (
        <Card>
          <h2>Em quem você vota?</h2>
          <p className="texto-suave">Você pode votar em qualquer participante, inclusive em si mesmo.</p>
          <ul className="lista">
            {players.map(([uid, player]) => (
              <li key={uid}>
                <button
                  type="button"
                  style={{ width: '100%' }}
                  aria-pressed={choice === uid}
                  className={choice === uid ? 'primario' : ''}
                  onClick={() => setChoice(uid)}
                >
                  {player.name}
                  {uid === selfUid ? ' (você)' : ''}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="primario"
            disabled={!choice}
            onClick={() => setConfirming(true)}
          >
            Votar
          </button>
        </Card>
      )}

      {confirming && (
        <Card>
          <p>
            Confirmar voto em <strong>{chosenName}</strong>? O voto é definitivo.
          </p>
          <button type="button" className="primario" disabled={sending} onClick={() => void send()}>
            {sending ? 'Registrando…' : 'Confirmar voto'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={sending}>
            Cancelar
          </button>
        </Card>
      )}

      <Card>
        <h2>Quem já votou</h2>
        <ul className="lista">
          {players.map(([uid, player]) => (
            <li key={uid}>
              <span>{player.name}</span>
              <span className={player.hasVoted ? 'marcador-ok' : 'texto-suave'}>
                {player.hasVoted ? 'votou' : 'aguardando'}
              </span>
            </li>
          ))}
        </ul>
        <p className="texto-suave">O conteúdo dos votos só aparece no resultado.</p>
      </Card>
    </>
  );
}

function ResultView({
  players,
  result,
  selfUid,
}: {
  players: Record<string, RoomPlayer>;
  result: {
    scenarioId: number;
    assignments: Record<string, { role?: string; isSpy: boolean }>;
    ballots: Record<string, { targetUid: string; counted: boolean; reason?: string }>;
    validVoteCount: number;
    selectedUid: string | null;
    tie: boolean;
    abstained: Record<string, boolean>;
  };
  selfUid: string;
}) {
  const nameOf = (uid: string) => players[uid]?.name ?? 'Jogador removido';
  const ordered = sortPlayers(players);
  const spies = ordered.filter(([uid]) => result.assignments[uid]?.isSpy);
  const selectedIsSpy = result.selectedUid ? result.assignments[result.selectedUid]?.isSpy === true : false;

  return (
    <>
      <h1>Resultado</h1>

      <Card className={selectedIsSpy ? 'destaque-identificado' : undefined}>
        <h2>Local</h2>
        <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{getScenario(result.scenarioId).name}</p>
        {result.selectedUid ? (
          <p>
            Mais votado: <strong>{nameOf(result.selectedUid)}</strong>
            {selectedIsSpy ? ' — era espião!' : ' — não era espião.'}
          </p>
        ) : result.tie ? (
          <p>Houve empate. Ninguém foi escolhido.</p>
        ) : (
          <p>Não houve votos válidos. Ninguém foi escolhido.</p>
        )}
        <p className="texto-suave">Votos válidos: {result.validVoteCount}</p>
      </Card>

      <Card>
        <h2>Espiões</h2>
        <ul className="lista">
          {spies.map(([uid]) => (
            <li key={uid} className={uid === result.selectedUid ? 'destaque-identificado' : undefined}>
              <span className="marcador-espiao">
                {nameOf(uid)}
                {uid === selfUid ? ' (você)' : ''}
              </span>
              {uid === result.selectedUid && <span className="marcador-ok">identificado</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2>Papéis</h2>
        <ul className="lista">
          {ordered.map(([uid]) => {
            const assignment = result.assignments[uid];
            return (
              <li key={uid}>
                <span>{nameOf(uid)}</span>
                <span className={assignment?.isSpy ? 'marcador-espiao' : 'texto-suave'}>
                  {assignment?.isSpy ? 'Espião' : (assignment?.role ?? '—')}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2>Votos</h2>
        <ul className="lista">
          {ordered.map(([uid]) => {
            const ballot = result.ballots[uid];
            if (!ballot) {
              return (
                <li key={uid}>
                  <span>{nameOf(uid)}</span>
                  <span className="texto-suave">não votou</span>
                </li>
              );
            }
            return (
              <li key={uid}>
                <span>
                  {nameOf(uid)} votou em {nameOf(ballot.targetUid)}
                </span>
                {!ballot.counted && (
                  <span className="texto-suave">desconsiderado{ballot.reason ? ` (${ballot.reason})` : ''}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <button type="button" className="primario" onClick={() => navigate({ name: 'inicio' })}>
        Voltar ao início
      </button>
      <p className="texto-suave">
        Para jogar outra rodada, criem uma nova sala. Esta versão não repete rodadas na mesma sala.
      </p>
    </>
  );
}
