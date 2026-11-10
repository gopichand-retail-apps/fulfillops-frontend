import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContentProvider } from '../src/content'
import { useContent } from '../src/content-model'
import type { ContentModel } from '../src/content-model'
import { defaultContentModel, renderWithContent } from './test-utils'

function ContentProbe() {
  const { t } = useContent()
  return <h1>{t('meta.title')}</h1>
}

function MissingKeyProbe() {
  const { t } = useContent()
  let result = ''
  try {
    t('missing.key')
  } catch (error) {
    result = error instanceof Error ? error.message : 'UNEXPECTED_ERROR'
  }
  return <output>{result}</output>
}

describe('FulfillOps content provider', () => {
  it('loads the model without cache and updates document metadata', async () => {
    const { fetchMock } = renderWithContent(<ContentProbe />)
    const heading = await screen.findByRole('heading', { name: 'FulfillOps | Warehouse operations' })
    expect(heading).toBeVisible()
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.title).toBe('FulfillOps | Warehouse operations')
    expect(fetchMock).toHaveBeenCalledWith(
      '/fulfillops-model.json',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it('uses a replacement locale and copy in rendered content and metadata', async () => {
    const localizedModel: ContentModel = {
      ...defaultContentModel,
      locale: 'fr-CA',
      messages: {
        ...defaultContentModel.messages,
        'meta.title': 'FulfillOps | Entrepôt',
        'meta.description': 'Gestion synthétique des commandes.',
      },
    }

    renderWithContent(<ContentProbe />, localizedModel)
    expect(await screen.findByRole('heading', { name: 'FulfillOps | Entrepôt' })).toBeVisible()
    expect(document.documentElement.lang).toBe('fr-CA')
    expect(document.title).toBe('FulfillOps | Entrepôt')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Gestion synthétique des commandes.',
    )
  })

  it('fails visibly for invalid models, missing metadata, and network failures', async () => {
    const invalidModel = { ...defaultContentModel, appId: 'other-app' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => invalidModel }))
    render(
      <ContentProvider appId="fulfillops" modelUrl="/invalid.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect(await screen.findByText('CONTENT_MODEL_INVALID')).toBeVisible()

    const missingMetadata = {
      ...defaultContentModel,
      messages: { ...defaultContentModel.messages, 'meta.title': '' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => missingMetadata }))
    render(
      <ContentProvider appId="fulfillops" modelUrl="/missing-metadata.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect(await screen.findByText('CONTENT_MODEL_METADATA_MISSING')).toBeVisible()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private backend detail')))
    render(
      <ContentProvider appId="fulfillops" modelUrl="/offline.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect(await screen.findByText('CONTENT_MODEL_UNAVAILABLE')).toBeVisible()
    expect(screen.queryByText('private backend detail')).toBeNull()
  })

  it('throws on absent message keys rather than silently falling back', async () => {
    renderWithContent(<MissingKeyProbe />)
    expect(await screen.findByText('Missing content key: missing.key')).toBeVisible()
  })
})
