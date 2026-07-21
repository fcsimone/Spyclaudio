import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

// jsdom nem sempre expõe crypto.getRandomValues; o motor do jogo depende dele.
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
