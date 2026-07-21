import { useState } from 'react';
import { BackLink, Card, ErrorMessage } from '../components/ui';
import { navigate } from '../app/router';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../game/roomCode';
import { sanitizeName, validateName } from '../game/names';
import { ensureAnonymousUser } from '../firebase/client';
import { joinRoom, RoomError } from '../firebase/rooms';
import { useSession } from '../app/SessionContext';

export function JoinRoomScreen({ initialCode }: { initialCode: string }) {
  const { setSession } = useSession();
  const [code, setCode] = useState(() => normalizeRoomCode(initialCode));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isValidRoomCode(code)) {
      setError(`O código tem ${ROOM_CODE_LENGTH} caracteres. Confira com o anfitrião.`);
      return;
    }
    const problem = validateName(name);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await ensureAnonymousUser();
      const clean = sanitizeName(name);
      await joinRoom({ code, uid: user.uid, name: clean });
      setSession({ code, uid: user.uid, name: clean, isHost: false });
      navigate({ name: 'sala', code });
    } catch (cause) {
      if (cause instanceof RoomError) {
        setError(cause.message);
      } else {
        setError('Não foi possível entrar na sala. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink onClick={() => navigate({ name: 'inicio' })} />
      <h1>Entrar na sala</h1>

      <Card>
        <label>
          Código da sala
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={ROOM_CODE_LENGTH}
            placeholder="Ex.: K7MQ3D"
            style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
          />
        </label>
        <label>
          Seu nome
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            placeholder="Como os outros vão te ver"
            autoComplete="off"
          />
        </label>
      </Card>

      <ErrorMessage>{error}</ErrorMessage>

      <button type="button" className="primario" onClick={() => void submit()} disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="texto-suave">
        Só é possível entrar enquanto a sala estiver aguardando jogadores.
      </p>
    </>
  );
}
