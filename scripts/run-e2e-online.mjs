#!/usr/bin/env node
/**
 * Executa os testes E2E com vários aparelhos apontando para os emuladores.
 * Chamado por `npm run test:e2e:online`, já dentro de `firebase emulators:exec`.
 */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  E2E_ONLINE: 'true',
  VITE_USE_EMULATORS: 'true',
  VITE_EMULATOR_HOST: '127.0.0.1',
  VITE_DATABASE_EMULATOR_PORT: '9000',
  VITE_AUTH_EMULATOR_PORT: '9099',
};

const result = spawnSync(
  'npx',
  ['playwright', 'test', '--project=android-chrome', 'tests/e2e/multi-device.spec.ts'],
  { stdio: 'inherit', env, shell: process.platform === 'win32' },
);

process.exit(result.status ?? 1);
