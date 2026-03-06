export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[SW] Registered:', registration.scope);
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}
