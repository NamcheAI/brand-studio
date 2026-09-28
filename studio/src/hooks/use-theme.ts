import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'namche-studio-theme'
const LEGACY_STORAGE_KEY = 'metaball-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    // The rename moved the key; read the new one first and fall back to the
    // pre-rename key so a returning visitor's preference survives.
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage may be unavailable (e.g. privacy mode).
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

// ONE store for the whole app. The preference is process-wide state — the
// theme menu, the intro's live art, and the toaster must all move together,
// so the hook reads a module-level value through useSyncExternalStore
// instead of each call site owning a private useState that only its own
// setter can update.
let currentTheme: Theme = readStoredTheme()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Theme {
  return currentTheme
}

function getServerSnapshot(): Theme {
  return 'system'
}

function setStoredTheme(next: Theme) {
  currentTheme = next
  applyTheme(next)
  try {
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
    // Every write finishes the migration: the old key is retired so it can
    // never shadow a future read of the new one.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // localStorage may be unavailable (e.g. privacy mode).
  }
  for (const listener of listeners) listener()
}

// Follow OS-level scheme changes while set to "system". Module-level and
// unconditional: applyTheme is a no-op unless the preference is "system"
// resolves differently, and consumers that resolve "system" themselves keep
// their own matchMedia listeners.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (currentTheme === 'system') applyTheme('system')
    })
}

/**
 * Exposes the current NAMCHE theme preference and a setter that persists it.
 * Mirrors the pre-paint script in index.html so there is no flash of the
 * wrong theme. Every component reading this hook shares one store, so a
 * change made anywhere reaches every consumer.
 */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setTheme = useCallback((next: Theme) => setStoredTheme(next), [])
  return { theme, setTheme }
}
