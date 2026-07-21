import { BackLink, Card } from '../components/ui';
import { navigate } from '../app/router';

export function PrivacyScreen() {
  return (
    <>
      <BackLink onClick={() => navigate({ name: 'inicio' })} />
      <h1>Privacidade</h1>

      <Card>
        <h2>O que o Spyclaudio guarda</h2>
        <ul>
          <li>No modo de um aparelho, nada sai do seu navegador.</li>
          <li>
            No modo com vários aparelhos, ficam salvos apenas o apelido escolhido, os papéis da
            partida e os votos, enquanto a sala existir.
          </li>
          <li>Não pedimos e-mail, telefone, cadastro ou qualquer dado pessoal.</li>
        </ul>
      </Card>

      <Card>
        <h2>Identificação temporária</h2>
        <p>
          Usamos uma identidade anônima do Firebase que existe apenas na memória da aba. Ao recarregar
          ou fechar a página, ela desaparece e não é possível voltar para a partida.
        </p>
        <p>Nada é gravado no armazenamento do navegador.</p>
      </Card>

      <Card>
        <h2>Limitação conhecida</h2>
        <p>
          O sorteio é feito no navegador do anfitrião. Tecnicamente, o anfitrião consegue inspecionar
          as atribuições com ferramentas de desenvolvedor. Jogue com pessoas em quem confia.
        </p>
      </Card>
    </>
  );
}
