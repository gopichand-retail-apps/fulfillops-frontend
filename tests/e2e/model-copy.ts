import type { Page } from '@playwright/test'

export type Model = { messages: Record<string, string>; data: { itemNames: Record<string, string> } }

/** Reads the same content model the app serves, so assertions follow model copy rather than hard-coded text. */
export async function loadModel(page: Page): Promise<Model> {
  const response = await page.request.get('/fulfillops-model.json')
  return (await response.json()) as Model
}

export function copy(model: Model, key: string, values: Record<string, string | number> = {}): string {
  return model.messages[key].replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => String(values[name]))
}
