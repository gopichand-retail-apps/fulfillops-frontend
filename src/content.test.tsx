import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentProvider } from './content'
import { useContent } from './content-model'
import type { ContentModel } from './content-model'

function model(locale = 'en-US'): ContentModel {
  return {
    version: 1,
    appId: 'fulfillops',
    locale,
    messages: {
      'meta.title': 'FulfillOps | Warehouse operations',
      'meta.description': 'Synthetic warehouse workflow.',
      'test.heading': 'Work queue',
    },
    data: {},
  }
}

function ContentProbe() {
  const { t } = useContent()
  return <h1>{t('test.heading')}</h1>
}

function MissingKeyProbe() {
  const { t } = useContent()
  let output = ''
  try {
    t('missing.heading')
  } catch (error) {
    output = error instanceof Error ? error.message : 'UNEXPECTED_ERROR'
  }
  return <output>{output}</output>
}

describe('FulfillOps content model', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.documentElement.lang = ''
    document.title = ''
  })

  it('loads the model without cache and updates document metadata', async () => {
    const activeModel = model('fr-CA')
    const description = document.createElement('meta')
    description.name = 'description'
    document.head.append(description)
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => activeModel,
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Work queue' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('fr-CA')
    expect(document.title).toBe(activeModel.messages['meta.title'])
    expect(description.content).toBe(activeModel.messages['meta.description'])
    expect(fetchMock).toHaveBeenCalledWith(
      '/fulfillops-model.json',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it('fails visibly for an invalid model or missing metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ...model(), appId: 'other' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            const missing = model()
            delete missing.messages['meta.title']
            return missing
          },
        }),
    )

    const first = render(
      <ContentProvider appId="fulfillops" modelUrl="/invalid-model.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect((await screen.findByText('CONTENT_MODEL_INVALID')).closest('main')?.getAttribute('data-error')).toBe(
      'CONTENT_MODEL_INVALID',
    )

    first.unmount()
    render(
      <ContentProvider appId="fulfillops" modelUrl="/missing-metadata.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect(
      (await screen.findByText('CONTENT_MODEL_METADATA_MISSING')).closest('main')?.getAttribute('data-error'),
    ).toBe('CONTENT_MODEL_METADATA_MISSING')
  })

  it('reports network failures and missing model keys instead of falling back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network secret details')))
    const failed = render(
      <ContentProvider appId="fulfillops" modelUrl="/unavailable-model.json">
        <ContentProbe />
      </ContentProvider>,
    )
    expect((await screen.findByText('CONTENT_MODEL_UNAVAILABLE')).closest('main')?.getAttribute('data-error')).toBe(
      'CONTENT_MODEL_UNAVAILABLE',
    )

    failed.unmount()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => model() }))
    render(
      <ContentProvider appId="fulfillops" modelUrl="/model-with-missing-copy.json">
        <MissingKeyProbe />
      </ContentProvider>,
    )
    expect(await screen.findByText('Missing content key: missing.heading')).toBeTruthy()
    expect(screen.queryByText('network secret details')).toBeNull()
  })
})
