import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError, createDemoSession, getDemoProfiles } from '../api'
import { displayApiError } from '../api-errors'
import type { Translate } from '../content-model'
import type { DemoProfile, DemoRole } from '../types'

type UseDemoSessionOptions = {
  t: Translate
  messages: Record<string, string>
}

export function useDemoSession({ t, messages }: UseDemoSessionOptions) {
  const [profiles, setProfiles] = useState<DemoProfile[]>([])
  const [role, setRole] = useState<DemoRole>('picker')
  const [rolesLoading, setRolesLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function openWarehouseSession(): Promise<void> {
      try {
        const availableProfiles = await getDemoProfiles(controller.signal)
        const initialProfile = availableProfiles.find((profile) => profile.role === 'picker') ?? availableProfiles[0]
        if (!initialProfile) throw new ApiRequestError('PROFILES_UNAVAILABLE')

        const session = await createDemoSession(initialProfile.id, controller.signal)
        if (!active) return
        setProfiles(availableProfiles)
        setRole(session.profile.role)
        setAuthError(null)
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setAuthError(displayApiError(error, t, messages))
        }
      } finally {
        if (active) setRolesLoading(false)
      }
    }

    void openWarehouseSession()
    return () => {
      active = false
      controller.abort()
    }
  }, [messages, t])

  const changeProfile = useCallback(
    async (profileId: string): Promise<void> => {
      const profile = profiles.find((candidate) => candidate.id === profileId)
      if (!profile) {
        setAuthError(t('errors.DEMO_PROFILE_INVALID'))
        return
      }

      setRolesLoading(true)
      setAuthError(null)
      try {
        const session = await createDemoSession(profile.id)
        setRole(session.profile.role)
      } catch (error) {
        setAuthError(displayApiError(error, t, messages))
      } finally {
        setRolesLoading(false)
      }
    },
    [messages, profiles, t],
  )

  return { profiles, role, rolesLoading, authError, changeProfile }
}
