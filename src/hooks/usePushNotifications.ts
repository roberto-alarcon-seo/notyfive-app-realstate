import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY_STORAGE = 'brokia-vapid-public-key';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('prompt');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermissionState);

    // Check existing subscription
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (permission === 'unsupported') return;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermissionState);
      if (perm !== 'granted') {
        setLoading(false);
        return;
      }

      // Get VAPID key from edge function
      const { data: vapidData } = await supabase.functions.invoke('push-vapid-key');
      const vapidKey = vapidData?.publicKey;
      if (!vapidKey) throw new Error('No VAPID key');

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisuallyIndicatesUserIsActive: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      } as any);

      const subJson = subscription.toJSON();

      // Get current user & tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant');

      // Upsert subscription
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          tenant_id: profile.tenant_id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setLoading(false);
    }
  }, [permission]);

  const clearBadge = useCallback(() => {
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
  }, []);

  return { permission, isSubscribed, loading, subscribe, clearBadge };
}
