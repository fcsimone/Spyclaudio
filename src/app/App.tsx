import { SessionProvider } from './SessionContext';
import { useRoute } from './router';
import { HomeScreen } from '../screens/HomeScreen';
import { RulesScreen } from '../screens/RulesScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { SingleDeviceScreen } from '../screens/SingleDeviceScreen';
import { CreateRoomScreen } from '../screens/CreateRoomScreen';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { RoomScreen } from '../screens/RoomScreen';

function Routes() {
  const route = useRoute();

  switch (route.name) {
    case 'regras':
      return <RulesScreen />;
    case 'privacidade':
      return <PrivacyScreen />;
    case 'um-aparelho':
      return <SingleDeviceScreen />;
    case 'criar':
      return <CreateRoomScreen />;
    case 'entrar':
      return <JoinRoomScreen initialCode={route.code} />;
    case 'sala':
      return <RoomScreen code={route.code} />;
    default:
      return <HomeScreen />;
  }
}

export function App() {
  return (
    <SessionProvider>
      <main className="app">
        <Routes />
      </main>
    </SessionProvider>
  );
}
