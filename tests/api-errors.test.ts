import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../src/api'
import { displayApiError } from '../src/api-errors'

const messages = {
  'errors.requestFailed': 'The request could not be completed.',
  'errors.network': 'The API could not be reached.',
  'errors.ROLE_NOT_ALLOWED': 'This action is unavailable for this profile.',
}

function translate(key: string): string {
  const message = Object.entries(messages).find(([messageKey]) => messageKey === key)?.[1]
  if (!message) throw new Error(`Missing message: ${key}`)
  return message
}

describe('displayApiError', () => {
  it('maps known API codes to model copy and uses generic copy for unknown codes', () => {
    expect(displayApiError(new ApiRequestError('ROLE_NOT_ALLOWED'), translate, messages)).toBe(
      'This action is unavailable for this profile.',
    )
    expect(displayApiError(new ApiRequestError('SECRET_BACKEND_CODE'), translate, messages)).toBe(
      'The request could not be completed.',
    )
  })

  it('does not expose raw backend messages or network exception details', () => {
    expect(displayApiError(new TypeError('internal network detail'), translate, messages)).toBe(
      'The API could not be reached.',
    )
    expect(displayApiError(new Error('private database detail'), translate, messages)).toBe(
      'The request could not be completed.',
    )
  })
})
