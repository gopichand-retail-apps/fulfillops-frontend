import { ApiRequestError } from './api'
import type { Translate } from './content-model'

export function displayApiError(error: unknown, t: Translate, messages: Record<string, string>): string {
  if (error instanceof ApiRequestError) {
    const key = `errors.${error.code}`
    return Object.hasOwn(messages, key) ? t(key) : t('errors.requestFailed')
  }
  return error instanceof TypeError ? t('errors.network') : t('errors.requestFailed')
}
