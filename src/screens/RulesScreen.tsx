import { BackLink, Card } from '../components/ui';
import { navigate } from '../app/router';

export function RulesScreen() {
  return (
    <>
      <BackLink onClick={() => navigate({ name: 'inicio' })} />
      <h1>Regras</h1>

      <Card>
        <h2>Objetivo</h2>
        <p>
          Cada jogador recebe um local e um papel dentro dele. Um ou dois jogadores são espiões: eles
          não sabem qual é o local.
        </p>
        <p>
          Os jogadores conversam e fazem perguntas uns aos outros. Quem não é espião tenta descobrir
          quem é. O espião tenta passar despercebido e deduzir o local.
        </p>
      </Card>

      <Card>
        <h2>Como a partida corre</h2>
        <ol>
          <li>Todos veem o próprio papel em segredo.</li>
          <li>A conversa começa. Não há cronômetro nessa fase.</li>
          <li>Quando o anfitrião decidir, começa a votação, com 3 minutos de prazo.</li>
          <li>Cada jogador vota uma única vez. O voto não pode ser alterado.</li>
          <li>O resultado revela o local, todos os papéis e todos os espiões.</li>
        </ol>
      </Card>

      <Card>
        <h2>Detalhes importantes</h2>
        <ul>
          <li>Com 1 espião: de 3 a 8 jogadores. Com 2 espiões: de 4 a 9 jogadores.</li>
          <li>Espiões não sabem quem é o outro espião.</li>
          <li>Votos de espiões são registrados, mas não contam na apuração.</li>
          <li>Empate na maior votação significa que ninguém foi escolhido.</li>
          <li>Não há segunda votação.</li>
          <li>Quem não votar até o prazo fica fora da contagem.</li>
          <li>No modo de um aparelho não há votação pelo app: decidam na conversa.</li>
        </ul>
      </Card>
    </>
  );
}
