import { initializeApp, deleteApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, goOffline } from 'firebase/database';
import type { Database } from 'firebase/database';

/**
 * Cada "jogador" é um app Firebase separado, com a própria identidade anônima.
 * É assim que conseguimos exercitar as regras como vários usuários distintos
 * dentro do mesmo processo de teste.
 */
export interface TestPlayer {
  readonly app: FirebaseApp;
  readonly db: Database;
  readonly uid: string;
  readonly label: string;
}

const HOST = process.env['DATABASE_EMULATOR_HOST'] ?? '127.0.0.1:9000';
const [dbHost, dbPort] = HOST.split(':');
const AUTH_HOST = process.env['AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';

/**
 * O namespace precisa ser o mesmo que o emulador configurou a partir do
 * firebase.json — é nele que as regras estão carregadas. Num namespace
 * qualquer o emulador cria um banco novo, sem regra nenhuma, e o teste passa
 * a validar nada.
 */
const NAMESPACE = 'spyclaudio-b8252-default-rtdb';

const config = {
  apiKey: 'fake-api-key',
  authDomain: 'spyclaudio-b8252.firebaseapp.com',
  projectId: 'spyclaudio-b8252',
  databaseURL: `http://${dbHost}:${dbPort}?ns=${NAMESPACE}`,
  appId: '1:000:web:000',
};

let counter = 0;

export async function createTestPlayer(label: string): Promise<TestPlayer> {
  counter += 1;
  const app = initializeApp(config, `test-${label}-${counter}`);

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const credential = await signInAnonymously(auth);

  const db = getDatabase(app);
  connectDatabaseEmulator(db, dbHost ?? '127.0.0.1', Number(dbPort ?? 9000));

  return { app, db, uid: credential.user.uid, label };
}

export async function destroyTestPlayers(players: readonly TestPlayer[]): Promise<void> {
  for (const player of players) {
    goOffline(player.db);
    await deleteApp(player.app).catch(() => undefined);
  }
}
