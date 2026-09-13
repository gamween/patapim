import { test, expect, type Page } from '@playwright/test'
import { DEMO_VAULT } from '../lib/config'
import type { VaultSnapshot } from '../lib/vault-ui'

let live: VaultSnapshot
const api = `**/api/vault/${DEMO_VAULT}*`
const app = (page: Page) => page.locator('.live-app')
async function ready(page: Page, landing = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(landing ? '/' : `/vault/${DEMO_VAULT}`)
  await expect(app(page)).toHaveAttribute('data-phase', 'ready', {
    timeout: 30000,
  })
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready', {
    timeout: 30000,
  })
}

test.beforeAll(async ({ request }) => {
  const response = await request.get(`/api/vault/${DEMO_VAULT}`)
  expect(response.ok()).toBe(true)
  live = await response.json()
  expect(live.id).toBe(DEMO_VAULT)
  expect(live.network).toBe('XRPL Devnet')
})

test('real ghost intro reveals live ledger tiles instead of project imagery', async ({
  page,
}) => {
  const errors: string[] = [],
    requested: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => requested.push(r.url()))
  await page.goto('/')
  await expect(app(page)).toHaveAttribute('data-phase', 'intro', {
    timeout: 25000,
  })
  await page.screenshot({ path: '../docs/design/live/intro.png' })
  await expect(app(page)).toHaveAttribute('data-phase', 'ready', {
    timeout: 25000,
  })
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready')
  await page.screenshot({ path: '../docs/design/live/grid.png' })
  await page.mouse.move(600, 420)
  await page.mouse.down()
  await page.mouse.move(790, 530, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('.ledger-dialog')).not.toBeVisible()
  await expect(
    page.locator('.footer, .dock, .view-switch, .motion-toggle'),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Replay', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Pitch deck/i })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Good assets. Put to work.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open app', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/vault/${DEMO_VAULT}$`))
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready', {
    timeout: 25000,
  })
  await expect(page.locator('canvas.experience')).toHaveCount(0)
  await expect(page.locator('.ledger-row')).toHaveCount(live.cards.length)
  await expect(
    page.locator('.ledger-row').filter({ hasText: 'NAV per share' }),
  ).toContainText(live.cards.find((c) => c.id === 'price')!.value)
  expect(requested.some((url) => url.includes('/atlases/'))).toBe(false)
  expect(requested.some((url) => url.includes('rippletest.net'))).toBe(false)
  await expect(
    page.getByText(/Phantom references|Reference collection|Visual studies/i),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

test('vault, loan book, phase rules and details work inside the app', async ({
  page,
}) => {
  await ready(page)
  const url = page.url()
  await page.getByRole('button', { name: 'Loans', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Loan book/ })).toBeVisible()
  await expect(page.locator('.loan-row')).toHaveCount(live.loans.length)
  for (const loan of live.loans)
    await expect(
      page.locator('.loan-row').filter({ hasText: loan.borrower.slice(0, 8) }),
    ).toContainText(loan.status)
  await page.getByRole('searchbox').fill('not-a-borrower')
  await expect(page.getByText('No loans match this search.')).toBeVisible()
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  for (const [tx, code] of live.rules.blocked)
    await expect(
      page.locator('.rule-line').filter({ hasText: tx }),
    ).toContainText(code)
  await page.screenshot({ path: '../docs/design/live/rules.png' })
  expect(page.url()).toBe(url)
  await page.getByRole('button', { name: 'Vault', exact: true }).click()
  await page.getByRole('searchbox').fill('provenance')
  await expect(page.locator('.ledger-row')).toHaveCount(1)
  await page.locator('.ledger-row').click()
  await page.locator('.rpc-details summary').first().click()
  await expect(page.locator('.rpc-details pre').first()).toContainText(
    'ledger_entry',
  )
  await page.keyboard.press('Escape')
  await expect(app(page)).toHaveAttribute('data-phase', 'ready', {
    timeout: 25000,
  })
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready')
})

test('API refresh updates open details and phase rules without replay; failure retains a labelled stale snapshot', async ({
  page,
}) => {
  let reads = 0
  // Explicit test-only fixtures simulate phase changes; production only serves real ledger data.
  const updated = structuredClone(live)
  updated.phase = 'investment'
  updated.rules = {
    allowed: ['LoanSet', 'LoanPay'],
    blocked: [['VaultWithdraw', 'tecTOO_SOON']],
  }
  updated.cards.find((c) => c.id === 'assets')!.value = '123,456'
  await page.route(api, (route) => {
    reads++
    return reads === 3
      ? route.fulfill({
          status: 502,
          json: { error: 'Test-only ledger outage' },
        })
      : route.fulfill({ json: reads === 1 ? live : updated })
  })
  await ready(page)
  await page.locator('.ledger-row').filter({ hasText: 'Fund assets' }).first().click()
  await expect(page.locator('.detail-hero strong')).toHaveText('123,456', {
    timeout: 17000,
  })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  await expect(page.locator('.live-rules')).toContainText('tecTOO_SOON')
  await page
    .getByRole('button', { name: 'Refresh ledger', exact: true })
    .click()
  await expect(app(page).getByRole('alert')).toContainText(
    'Showing the last successful ledger snapshot',
  )
  await expect(page.locator('.live-rules')).toContainText('tecTOO_SOON')
  await page.getByRole('button', { name: 'Retry ledger', exact: true }).click()
  await expect(app(page).getByRole('alert')).toHaveCount(0)
  await expect(app(page)).toHaveAttribute('data-phase', 'ready')
})

test('initial data failure shows no invented balances and supports retry', async ({
  page,
}) => {
  let fail = true
  await page.route(api, (route) =>
    fail
      ? route.fulfill({
          status: 502,
          json: { error: 'Test-only unavailable vault' },
        })
      : route.fulfill({ json: live }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/vault/${DEMO_VAULT}`)
  await expect(app(page)).toHaveAttribute('data-phase', 'ready', {
    timeout: 25000,
  })
  await expect(app(page).getByRole('alert')).toContainText(
    'Vault data unavailable',
  )
  await expect(page.locator('.ledger-row')).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry ledger', exact: true }).click()
  await expect(page.locator('.ledger-row')).toHaveCount(live.cards.length)
})

