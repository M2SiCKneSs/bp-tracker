import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const pushConfigured = () => Boolean(VAPID_PUBLIC_KEY)

/** VAPID keys are URL-safe base64; PushManager wants raw bytes. */
function decodeKey(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

let registration: ServiceWorkerRegistration | null = null

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  if (registration) return registration
  // BASE_URL keeps the scope correct under the GitHub Pages sub-path.
  registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
    type: 'module',
    scope: import.meta.env.BASE_URL,
  })
  return registration
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await registerServiceWorker()
  if (!reg) return false
  return Boolean(await reg.pushManager.getSubscription())
}

export type EnableResult = 'ok' | 'unsupported' | 'denied' | 'not-configured'

export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'not-configured'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await registerServiceWorker()
  if (!reg) return 'unsupported'

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return 'ok'
}

export async function disablePush(): Promise<void> {
  const reg = await registerServiceWorker()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  // Delete the row first: if unsubscribe succeeded but the delete failed we would
  // keep pushing to a dead endpoint until the sender pruned it.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  if (error) throw error
  await sub.unsubscribe()
}
