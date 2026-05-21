import * as Sentry from '@sentry/react'

/**
 * Sentry setup · error tracking + performance monitoring
 *
 * Setup:
 *   1. สมัคร Sentry (ฟรี 5K errors/mo) ที่ https://sentry.io
 *   2. สร้าง project · เลือก React
 *   3. copy DSN
 *   4. ใส่ใน .env.local:
 *        VITE_SENTRY_DSN=https://...@o....ingest.sentry.io/...
 *   5. (option) sourcemaps upload ตอน deploy (ดู Sentry docs)
 *
 * ถ้าไม่ตั้ง VITE_SENTRY_DSN → noop (dev mode · ไม่ส่ง)
 *
 * Usage:
 *   initSentry()  // เรียกใน main.tsx ก่อน render
 *
 *   captureError(error)         // capture เอง
 *   addBreadcrumb({ message, level })  // ใส่ context ก่อน error
 *   setUser({ id, email })      // user context (เรียกตอน login)
 */

let initialized = false

export function initSentry() {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[sentry] VITE_SENTRY_DSN not set · skipping')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // PDPA · ห้าม leak ข้อความ
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5, // record session ตอน error 50%
    beforeSend(event) {
      // strip sensitive query params
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url)
          ;['access_token', 'refresh_token', 'token', 'apikey'].forEach((k) =>
            u.searchParams.delete(k),
          )
          event.request.url = u.toString()
        } catch {
          // ignore
        }
      }
      return event
    },
  })
  initialized = true
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return
  Sentry.captureException(error, { extra: context })
}

export function setUser(user: { id: string; email?: string | null } | null) {
  if (!initialized) return
  Sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null)
}

export function addBreadcrumb(crumb: {
  message: string
  category?: string
  level?: 'info' | 'warning' | 'error'
  data?: Record<string, unknown>
}) {
  if (!initialized) return
  Sentry.addBreadcrumb({
    message: crumb.message,
    category: crumb.category ?? 'app',
    level: crumb.level ?? 'info',
    data: crumb.data,
  })
}
