/* global self */
// Service worker for Web Push. It deliberately has no fetch handler: the app
// is a static export, so the browser cache stays untouched.
//
// Messages are sent by the backend as JSON:
//   { title, body, url, tag }

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title =
    typeof payload.title === "string" && payload.title ? payload.title : "привычка";
  const body = typeof payload.body === "string" ? payload.body : "";
  const tag = typeof payload.tag === "string" ? payload.tag : undefined;
  const target =
    typeof payload.url === "string" && payload.url
      ? payload.url
      : self.registration.scope;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: new URL("icon.svg", self.registration.scope).href,
      badge: new URL("icon.svg", self.registration.scope).href,
      data: { url: target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = new URL(
    typeof data.url === "string" && data.url ? data.url : self.registration.scope,
    self.registration.scope,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (client.url === target || client.url.startsWith(target)) {
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
