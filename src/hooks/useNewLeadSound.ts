import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'brokia-new-lead-sound';

export function isNewLeadSoundEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

export function setNewLeadSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/**
 * Plays a two-tone notification chime using the Web Audio API.
 * No external file needed – works everywhere.
 */
function playNotificationSound() {
  if (!isNewLeadSoundEnabled()) return;

  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880; // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (higher, slight delay)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1175; // D6
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.3);

    // Clean up context after sound finishes
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Web Audio API not available – ignore silently
  }
}

/**
 * Subscribes to realtime INSERT on the messages table for inbound messages
 * and plays a notification sound. Should be mounted once (e.g. in Inbox).
 */
export function useNewLeadSound() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const channel = supabase
      .channel('new-lead-sound')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (!mountedRef.current) return;
          const msg = payload.new as { direction?: string };
          if (msg.direction === 'inbound') {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);
}
