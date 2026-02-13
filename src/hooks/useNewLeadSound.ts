import { useEffect, useRef, useCallback } from 'react';

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

/**
 * Plays a short notification tone when the conversation count grows
 * (i.e. a brand-new lead / conversation appears).
 * Respects the user preference stored in localStorage.
 */
export function useNewLeadSound(conversationCount: number | undefined) {
  const prevCountRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazily create the Audio element once
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      // Use a simple built-in notification sound via Web Audio API
      audioRef.current = new Audio(
        'data:audio/wav;base64,UklGRlgEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTQEAAB/AH8AfwB/AH4AfgB9AH0AfAB8AHsAewB6AHoAeQB5AHgAeAB3AHcAdgB2AHUAdQB0AHQAcwBzAHIAcgBxAHEAcABwAG8AbwBuAG4AbQBtAGwAbABrAGsAagBqAGkAaQBoAGgAZwBnAGYAZgBlAGUAZABkAGMAYwBiAGIAYQBhAGAAYABfAF8AXgBeAF0AXQBcAFwAWwBbAFoAWgBZAFkAWABYAFcAVwBWAFYAVQBVAFQAVABTAFMAUgBSAFEAUQBQAFAATwBPAE4ATgBNAE0ATABMAEsASwBKAEoASQBJAEgASABHAEcARgBGAEUARQBEAEQAQwBDAEIAQgBBAEEAQABAAD8APwA+AD4APQA9ADwAPAA7ADsAOgA6ADkAOQA4ADgANwA3ADYANQA0ADQAMQBAAE0AWgBnAHQAfwCHAI8AlgCcAKIApwCrAK4AsQCzALQAtQC1ALQAswCyALAAawBVAD8AKQATAAEA8P/g/9H/w/+2/6n/nv+T/4n/gP94/3H/a/9m/2H/Xv9c/1v/W/9c/17/Yf9l/2r/cP93/3//iP+R/5v/pv+x/73/yf/V/+L/7v/7/wcAFAAhAC4AOgBGAFIAXgBpAHQAfgCHAJAAl  wCeAKQAqQCtALAAsQCyALEArwCsAKcAoQCaAJIAiQB/AHQAaABcAE8AQgA1ACgAGwAPAAMA+P/t/+P/2f/R/8n/wv+8/7f/s/+w/67/rf+t/67/sP+z/7f/vP/C/8n/0f/Z/+P/7f/4/wMADwAbACgANQBCAE8AXABoAHQAfwCJAJIAmgChAKcArACvALEAsgCxAK8ArACnAKEAmgCSAIkAfwB0AGgAXABPAEIANQAoABsADwADAP  j/7f/j/9n/0f/J/8L/vP+3/7P/sP+u/63/rf+u/7D/s/+3/7z/wv/J/9H/2f/j/+3/+P8DAA8AGwAoADUAQgBPAFwAaAB0AH8AiQCSAJoAoQCnAKwArwCxALIAsQCvAKwApwChAJoAkgCJAH8AdABoAFwATwBCADUAKAAbAA8AAwD4/+3/4//Z/9H/yf/C/7z/t/+z/7D/rv+t/63/rv+w/7P/t/+8/8L/yf/R/9n/4//t//j/AwAPABsAKAA1AEIATwBcAGgAdAB/AIkAkgCaAKEApwCsAK8AsQCyALEArwCsAKcAoQCaAJIAiQB/AHQAaABcAE8AQgA1ACgAGwAPAAMA+P/t/+P/2f/R/8n/wv+8/7f/s/+w/67/rf+t/67/sP+z/7f/vP/C/8n/0f/Z/+P/7f/4/w=='
      );
      audioRef.current.volume = 0.6;
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    if (conversationCount === undefined) return;

    // First load – just store the count, don't play
    if (prevCountRef.current === null) {
      prevCountRef.current = conversationCount;
      return;
    }

    // New conversation(s) appeared
    if (conversationCount > prevCountRef.current && isNewLeadSoundEnabled()) {
      const audio = getAudio();
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Browser may block autoplay until user interaction – ignore
      });
    }

    prevCountRef.current = conversationCount;
  }, [conversationCount, getAudio]);
}
