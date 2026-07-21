import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Fluxos com vários aparelhos. Exigem os emuladores Firebase e um build feito
 * com VITE_USE_EMULATORS=true. Rode com `npm run test:e2e:online`.
 */
const online = process.env['E2E_ONLINE'] === 'true';
test.skip(!online, 'Defina E2E_ONLINE=true e rode com os emuladores Firebase ativos.');

async function createRoom(page: Page, hostName: string, spies: 1 | 2 = 1): Promise<string> {
  await page.goto('./#/criar');
  await page.getByLabel('Seu nome').fill(hostName);
  if (spies === 2) await page.getByRole('button', { name: '2 espiões' }).click();
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible({ timeout: 15_000 });
  const heading = await page.getByRole('heading', { name: /^Sala / }).textContent();
  return (heading ?? '').replace('Sala ', '').trim();
}

async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`./#/entrar/${code}`);
  await page.getByLabel('Seu nome').fill(name);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible({ timeout: 15_000 });
}

test('partida completa com anfitrião e três participantes', async ({ browser }) => {
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const [host, p1, p2, p3] = await Promise.all(contexts.map((context) => context.newPage()));

  const code = await createRoom(host!, 'Ana');
  await joinRoom(p1!, code, 'Bia');
  await joinRoom(p2!, code, 'Caio');
  await joinRoom(p3!, code, 'Duda');

  await expect(host!.getByRole('heading', { name: 'Jogadores 4/8' })).toBeVisible();

  // O QR Code aponta para a URL de entrada correta.
  const qr = host!.getByRole('img', { name: new RegExp(`entrar na sala ${code}`) });
  await expect(qr).toBeVisible();

  await host!.getByRole('button', { name: 'Iniciar partida' }).click();

  const pages = [host!, p1!, p2!, p3!];
  let spies = 0;
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Seu papel' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Revelar meu papel' }).click();
    if (await page.getByText('Você é o espião').isVisible()) spies += 1;
  }
  expect(spies).toBe(1);

  await host!.getByRole('button', { name: 'Iniciar votação' }).click();

  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Votação' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Bia/ }).first().click();
    await page.getByRole('button', { name: 'Votar' }).click();
    await page.getByRole('button', { name: 'Confirmar voto' }).click();
    await expect(page.getByText('Voto registrado')).toBeVisible({ timeout: 15_000 });
  }

  // Resultado idêntico em todos os aparelhos.
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Espiões' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Papéis' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Votos' })).toBeVisible();
  }

  await Promise.all(contexts.map((context) => context.close()));
});

test('nome duplicado é recusado na entrada', async ({ browser }) => {
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [host, p1, p2] = await Promise.all(contexts.map((context) => context.newPage()));

  const code = await createRoom(host!, 'Ana');
  await joinRoom(p1!, code, 'Bia');

  await p2!.goto(`./#/entrar/${code}`);
  await p2!.getByLabel('Seu nome').fill('bia');
  await p2!.getByRole('button', { name: 'Entrar' }).click();
  await expect(p2!.getByRole('alert')).toContainText(/já está em uso/, { timeout: 15_000 });

  await Promise.all(contexts.map((context) => context.close()));
});

test('não é possível entrar depois que a partida começa', async ({ browser }) => {
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const [host, p1, p2, tarde] = await Promise.all(contexts.map((context) => context.newPage()));

  const code = await createRoom(host!, 'Ana');
  await joinRoom(p1!, code, 'Bia');
  await joinRoom(p2!, code, 'Caio');
  await host!.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(host!.getByRole('heading', { name: 'Seu papel' })).toBeVisible({ timeout: 15_000 });

  await tarde!.goto(`./#/entrar/${code}`);
  await tarde!.getByLabel('Seu nome').fill('Duda');
  await tarde!.getByRole('button', { name: 'Entrar' }).click();
  await expect(tarde!.getByRole('alert')).toContainText(/já começou/, { timeout: 15_000 });

  await Promise.all(contexts.map((context) => context.close()));
});

test('recarregar a página perde o acesso à partida', async ({ browser }) => {
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [host, p1, p2] = await Promise.all(contexts.map((context) => context.newPage()));

  const code = await createRoom(host!, 'Ana');
  await joinRoom(p1!, code, 'Bia');
  await joinRoom(p2!, code, 'Caio');

  await p1!.reload();
  await expect(p1!.getByRole('status')).toContainText(/Não é possível voltar/, { timeout: 15_000 });

  await Promise.all(contexts.map((context) => context.close()));
});

test('dois espiões são revelados no resultado', async ({ browser }) => {
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const [host, p1, p2, p3] = await Promise.all(contexts.map((context) => context.newPage()));

  const code = await createRoom(host!, 'Ana', 2);
  await joinRoom(p1!, code, 'Bia');
  await joinRoom(p2!, code, 'Caio');
  await joinRoom(p3!, code, 'Duda');

  await host!.getByRole('button', { name: 'Iniciar partida' }).click();
  const pages = [host!, p1!, p2!, p3!];
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Seu papel' })).toBeVisible({ timeout: 15_000 });
  }

  await host!.getByRole('button', { name: 'Iniciar votação' }).click();
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Votação' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Ana/ }).first().click();
    await page.getByRole('button', { name: 'Votar' }).click();
    await page.getByRole('button', { name: 'Confirmar voto' }).click();
  }

  await expect(host!.getByRole('heading', { name: 'Resultado' })).toBeVisible({ timeout: 20_000 });
  const spyList = host!.getByRole('heading', { name: 'Espiões' }).locator('xpath=../ul/li');
  await expect(spyList).toHaveCount(2);

  await Promise.all(contexts.map((context) => context.close()));
});
