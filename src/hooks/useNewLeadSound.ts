import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'brokia-new-lead-sound';

/** Reads the persisted preference (default = enabled). */
export function isNewLeadSoundEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

/** Persists the preference. */
export function setNewLeadSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

// A short notification beep as a base64-encoded WAV
const NOTIFICATION_SOUND_URI =
  'data:audio/wav;base64,UklGRlgEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTQEAAB/AH8AfwB/AH4AfgB9AH0AfAB8AHsAewB6AHoAeQB5AHgAeAB3AHcAdgB2AHUAdQB0AHQAcwBzAHIAcgBxAHEAcABwAG8AbwBuAG4AbQBtAGwAbABrAGsAagBqAGkAaQBoAGgAZwBnAGYAZgBlAGUAZABkAGMAYwBiAGIAYQBhAGAAYABfAF8AXgBeAF0AXQBcAFwAWwBbAFoAWgBZAFkAWABYAFcAVwBWAFYAVQBVAFQAVABTAFMAUgBSAFEAUQBQAFAATwBPAE4ATgBNAE0ATABMAEsASwBKAEoASQBJAEgASABHAEcARgBGAEUARQBEAEQAQwBDAEIAQgBBAEEAQABAAD8APwA+AD4APQA9ADwAPAA7ADsAOgA6ADkAOQA4ADgANwA3ADYANQA0ADQAMQBAAE0AWgBnAHQAfwCHAI8AlgCcAKIApwCrAK4AsQCzALQAtQC1ALQAswCyALAAawBVAD8AKQATAAEA8P/g/9H/w/+2/6n/nv+T/4n/gP94/3H/a/9m/2H/Xv9c/1v/W/9c/17/Yf9l/2r/cP93/3//iP+R/5v/pv+x/73/yf/V/+L/7v/7/wcAFAAhAC4AOgBGAFIAXgBpAHQAfgCHAJAAl  wCeAKQAqQCtALAAsQCyALEArwCsAKcAoQCaAJIAiQB/AHQAaABcAE8AQgA1ACgAGwAPAAMA+P/t/+P/2f/R/8n/wv+8/7f/s/+w/67/rf+t/67/sP+z/7f/vP/C/8n/0f/Z/+P/7f/4/wMADwAbACgANQBCAE8AXABoAHQAfwCJAJIAmgChAKcArACvALEAsgCxAK8ArACnAKEAmgCSAIkAfwB0AGgAXABPAEIANQAoABsADwADAP  j/7f/j/9n/0f/J/8L/vP+3/7P/sP+u/63/rf+u/7D/s/+3/7z/wv/J/9H/2f/j/+3/+P8DAA8AGwAoADUAQgBPAFwAaAB0AH8AiQCSAJoAoQCnAKwArwCxALIAsQCvAKwApwChAJoAkgCJAH8AdABoAFwATwBCADUAKAAbAA8AAwD4/+3/4//Z/9H/yf/C/7z/t/+z/7D/rv+t/63/rv+w/7P/t/+8/8L/yf/R/9n/4//t//j/AwAPABsAKAA1AEIATwBcAGgAdAB/AIkAkgCaAKEApwCsAK8AsQCyALEArwCsAKcAoQCaAJIAiQB/AHQAaABcAE8AQgA1ACgAGwAPAAMA+P/t/+P/2f/R/8n/wv+8/7f/s/+w/67/rf+t/67/sP+z/7f/vP/C/8n/0f/Z/+P/7f/4/w==';

function playNotificationSound() {
  if (!isNewLeadSoundEnabled()) return;
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URI);
    audio.volume = 0.6;
    audio.play().catch(() => {
      // Autoplay blocked until user interaction – ignore
    });
  } catch {
    // Ignore audio errors
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
