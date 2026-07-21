import { useState } from 'react';
import { BackLink, Card, ErrorMessage } from '../components/ui';
import { navigate } from '../app/router';
import { CAPACITY } from '../game/types';
import type { SpyCount } from '../game/types';
import { sanitizeName, validateName } from '../game/names';
import { ensureAnonymousUser } from '../firebase/client';
import { createRoom } from '../firebase/rooms';
import { useSession } from '../app/SessionContext';

export function CreateRoomScreen() {
  const { setSession } = useSession();
  const [name, setName] = useState('');
  const [spyCount, setSpyCount] = useState<SpyCount>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
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
      const code = await createRoom({ hostUid: user.uid, hostName: clean, spyCount });
      setSession({ code, uid: user.uid, name: clean, isHost: true });
      navigate({ name: 'sala', code });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível criar a sala: ${cause.message}`
          : 'Não foi possível criar a sala.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink onClick={() => navigate({ name: 'inicio' })} />
      <h1>Criar sala</h1>

      <Card>
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
          De {CAPACITY[spyCount].min} a {CAPACITY[spyCount].max} jogadores, incluindo você.
        </p>
      </Card>

      <ErrorMessage>{error}</ErrorMessage>

      <button type="button" className="primario" onClick={() => void submit()} disabled={busy}>
        {busy ? 'Criando…' : 'Criar sala'}
      </button>
      <p className="texto-suave">
        Se você recarregar ou fechar a página, a sala é interrompida. Não há como voltar nesta versão.
      </p>
    </>
  );
}
