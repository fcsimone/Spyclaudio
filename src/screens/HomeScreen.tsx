import { Card } from '../components/ui';
import { navigate } from '../app/router';

export function HomeScreen() {
  return (
    <>
      <header>
        <h1>Spyclaudio</h1>
        <p className="texto-suave">
          Jogo de dedução para jogar presencialmente. Todos conhecem o local, menos o espião.
        </p>
      </header>

      <Card>
        <h2>Como vocês vão jogar?</h2>
        <button type="button" className="primario" onClick={() => navigate({ name: 'um-aparelho' })}>
          Um aparelho
          <br />
          <span className="texto-suave">Passem o mesmo celular entre os jogadores</span>
        </button>
        <button type="button" onClick={() => navigate({ name: 'criar' })}>
          Vários aparelhos
          <br />
          <span className="texto-suave">Cada jogador usa o próprio celular</span>
        </button>
        <button type="button" className="discreto" onClick={() => navigate({ name: 'entrar', code: '' })}>
          Já tenho um código de sala
        </button>
      </Card>

      <nav className="rodape">
        <button type="button" className="discreto" onClick={() => navigate({ name: 'regras' })}>
          Regras
        </button>
        <button type="button" className="discreto" onClick={() => navigate({ name: 'privacidade' })}>
          Privacidade
        </button>
      </nav>
    </>
  );
}
