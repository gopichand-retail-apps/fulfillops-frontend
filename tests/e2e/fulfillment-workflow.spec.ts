import { expect, test } from '@playwright/test'

const expectedDataMode = process.env.VITE_IS_MOCK === 'false' ? 'live' : 'mock'
const selectedApiBaseUrl = 'http://127.0.0.1:5212/api/v1'
const unselectedApiBaseUrl = 'http://127.0.0.1:1/api/v1'

test('loads localized model content and fulfills an order through return', async ({ page }) => {
  const modelResponse = await page.request.get('/fulfillops-model.json')
  const englishModel = (await modelResponse.json()) as {
    locale: string
    messages: Record<string, string>
    data: { itemNames: Record<string, string> }
  }
  const activeModel = {
    ...englishModel,
    locale: 'es-ES',
    messages: {
      ...englishModel.messages,
      'meta.title': 'FulfillOps | Operaciones de almacén',
      'page.floor.title': 'Zona de preparación',
    },
  }
  await page.route('**/fulfillops-model.json', (route) => route.fulfill({ json: activeModel }))

  function copy(key: string, values: Record<string, string | number> = {}): string {
    return activeModel.messages[key].replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => String(values[name]))
  }

  await page.clock.install({ time: new Date('2026-10-31T12:00:00.000Z') })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Zona de preparación' })).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-mode', expectedDataMode)
  await expect(page).toHaveTitle('FulfillOps | Operaciones de almacén')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES')
  const expectedDate = await page.evaluate(() =>
    new Intl.DateTimeFormat(document.documentElement.lang, { weekday: 'long', month: 'long', day: 'numeric' }).format(
      Date.now(),
    ),
  )
  await expect(page.locator('.page-heading .eyebrow')).toContainText(expectedDate)
  await expect(page.getByText(copy('connection.connected'))).toBeVisible()
  const profileSelect = page.getByLabel(copy('role.simulation'))
  await expect(profileSelect).toHaveValue('picker')
  await profileSelect.selectOption('warehouse_manager')
  await expect(profileSelect).toHaveValue('warehouse_manager')
  const acceptedOrder = `FO-48291, ${copy('status.accepted')}, ${copy('priority.expediteLabel')}`
  await expect(page.getByRole('button', { name: acceptedOrder })).toBeVisible()

  await page.getByRole('button', { name: copy('action.allocate.button') }).click()
  await expect(
    page.getByRole('button', {
      name: `FO-48291, ${copy('status.allocated')}, ${copy('priority.expediteLabel')}`,
    }),
  ).toBeVisible()

  await profileSelect.selectOption('picker')
  await expect(profileSelect).toHaveValue('picker')
  const headphones = englishModel.data.itemNames['AUR-220']
  const cable = englishModel.data.itemNames['CAB-118']
  await page.getByRole('button', { name: copy('page.orderDetails.pickOne', { item: headphones }) }).click()
  await expect(page.getByText('1/2')).toBeVisible()
  await page.getByRole('button', { name: copy('page.orderDetails.pickOne', { item: headphones }) }).click()
  await expect(page.getByText('2/2')).toBeVisible()
  await page.getByRole('button', { name: copy('page.orderDetails.pickOne', { item: cable }) }).click()
  await expect(
    page.getByRole('button', {
      name: `FO-48291, ${copy('status.picked')}, ${copy('priority.expediteLabel')}`,
    }),
  ).toBeVisible()

  await profileSelect.selectOption('packer')
  await expect(profileSelect).toHaveValue('packer')
  await page.getByRole('button', { name: copy('action.pack.button') }).click()
  await expect(
    page.getByRole('button', {
      name: `FO-48291, ${copy('status.packed')}, ${copy('priority.expediteLabel')}`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: copy('action.ship.button') }).click()
  await expect(page.getByText(/SIM-48291/)).toBeVisible()

  await profileSelect.selectOption('warehouse_manager')
  await expect(profileSelect).toHaveValue('warehouse_manager')
  await page.getByRole('button', { name: copy('action.return.button') }).click()
  await page.getByLabel(copy('page.orderDetails.returnReason')).selectOption('wrong_item')
  await page.getByRole('button', { name: copy('page.orderDetails.recordReturn') }).click()
  await expect(page.getByRole('status')).toContainText(copy('notice.return'))

  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: copy('navigation.primary') })
    .getByRole('button', { name: copy('navigation.returns') })
    .click()
  const returnedOrder = page.getByRole('button', {
    name: `FO-48291, ${copy('status.returned')}, ${copy('priority.expediteLabel')}`,
  })
  await expect(returnedOrder).toBeVisible()
  await returnedOrder.click()
  await expect(page.locator('.detail-panel.mobile-visible')).toBeVisible()
  await expect(page.locator('.return-summary')).toContainText(
    copy('page.orderDetails.returnRecorded', { reason: copy('returnReason.wrong_item') }),
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('shows model copy instead of backend error messages', async ({ page }) => {
  const rawBackendMessage = 'Internal fulfillment service details'
  await page.route('**/api/v1/orders/FO-48175/actions', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'INTERNAL_ERROR',
        message: rawBackendMessage,
        requestId: 'test-request',
      }),
    }),
  )

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Order queue' })).toBeVisible()
  await page.getByRole('button', { name: /FO-48175/ }).click()
  const profileSelect = page.getByLabel('Warehouse profile')
  await profileSelect.selectOption('warehouse_manager')
  await expect(profileSelect).toHaveValue('warehouse_manager')
  const allocateButton = page.getByRole('button', { name: 'Allocate order' })
  await expect(allocateButton).toBeVisible()
  await allocateButton.click()
  const errorNotice = page.locator('.notice.error')
  await expect(errorNotice).toContainText('The request could not be completed.')
  await expect(errorNotice).not.toContainText(rawBackendMessage)
})

test('uses the selected API and keeps architecture out of product routes', async ({ page }) => {
  const selectedApiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(selectedApiBaseUrl)) selectedApiRequests.push(request.url())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Order queue' })).toBeVisible()
  await expect.poll(() => selectedApiRequests.length).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: /architecture/i })).toHaveCount(0)

  const architectureResponse = await page.request.get('/architecture.md')
  const architectureBody = await architectureResponse.text()
  expect(architectureBody).not.toContain('C4 system context')
  expect(architectureBody).not.toContain('FulfillOps Architecture')

  const modelResponse = await page.request.get('/fulfillops-model.json')
  const model = await modelResponse.json()
  expect(model).not.toHaveProperty('architecture')

  const unselectedApiReachable = await page.request.get(`${unselectedApiBaseUrl}/health`, { timeout: 1_000 }).then(
    () => true,
    () => false,
  )
  expect(unselectedApiReachable).toBe(false)
})
