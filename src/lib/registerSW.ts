export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[SW] Registered:', registration.scope);

    // Check for updates every 60 seconds
    setInterval(() => {
      registration.update();
    }, 60 * 1000);
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}