test('failed ghost asset leaves the landing CTA and app usable', async ({
  page,
}) => {
  await page.route('**/dude.glb', (route) => route.abort())
  await ready(page, true)
  await expect(
    page.getByRole('heading', { name: 'Good assets. Put to work.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open app', exact: true }).click()
  await expect(page.locator('.ledger-row')).toHaveCount(live.cards.length)
})

test('400px viewport supports ledger list, rules, dialogs and holder selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 844 })
  await ready(page, true)
  await page.screenshot({ path: '../docs/design/live/mobile-grid.png' })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('link', { name: 'Open app', exact: true }).click()
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready', {
    timeout: 25000,
  })
  await expect(
    page.getByRole('button', { name: 'Choose vault and holder', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '../docs/design/live/mobile-list.png',
    fullPage: true,
  })
  await page.locator('.ledger-row').filter({ hasText: 'Fund phase' }).click()
  await expect(page.locator('.phase-track')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('vault URLs and holder lookup open the app; malformed IDs are rejected', async ({
  page,
  request,
}) => {
  expect((await request.get('/api/vault/invalid')).status()).toBe(400)
  await ready(page)
  await page
    .getByRole('button', { name: 'Choose vault and holder', exact: true })
    .click()
  await page.locator('input[name="holder"]').fill(live.owner)
  await page.getByRole('button', { name: 'Read vault', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/vault/${DEMO_VAULT}\\?holder=`))
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready', {
    timeout: 25000,
  })
  await expect(app(page)).toHaveAttribute('data-phase', 'ready', {
    timeout: 25000,
  })
  await expect(
    page.locator('.ledger-row').filter({ hasText: 'Your position' }),
  ).toBeVisible()
  await expect(page.locator('.page > .nav')).toHaveCount(0)
})

test('result codes keep their case, and every figure on a card comes from the snapshot', async ({
  page,
}) => {
  await ready(page)
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  for (const [, code] of live.rules.blocked)
    await expect(page.locator('.live-rules .code').filter({ hasText: code })).toHaveText(code)
  await page.getByRole('button', { name: 'Vault', exact: true }).click()
  for (const card of live.cards.filter((c) => c.id !== 'provenance' && c.id !== 'phase'))
    await expect(
      page.locator('.ledger-row').filter({ hasText: card.title }).first(),
    ).toContainText(card.value)
})

// Signs a real VaultDeposit from the browser with a published demo key. The keys are read from the
// environment, never from the repository: DEMO_INELIGIBLE_SEED is the account without a credential.
test('the sign tab relays a browser-signed deposit and shows the ledger refusal', async ({
  page,
}) => {
  const seed = process.env.DEMO_INELIGIBLE_SEED
  const fund = process.env.DEMO_OFFERING_VAULT
  test.skip(!seed || !fund, 'set DEMO_INELIGIBLE_SEED and DEMO_OFFERING_VAULT to run')
  const requests: string[] = []
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/vault/${fund}`)
  await expect(app(page)).toHaveAttribute('data-ledger-state', 'ready', { timeout: 30000 })
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await page.getByRole('button', { name: 'No wallet? Use a Devnet demo key', exact: true }).click()
  await page.locator('input[name="seed"]').fill(seed!)
  await page.getByRole('button', { name: 'Load key', exact: true }).click()
  await expect(page.getByText('Signing account, demo key')).toBeVisible({ timeout: 30000 })
  await page.locator('input[name="amount"]').fill('100')
  await page.getByRole('button', { name: 'Sign VaultDeposit', exact: true }).click()
  await expect(page.locator('.sign-result .code')).toHaveText('tecNO_AUTH', { timeout: 60000 })
  await expect(page.locator('.sign-result')).toContainText('no credential')
  // The seed never leaves the browser: no request carries it.
  expect(requests.some((r) => r.includes(seed!))).toBe(false)
  expect(requests.some((r) => r.includes('/api/submit'))).toBe(true)
})

test('the header opens the xrpl-connect wallet modal in the app palette at every width', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const width of [1440, 400]) {
    await page.setViewportSize({ width, height: 900 })
    await ready(page)
    await page.waitForFunction(() => !!customElements.get('xrpl-wallet-connector'))
    const connector = page.locator('.header xrpl-wallet-connector')
    await expect(connector).toHaveCount(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true)
    await page.getByRole('button', { name: 'Sign', exact: true }).click()
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click()
    const modal = await page.waitForFunction(() => {
      const m = document
        .querySelector('[data-xrpl-overlay-portal]')
        ?.shadowRoot?.querySelector('[part~="modal"]')
      if (!m) return null
      const cs = getComputedStyle(m)
      return { bg: cs.backgroundColor, font: cs.fontFamily }
    })
    expect(await modal.jsonValue()).toEqual({
      bg: 'rgb(11, 16, 12)',
      font: '"DM Mono", "Courier New", monospace',
    })
    await page.keyboard.press('Escape')
  }
  // The landing page never loads the wallet bundle: evaluating it defines the custom element.
  const landing = await page.context().newPage()
  await landing.emulateMedia({ reducedMotion: 'reduce' })
  await landing.goto('/')
  await expect(landing.locator('.live-app')).toHaveAttribute('data-ledger-state', 'ready', { timeout: 30000 })
  expect(await landing.evaluate(() => !!customElements.get('xrpl-wallet-connector'))).toBe(false)
  await landing.close()
  expect(errors).toEqual([])
})
