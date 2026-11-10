import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { contentModelSchema, dataString, dataStringMap, useContent } from '../src/content-model'
import { defaultContentModel } from './test-utils'

describe('FulfillOps content model helpers', () => {
  it('validates the strict model shape', () => {
    expect(contentModelSchema.parse(defaultContentModel).appId).toBe('fulfillops')
    expect(() => contentModelSchema.parse({ ...defaultContentModel, extra: true })).toThrow()
    expect(() => contentModelSchema.parse({ ...defaultContentModel, version: 2 })).toThrow()
  })

  it('validates string and string-map seed data', () => {
    expect(dataString(defaultContentModel, 'warehouseName')).toBe('North DC')
    expect(() => dataString(defaultContentModel, 'missing')).toThrow('Invalid content data: missing')
    expect(Object.keys(dataStringMap(defaultContentModel, 'itemNames'))).toContain('AUR-220')

    const invalidModel = contentModelSchema.parse({
      ...defaultContentModel,
      data: { ...defaultContentModel.data, itemNames: ['not', 'a', 'map'] },
    })
    expect(() => dataStringMap(invalidModel, 'itemNames')).toThrow('Invalid content data: itemNames')
  })

  it('fails clearly when a content provider is missing', () => {
    expect(() => renderHook(() => useContent())).toThrow('ContentProvider is missing')
  })
})
