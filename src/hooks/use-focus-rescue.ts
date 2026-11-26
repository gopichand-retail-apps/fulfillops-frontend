import { useEffect, useRef } from 'react'

/** Focus is lost when it rests on the page body, on a hidden element, or on a control that just became disabled. */
export function isFocusLost(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return true
  return active.matches(':disabled') || active.getClientRects().length === 0
}

/**
 * When `trigger` changes and `enabled` is true, move focus to `findTarget()` only if keyboard focus was lost,
 * for example because the focused control was hidden or disabled by the change. Never runs on first render.
 */
export function useFocusRescue(
  trigger: unknown,
  enabled: boolean,
  findTarget: () => HTMLElement | null | undefined,
): void {
  const previous = useRef(trigger)

  useEffect(() => {
    if (Object.is(previous.current, trigger)) return
    previous.current = trigger
    if (enabled && isFocusLost()) findTarget()?.focus()
  })
}
