self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', event => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.notification.body,
            icon: '/assets/icon.jpeg',
            badge: '/assets/icon.jpeg'
        };
        event.waitUntil(self.registration.showNotification(data.notification.title, options));
    } catch (error) {
        console.error('Push notification error:', error);
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (let client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
