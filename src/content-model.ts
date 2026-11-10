import { createContext, useContext } from 'react'
import { z } from 'zod'

export const contentModelSchema = z
  .object({
    version: z.literal(1),
    appId: z.string().min(1),
    locale: z.string().min(2),
    messages: z.record(z.string(), z.string()),
    data: z.record(z.string(), z.unknown()),
  })
  .strict()

export type ContentModel = z.infer<typeof contentModelSchema>
export type MessageValues = Record<string, string | number>
export type Translate = (key: string, values?: MessageValues) => string

export type ContentContextValue = {
  model: ContentModel
  t: Translate
}

export const ContentContext = createContext<ContentContextValue | null>(null)

export function useContent(): ContentContextValue {
  const value = useContext(ContentContext)
  if (!value) throw new Error('ContentProvider is missing')
  return value
}

export function dataString(model: ContentModel, key: string): string {
  const value = model.data[key]
  if (typeof value !== 'string') throw new Error(`Invalid content data: ${key}`)
  return value
}

export function dataStringMap(model: ContentModel, key: string): Record<string, string> {
  const value = z.record(z.string(), z.string()).safeParse(model.data[key])
  if (!value.success) throw new Error(`Invalid content data: ${key}`)
  return value.data
}
