import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { copy, loadModel } from './model-copy'

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement)
}

/** Moves focus with the keyboard only, the way a handheld user would. */
async function tabTo(page: Page, target: Locator, options: { shift?: boolean; max?: number } = {}): Promise<void> {
  const key = options.shift ? 'Shift+Tab' : 'Tab'
  for (let step = 0; step < (options.max ?? 60); step += 1) {
    if (await isFocused(target)) return
    await page.keyboard.press(key)
  }
  throw new Error(`Keyboard focus never reached ${String(target)}`)
}

for (const width of [320, 390, 768, 1280]) {
  test(`queue, order detail and returns fit within ${width} px`, async ({ page }) => {
    const model = await loadModel(page)
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: copy(model, 'page.queue.title') })).toBeVisible()
    expect(await horizontalOverflow(page), 'queue overflow').toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: /FO-48277/ }).click()
    await expect(page.getByRole('heading', { name: 'FO-48277' })).toBeVisible()
    expect(await horizontalOverflow(page), 'detail overflow').toBeLessThanOrEqual(0)

    await page
      .getByRole('navigation', { name: copy(model, 'navigation.primary') })
      .filter({ visible: true })
      .getByRole('button', { name: copy(model, 'navigation.returns') })
      .click()
    await expect(page.getByRole('button', { name: /FO-48186/ })).toBeVisible()
    expect(await horizontalOverflow(page), 'returns overflow').toBeLessThanOrEqual(0)
  })
}

test('core handheld controls are at least 44 px tall at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  const row = page.getByRole('button', { name: /FO-48262/ })
  await expect(row).toBeVisible()
  const rowBox = await row.boundingBox()
  await row.click()
  await expect(page.getByRole('heading', { name: 'FO-48262' })).toBeVisible()

  const controls = page.locator('.detail-panel.mobile-visible').locator('button:visible')
  const heights: Array<{ name: string; height: number }> = []
  for (const control of await controls.all()) {
    const box = await control.boundingBox()
    const name = (await control.getAttribute('aria-label')) ?? (await control.innerText())
    heights.push({ name, height: box?.height ?? 0 })
  }

  expect(rowBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(heights.length).toBeGreaterThan(0)
  expect(heights.filter((entry) => entry.height < 44)).toEqual([])
})

test('a picker opens an order, picks a unit and goes back using only the keyboard at 320 px', async ({ page }) => {
  const model = await loadModel(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  const row = page.getByRole('button', { name: /FO-48277/ })
  await expect(row).toBeVisible()
  await expect(page.getByLabel(copy(model, 'role.simulation'))).toHaveValue('picker')

  await tabTo(page, row)
  expect(await row.evaluate((element) => getComputedStyle(element).outlineStyle), 'visible focus ring').not.toBe('none')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'FO-48277' })).toBeFocused()

  const lamp = model.data.itemNames['LMP-406']
  const organizer = model.data.itemNames['ORG-044']
  await tabTo(page, page.getByRole('button', { name: copy(model, 'page.orderDetails.pickOne', { item: lamp }) }))
  await page.keyboard.press('Enter')

  await expect(page.getByRole('status')).toContainText(
    copy(model, 'notice.pickProgress', { item: lamp, picked: 1, ordered: 1, remaining: 0 }),
  )
  await expect(
    page.getByRole('button', { name: copy(model, 'page.orderDetails.pickOne', { item: organizer }) }),
  ).toBeFocused()

  const back = page.getByRole('button', { name: copy(model, 'action.backToQueue') })
  await tabTo(page, back, { shift: true })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /FO-48277/ })).toBeFocused()
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
})

test('the awaiting-confirmation banner fits and has 44 px controls at 320 px', async ({ page }) => {
  const model = await loadModel(page)
  await page.route('**/api/v1/orders/FO-48175/actions', (route) => route.abort('connectionreset'))
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  const profile = page.getByLabel(copy(model, 'role.simulation'))
  await profile.selectOption('warehouse_manager')
  await expect(profile).toHaveValue('warehouse_manager')
  await page.getByRole('button', { name: /FO-48175/ }).click()
  await page.getByRole('button', { name: copy(model, 'action.allocate.button') }).click()

  const banner = page.getByRole('alert').filter({ hasText: copy(model, 'awaiting.title') })
  await expect(banner).toBeVisible()
  expect(await horizontalOverflow(page), 'banner overflow').toBeLessThanOrEqual(0)
  for (const key of ['awaiting.retry', 'awaiting.discard']) {
    const box = await banner.getByRole('button', { name: copy(model, key) }).boundingBox()
    expect(box?.height ?? 0, key).toBeGreaterThanOrEqual(44)
  }
  await banner.getByRole('button', { name: copy(model, 'awaiting.discard') }).click()
  await expect(banner).toHaveCount(0)
})
