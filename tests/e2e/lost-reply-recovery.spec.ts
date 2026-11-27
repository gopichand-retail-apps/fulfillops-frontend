import { expect, test } from '@playwright/test'
import { copy, loadModel } from './model-copy'

const apiBaseUrl = 'http://127.0.0.1:5212/api/v1'

type Attempt = { key: string | undefined; requestId: string | undefined }
type ItemState = { sku: string; pickedQuantity: number }

test('a lost pick reply is recovered by a safe retry without picking twice', async ({ page }) => {
  const model = await loadModel(page)
  const attempts: Attempt[] = []
  let dropNextReply = true

  await page.route('**/api/v1/orders/FO-48262/actions', async (route) => {
    const headers = route.request().headers()
    attempts.push({ key: headers['idempotency-key'], requestId: headers['x-request-id'] })
    if (!dropNextReply) {
      await route.continue()
      return
    }
    dropNextReply = false
    await route.fetch() // the server applies the pick...
    await route.abort('connectionreset') // ...but the browser never receives the reply
  })

  await page.goto('/')
  await page.getByRole('button', { name: /FO-48262/ }).click()
  const mug = model.data.itemNames['MUG-008']
  await page.getByRole('button', { name: copy(model, 'page.orderDetails.pickOne', { item: mug }) }).click()

  const banner = page.getByRole('alert').filter({ hasText: copy(model, 'awaiting.title') })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText(
    copy(model, 'awaiting.body', { action: copy(model, 'awaiting.action.pick'), orderNumber: 'FO-48262' }),
  )
  await expect(page.getByText('2/2')).toBeVisible()

  await banner.getByRole('button', { name: copy(model, 'awaiting.retry') }).click()
  await expect(page.getByRole('status').filter({ hasText: copy(model, 'notice.recovered') })).toBeVisible()
  await expect(banner).toHaveCount(0)

  expect(attempts).toHaveLength(2)
  expect(attempts[1]?.key).toBeTruthy()
  expect(attempts[1]?.key).toBe(attempts[0]?.key)
  expect(attempts[1]?.requestId).not.toBe(attempts[0]?.requestId)

  const stored = await page.request.get(`${apiBaseUrl}/orders/FO-48262`)
  const { data } = (await stored.json()) as { data: { version: number; items: ItemState[] } }
  expect(data.items.find((item) => item.sku === 'MUG-008')?.pickedQuantity).toBe(2)
  expect(data.items.find((item) => item.sku === 'BOT-214')?.pickedQuantity).toBe(0)
  expect(data.version).toBe(2)
})
