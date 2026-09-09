/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  const title = payload.title ?? 'מעקב לחץ דם'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      dir: 'rtl',
      lang: 'he',
      // A tag makes a second reminder replace the first instead of stacking.
      tag: payload.tag ?? 'bp-reminder',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data?.url as string) ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(target) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
