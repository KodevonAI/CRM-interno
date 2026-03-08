// KodevonCRM — Service Worker para Web Push Notifications

self.addEventListener('push', function (event) {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'KodevonCRM', body: event.data.text() }
  }

  const options = {
    body:   data.body  ?? 'Nueva notificación',
    icon:   '/icon-192.png',
    badge:  '/icon-192.png',
    data:   data.data  ?? {},
    tag:    data.data?.type ?? 'crm-notification',
    renotify: true,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'KodevonCRM', options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const leadId = event.notification.data?.leadId
  const url = leadId ? `/leads/${leadId}` : '/inbox'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Si ya hay una pestaña abierta del CRM, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }
        // Si no, abrir nueva pestaña
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
