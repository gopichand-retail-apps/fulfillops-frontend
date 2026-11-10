import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ContentProvider } from '../src/content'
import { contentModelSchema } from '../src/content-model'
import type { ContentModel } from '../src/content-model'

export const defaultContentModel = contentModelSchema.parse(
  JSON.parse(readFileSync(resolve('public/fulfillops-model.json'), 'utf8')),
)

export function renderWithContent(children: ReactNode, model: ContentModel = defaultContentModel) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => model,
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    ...render(
      <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
        {children}
      </ContentProvider>,
    ),
    fetchMock,
  }
}
