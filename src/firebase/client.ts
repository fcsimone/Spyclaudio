import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
  connectAuthEmulator,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import type { Database } from 'firebase/database';
import { emulatorConfig, firebaseConfig } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let signInPromise: Promise<User> | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (emulatorConfig.enabled) {
      connectAuthEmulator(auth, `http://${emulatorConfig.host}:${emulatorConfig.authPort}`, {
        disableWarnings: true,
      });
    }
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!database) {
    database = getDatabase(getFirebaseApp());
    if (emulatorConfig.enabled) {
      connectDatabaseEmulator(database, emulatorConfig.host, emulatorConfig.databasePort);
    }
  }
  return database;
}

/**
 * Identidade anônima e efêmera: `inMemoryPersistence` garante que o UID
 * desaparece ao recarregar a página, como exige o plano do MVP.
 */
export async function ensureAnonymousUser(): Promise<User> {
  if (!signInPromise) {
    signInPromise = (async () => {
      const instance = getFirebaseAuth();
      await setPersistence(instance, inMemoryPersistence);
      if (instance.currentUser) return instance.currentUser;
      const credential = await signInAnonymously(instance);
      return credential.user;
    })().catch((error: unknown) => {
      signInPromise = null;
      throw error;
    });
  }
  return signInPromise;
}
