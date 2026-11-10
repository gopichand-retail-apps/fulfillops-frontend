import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ContentContext, contentModelSchema, type ContentContextValue, type ContentModel } from './content-model'

type ContentProviderProps = {
  appId: string
  modelUrl: string
  children: ReactNode
}

type ContentLoadErrorCode =
  | 'CONTENT_MODEL_REQUEST_FAILED'
  | 'CONTENT_MODEL_INVALID'
  | 'CONTENT_MODEL_METADATA_MISSING'
  | 'CONTENT_MODEL_UNAVAILABLE'

class ContentModelLoadError extends Error {
  readonly code: ContentLoadErrorCode

  constructor(code: ContentLoadErrorCode) {
    super(code)
    this.code = code
  }
}

export function ContentProvider({ appId, modelUrl, children }: ContentProviderProps) {
  const [model, setModel] = useState<ContentModel | null>(null)
  const [loadError, setLoadError] = useState<ContentLoadErrorCode | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void fetch(modelUrl, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new ContentModelLoadError('CONTENT_MODEL_REQUEST_FAILED')
        const payload: unknown = await response.json()
        const parsed = contentModelSchema.safeParse(payload)
        if (!parsed.success || parsed.data.appId !== appId) {
          throw new ContentModelLoadError('CONTENT_MODEL_INVALID')
        }
        if (!parsed.data.messages['meta.title'] || !parsed.data.messages['meta.description']) {
          throw new ContentModelLoadError('CONTENT_MODEL_METADATA_MISSING')
        }
        return parsed.data
      })
      .then((contentModel) => {
        document.documentElement.lang = contentModel.locale
        document.title = contentModel.messages['meta.title']
        let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
        if (!description) {
          description = document.createElement('meta')
          description.name = 'description'
          document.head.append(description)
        }
        description.content = contentModel.messages['meta.description']
        setModel(contentModel)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof ContentModelLoadError ? error.code : 'CONTENT_MODEL_UNAVAILABLE')
      })

    return () => controller.abort()
  }, [appId, modelUrl])

  const value = useMemo<ContentContextValue | null>(() => {
    if (!model) return null
    return {
      model,
      t: (key, values = {}) => {
        const template = model.messages[key]
        if (template === undefined) throw new Error(`Missing content key: ${key}`)
        return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => {
          const replacement = values[name]
          if (replacement === undefined) {
            throw new Error(`Missing content value: ${name}`)
          }
          return String(replacement)
        })
      },
    }
  }, [model])

  if (!value) {
    return (
      <main
        className="content-model-state"
        role={loadError ? 'alert' : 'status'}
        aria-busy={!loadError}
        data-error={loadError ?? undefined}
      >
        {loadError ? <code>{loadError}</code> : <span className="content-model-spinner" aria-hidden="true" />}
      </main>
    )
  }

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}
