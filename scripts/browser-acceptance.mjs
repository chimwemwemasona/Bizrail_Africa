/* global navigator, localStorage, document, window */
import { URL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import console from 'node:console';
import process from 'node:process';
const base = process.env.BIZRAIL_TEST_URL ?? 'http://127.0.0.1:3000';
const output = new URL('../storage/acceptance/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const reports = [];
const username = `browser_${randomBytes(5).toString('hex')}`,
  password = randomBytes(16).toString('hex');
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
let page = await ctx.newPage();
const watch = (p) => p.on('pageerror', (error) => errors.push(error.message));
watch(page);
async function login(p, user, pass, create = false) {
  await p.goto(base);
  if (create)
    await p
      .getByRole('button', {
        name: 'Create a demo workspace',
        exact: true,
      })
      .click();
  if (create)
    await p
      .getByLabel('Business name', { exact: true })
      .fill('Acceptance test business');
  await p.getByLabel('Username', { exact: true }).fill(user);
  await p.getByLabel('Password', { exact: true }).fill(pass);
  await p
    .getByRole('button', {
      name: create ? 'Create & enrol device' : 'Sign in & enrol device',
      exact: true,
    })
    .click();
  await expect(
    p.getByRole('heading', { name: 'Your business, at a glance.' }),
  ).toBeVisible({ timeout: 30000 });
  await expect(p.getByText('Offline app ready', { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await expect(p.getByText('Sync complete.', { exact: false })).toBeVisible({
    timeout: 30000,
  });
}
async function capture(p, kind, description, amount) {
  await p.getByRole('button', { name: kind, exact: true }).click();
  await p.getByLabel('Description', { exact: true }).fill(description);
  if (kind === 'Sale') {
    await p.locator('select[name="productId"]').selectOption({ index: 1 });
    await p.getByLabel('Quantity', { exact: true }).fill('1');
    await p.getByLabel('Unit price (ZMW)', { exact: true }).fill(amount);
  } else await p.getByLabel('Amount (ZMW)', { exact: true }).fill(amount);
  await p.getByRole('button', { name: 'Save on device', exact: true }).click();
  await expect(p.getByRole('status')).toContainText('saved on this device');
}
try {
  await login(page, username, password, true);
  const manifest = await (
    await ctx.request.get(base + '/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const cdp = await ctx.newCDPSession(page);
  expect(
    (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,
  ).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your business, at a glance.' }),
  ).toBeVisible();
  await page.screenshot({
    path: new URL('overview-desktop.png', output).pathname.replace(
      /^\/(\w:)/,
      '$1',
    ),
    fullPage: true,
  });
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  for (let i = 0; i < 10; i++)
    await capture(page, 'Sale', `Offline sale ${i + 1}`, '10');
  for (let i = 0; i < 2; i++)
    await capture(page, 'Expense', `Offline expense ${i + 1}`, '5');
  await page.reload();
  await expect(page.getByTestId('sales-total')).toHaveText('K 100.00');
  await expect(page.getByTestId('expenses-total')).toHaveText('K 10.00');
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(page.getByTestId('stock-quantity')).toHaveText('90 units');
  await page.getByRole('button', { name: 'Ledger', exact: true }).click();
  await expect(
    page.getByText('Net balance: K 0.00', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: new URL('offline-ledger.png', output).pathname.replace(
      /^\/(\w:)/,
      '$1',
    ),
    fullPage: true,
  });
  await page.close();
  page = await ctx.newPage();
  watch(page);
  await page.goto(base);
  await expect(page.getByTestId('sales-total')).toHaveText('K 100.00');
  reports.push(
    'Ten sales and two expenses retain correct stock/ledger totals after offline reload and tab reopen.',
  );
  let lost;
  const dropped = new Promise((resolve) => {
    lost = resolve;
  });
  let savedRequest;
  await page.route('**/api/workspace/push', async (route) => {
    if (!savedRequest) {
      savedRequest = {
        body: route.request().postDataJSON(),
        token: route.request().headers()['x-device-token'],
      };
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort('failed');
      lost();
    } else await route.continue();
  });
  await ctx.setOffline(false);
  await dropped;
  for (let i = 0; i < 10; i++) {
    const response = await ctx.request.post(base + '/api/workspace/push', {
      headers: {
        'x-bizrail-request': '1',
        'x-device-token': savedRequest.token,
      },
      data: savedRequest.body,
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).every((r) => r.state === 'accepted')).toBe(
      true,
    );
  }
  await page.unroute('**/api/workspace/push');
  await expect(
    page.locator('header').getByRole('button', { name: /^Sync/ }),
  ).toBeEnabled();
  await page.locator('header').getByRole('button', { name: /^Sync/ }).click();
  await expect(
    page.getByText('0 pending · Last sync:', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('sales-total')).toHaveText('K 100.00');
  await expect(page.getByTestId('expenses-total')).toHaveText('K 10.00');
  reports.push(
    'Lost acknowledgement retried ten times without duplicate totals or financial effects.',
  );
  const ctx2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    second = await ctx2.newPage();
  watch(second);
  await login(second, username, password);
  await second.getByRole('button', { name: 'Open navigation' }).click();
  await second.getByRole('button', { name: 'Capture', exact: true }).click();
  await ctx2.setOffline(true);
  await capture(second, 'Expense', 'Revoked test expense', '7');
  const device = await second.evaluate(
    () => JSON.parse(localStorage.getItem('bizrail.active')).deviceId,
  );
  await page
    .getByRole('button', { name: 'Sync & devices', exact: true })
    .click();
  await page.getByRole('button', { name: 'Refresh administration' }).click();
  page.once('dialog', (dialog) => dialog.accept('Acceptance revoked device'));
  await page
    .getByText(device, { exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Revoke', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Device revoked');
  await ctx2.setOffline(false);
  await expect(
    second.getByText('This device has been revoked.', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await ctx2.setOffline(true);
  await second.reload();
  await expect(
    second.getByText('This device has been revoked.', { exact: false }),
  ).toBeVisible();
  expect(
    await second.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await second.screenshot({
    path: new URL('mobile-quarantine.png', output).pathname.replace(
      /^\/(\w:)/,
      '$1',
    ),
    fullPage: true,
  });
  reports.push(
    'Revoked-device upload is quarantined and retained after offline reload; mobile has no horizontal overflow.',
  );
  const reviewer = `review_${randomBytes(5).toString('hex')}`,
    reviewPassword = randomBytes(16).toString('hex');
  const created = await ctx.request.post(base + '/api/workspace/reviewer', {
    headers: { 'x-bizrail-request': '1' },
    data: { username: reviewer, password: reviewPassword },
  });
  expect(created.ok()).toBe(true);
  const ctx3 = await browser.newContext(),
    third = await ctx3.newPage();
  watch(third);
  await login(third, reviewer, reviewPassword);
  await third
    .getByRole('button', { name: 'Sync & devices', exact: true })
    .click();
  await third.getByRole('button', { name: 'Refresh administration' }).click();
  third.once('dialog', (dialog) =>
    dialog.accept('Source verified by independent reviewer'),
  );
  await third
    .getByRole('button', { name: 'Approve & post', exact: true })
    .click();
  await expect(third.getByRole('status')).toContainText(
    /Review recorded|Sync complete/,
  );
  await third.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(third.getByTestId('expenses-total')).toHaveText('K 17.00', {
    timeout: 30000,
  });
  reports.push(
    'Independent authorised review posts preserved work once while keeping original quarantine evidence.',
  );
  expect(errors).toEqual([]);
  reports.push(
    'No browser page errors; manifest, service worker and Chromium PWA installability verified (no installability errors).',
  );
  await writeFile(
    new URL('browser-report.json', output),
    JSON.stringify({ at: new Date().toISOString(), reports, errors }, null, 2),
  );
  console.log(reports.join('\n'));
  await ctx2.close();
  await ctx3.close();
} finally {
  await browser.close();
}
