/**
 * Configuração pública do Firebase Web SDK.
 * Estes valores não são segredos (ficam expostos em qualquer app web);
 * a proteção real vem de database.rules.json.
 * Podem ser sobrescritos por variáveis de ambiente (ver .env.example).
 */
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBZUC6_lOZZuPc3ZS1wDnv34ZElgzcnpKA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'spyclaudio-b8252.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'spyclaudio-b8252',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? 'https://spyclaudio-b8252-default-rtdb.firebaseio.com/',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'spyclaudio-b8252.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '364125981326',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:364125981326:web:5e58c2222791b8c4bf97df',
};

export const emulatorConfig = {
  enabled: env.VITE_USE_EMULATORS === 'true',
  host: env.VITE_EMULATOR_HOST ?? '127.0.0.1',
  databasePort: Number(env.VITE_DATABASE_EMULATOR_PORT ?? 9000),
  authPort: Number(env.VITE_AUTH_EMULATOR_PORT ?? 9099),
};
