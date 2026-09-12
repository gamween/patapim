import { test, expect } from '@playwright/test'

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'ready',
    { timeout: 30000 },
  )
}

test('desktop intro renders, reveals a draggable gallery, and can be replayed', async ({
  page,
}) => {
  const errors: string[] = []
  const failures: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(response.url())
  })
  await page.goto('/')
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'intro',
    { timeout: 20000 },
  )
  await page.screenshot({ path: '../docs/design/ghost/desktop-intro.png' })
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'ready',
    { timeout: 20000 },
  )
  await expect(page.locator('canvas')).toBeVisible()
  await page.screenshot({ path: '../docs/design/ghost/desktop-gallery.png' })
  await page.mouse.move(600, 450)
  await page.mouse.down()
  await page.mouse.move(850, 620, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('dialog')).not.toBeVisible()
  await page.mouse.click(710, 500)
  await expect(page.locator('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'intro',
    { timeout: 20000 },
  )
  await page.getByRole('button', { name: /SKIP INTRO/ }).click()
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  expect(errors).toEqual([])
  expect(failures).toEqual([])
})

test('search, project details, about, and motion controls work', async ({
  page,
}) => {
  await ready(page)
  await page.getByRole('button', { name: 'List view', exact: true }).click()
  await expect(page.locator('.project-row')).toHaveCount(85)
  await page.getByRole('searchbox').fill('Google')
  await expect(page.locator('.project-row')).toHaveCount(26)
  await page.locator('.project-row').first().click()
  await expect(page.locator('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close reference' }).click()
  await expect(page.locator('dialog')).not.toBeVisible()
  await page.getByRole('searchbox').fill('no-such-project-123')
  await expect(page.getByText(/No reference matches/)).toBeVisible()
  await page.getByRole('button', { name: 'About', exact: true }).click()
  await expect(page.locator('.about h1')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'About', exact: true }),
  ).toHaveClass('active')
  await page.screenshot({ path: '../docs/design/ghost/desktop-about.png' })
  await page.getByRole('button', { name: 'Pause animations' }).click()
  await expect(
    page.getByRole('button', { name: 'Resume animations' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('mobile intro and controls fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 844 })
  await page.goto('/')
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'intro',
    { timeout: 20000 },
  )
  await page.screenshot({ path: '../docs/design/ghost/mobile-intro.png' })
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'ready',
    { timeout: 20000 },
  )
  await page.screenshot({ path: '../docs/design/ghost/mobile-gallery.png' })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'List view', exact: true }).click()
  await page.locator('.project-row').first().click()
  await expect(page.locator('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close reference' }).click()
  await page.getByRole('button', { name: 'About', exact: true }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '../docs/design/ghost/mobile-about.png' })
})

test('reduced motion skips the intro and leaves the archive usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ready(page)
  await expect(
    page.getByRole('button', { name: 'Resume animations' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'List view', exact: true }).click()
  await expect(page.locator('.project-row')).toHaveCount(85)
})

test('failed 3D asset falls back to a usable list without trapping the loader', async ({
  page,
}) => {
  await page.route('**/dude.glb', (route) => route.abort())
  await ready(page)
  await expect(page.locator('.fallback-note')).toBeVisible()
  await expect(page.locator('.project-row')).toHaveCount(85)
  await page
    .getByRole('button', { name: 'Patapim, back to the gallery' })
    .click()
  await expect(page.locator('.project-row')).toHaveCount(85)
})

test('product, ledger dashboard and deck are connected to the full experience', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ready(page)
  await page.getByRole('link', { name: 'Product', exact: true }).click()
  await expect(page).toHaveURL(/\/product$/)
  await expect(
    page.getByRole('heading', { name: 'Good assets. Put to work.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Live vault', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Fixed-term lending vault',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.metrics-grid .tile')).toHaveCount(5)
  await expect(page.locator('.ghost-root')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.getByRole('link', { name: 'Pitch deck', exact: true }).click()
  await expect(page.locator('.slide')).toHaveCount(9)
})

test('direct product and vault access remains available during intro loading', async ({
  page,
}) => {
  await page.route('**/sequences.json', (route) =>
    new Promise((resolve) => setTimeout(resolve, 3000)).then(() =>
      route.continue(),
    ),
  )
  await page.goto('/')
  await expect(page.locator('.ghost-root')).toHaveAttribute(
    'data-phase',
    'loading',
  )
  await expect(
    page
      .getByRole('navigation', { name: 'Direct access' })
      .getByRole('link', { name: 'Live vault', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Direct access' })
    .getByRole('link', { name: 'Product', exact: true })
    .click()
  await expect(page).toHaveURL(/\/product$/)
})

test('the product and ledger retain light/dark layouts at 400px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.goto('/product')
    await expect(
      page.getByRole('heading', { name: 'Good assets. Put to work.' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('link', { name: 'Live vault', exact: true }).click()
    await expect(
      page.getByRole('heading', {
        name: 'Fixed-term lending vault',
        exact: true,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(page.locator('.ghost-root')).toHaveCount(0)
  }
})
