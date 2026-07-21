import { expect, test } from '@playwright/test';

/** Fluxo completo do modo de um aparelho — não depende de Firebase. */
test.describe('modo um aparelho', () => {
  test('partida completa com 4 jogadores e 1 espião', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Um aparelho/ }).click();

    const names = ['Ana', 'Bia', 'Caio', 'Duda'];
    for (const name of names) {
      await page.getByLabel('Nome do jogador').fill(name);
      await page.getByRole('button', { name: 'Adicionar' }).click();
    }
    await expect(page.getByRole('heading', { name: /Jogadores \(4\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sortear papéis' }).click();

    let spies = 0;
    for (const name of names) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: `Sou ${name}` }).click();
      // Tela neutra antes de revelar: nada de papel visível.
      await expect(page.getByRole('button', { name: 'Revelar meu papel' })).toBeVisible();
      await page.getByRole('button', { name: 'Revelar meu papel' }).click();

      if (await page.getByText('Você é o espião').isVisible()) spies += 1;
      await page.getByRole('button', { name: 'Ocultar e passar adiante' }).click();
    }

    expect(spies).toBe(1);
    await expect(page.getByRole('heading', { name: 'Tudo pronto' })).toBeVisible();
  });

  test('bloqueia início com jogadores de menos', async ({ page }) => {
    await page.goto('./#/um-aparelho');
    await page.getByLabel('Nome do jogador').fill('Ana');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('button', { name: 'Sortear papéis' })).toBeDisabled();
    await expect(page.getByText(/pelo menos 3 jogadores/)).toBeVisible();
  });

  test('recusa nomes repetidos ignorando acento e caixa', async ({ page }) => {
    await page.goto('./#/um-aparelho');
    await page.getByLabel('Nome do jogador').fill('João');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByLabel('Nome do jogador').fill('joao');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('alert')).toContainText('já foi cadastrado');
  });

  test('dois espiões exigem no mínimo 4 jogadores', async ({ page }) => {
    await page.goto('./#/um-aparelho');
    await page.getByRole('button', { name: '2 espiões' }).click();
    for (const name of ['Ana', 'Bia', 'Caio']) {
      await page.getByLabel('Nome do jogador').fill(name);
      await page.getByRole('button', { name: 'Adicionar' }).click();
    }
    await expect(page.getByRole('button', { name: 'Sortear papéis' })).toBeDisabled();

    await page.getByLabel('Nome do jogador').fill('Duda');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('button', { name: 'Sortear papéis' })).toBeEnabled();
  });

  test('nenhum papel secreto vaza no título da página', async ({ page }) => {
    await page.goto('./#/um-aparelho');
    for (const name of ['Ana', 'Bia', 'Caio']) {
      await page.getByLabel('Nome do jogador').fill(name);
      await page.getByRole('button', { name: 'Adicionar' }).click();
    }
    await page.getByRole('button', { name: 'Sortear papéis' }).click();
    await page.getByRole('button', { name: 'Sou Ana' }).click();
    await page.getByRole('button', { name: 'Revelar meu papel' }).click();
    await expect(page).toHaveTitle('Spyclaudio');
  });
});

test.describe('navegação e conteúdo', () => {
  test('regras e privacidade acessíveis a partir da tela inicial', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Regras' }).click();
    await expect(page.getByRole('heading', { name: 'Regras', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: '← Voltar' }).click();
    await page.getByRole('button', { name: 'Privacidade' }).click();
    await expect(page.getByRole('heading', { name: 'Privacidade', level: 1 })).toBeVisible();
  });

  test('funciona em 320 px sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
