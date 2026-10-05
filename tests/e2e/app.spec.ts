import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Fail the test if anything is requested from another origin (no ads, analytics or CDNs). */
async function forbidThirdParty(page: Page): Promise<string[]> {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'))
      external.push(req.url());
  });
  return external;
}

async function axe(page: Page) {
  // Let entrance animations settle so contrast is measured on the final state.
  await page.waitForTimeout(400);
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function dropFile(page: Page, name: string, bytes: Buffer) {
  const handle = await page.evaluateHandle(
    ({ name, data }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], name));
      return dt;
    },
    { name, data: [...bytes] },
  );
  const stage = page.locator('main.stage');
  await stage.dispatchEvent('dragenter', { dataTransfer: handle });
  await stage.dispatchEvent('drop', { dataTransfer: handle });
}

async function loadExample(page: Page) {
  await page.getByRole('button', { name: 'Try the example map' }).first().click();
  await expect(page.locator('.file-status')).toContainText('Example map', { timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('ckmt:settings', JSON.stringify({ v: 1, data: { lang: 'en' } })),
  );
});

test('empty state explains the tool and is accessible', async ({ page }) => {
  const external = await forbidThirdParty(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Open your Core Keeper map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose map file' }).first()).toBeVisible();
  await page.getByText('Where is my map file?').click();
  await expect(page.getByRole('textbox', { name: 'Windows (Steam)' }).first()).toHaveValue(/USERPROFILE/);
  expect(await axe(page)).toEqual([]);
  expect(external).toEqual([]);
});

test('loads the example map, renders and reports progress', async ({ page, isMobile }) => {
  const external = await forbidThirdParty(page);
  await page.goto('/');
  await loadExample(page);
  await expect(page.getByRole('status').filter({ hasText: 'Map loaded' })).toBeVisible();
  // First load opens the Layers panel as the next step where it docks beside the map.
  if (!isMobile) await expect(page.locator('#panel-title')).toHaveText('Layers');
  const canvas = page.locator('canvas.map-canvas');
  const size = await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[0]).toBeGreaterThan(300);
  expect(external).toEqual([]);
});

test('turning on bosses shows labelled rings and stays accessible', async ({ page, isMobile }) => {
  await page.goto('/');
  await loadExample(page);
  if (isMobile) await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.locator('.group > .check-row label', { hasText: /^Bosses/ }).click();
  await expect(page.locator('.map-label', { hasText: 'Glurch the Abominous Mass' })).toBeAttached();
  expect(await axe(page)).toEqual([]);
});

test('finds tiles by search and shows counts', async ({ page, isMobile }) => {
  await page.goto('/');
  await loadExample(page);
  await page.getByRole('button', { name: 'Tiles', exact: true }).click();
  await page.getByRole('searchbox').fill('scarlet');
  const row = page.locator('.tile-list .check-row', { hasText: 'Scarlet Ore' }).first();
  await expect(row).toContainText('11,026');
  await row.locator('label').click();
  await expect(page.locator('.selection-bar')).toContainText('1 highlighted');
  if (!isMobile) expect(await axe(page)).toEqual([]);
});

test('explains a wrong file instead of failing silently', async ({ page }) => {
  await page.goto('/');
  await dropFile(page, '5.world.gzip', readFileSync('tests/fixtures/wrong.world.gzip'));
  await expect(page.getByRole('alert')).toContainText('world file');
});

test('switches language without reloading', async ({ page, isMobile }) => {
  test.skip(isMobile, 'covered on desktop');
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('de');
  await expect(page.getByRole('heading', { name: 'Öffne deine Core-Keeper-Karte' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('keyboard: shortcuts sheet and command palette', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard on desktop');
  await page.goto('/');
  await loadExample(page);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Search tiles, bosses and actions' });
  await expect(box).toBeFocused();
  await box.fill('ghorm');
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-label', { hasText: 'Ghorm the Devourer' })).toBeAttached();
});
