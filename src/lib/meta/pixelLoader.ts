// Meta Pixel Loader and Event Tracking Utilities

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

let pixelInitialized = false;

/**
 * Initialize the Meta Pixel with the given Pixel ID
 */
export function initMetaPixel(pixelId: string): void {
  if (pixelInitialized) {
    console.log('Meta Pixel already initialized');
    return;
  }

  if (!pixelId) {
    console.warn('Meta Pixel ID not provided');
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq = window.fbq || function(...args: unknown[]) {
    (window.fbq as unknown as { queue: unknown[] }).queue = (window.fbq as unknown as { queue: unknown[] }).queue || [];
    (window.fbq as unknown as { queue: unknown[] }).queue.push(args);
  };

  script.onload = () => {
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    pixelInitialized = true;
    console.log('Meta Pixel initialized with ID:', pixelId);
  };
}

/**
 * Track a standard Meta event with optional eventID for deduplication
 */
export function trackStandardEvent(
  eventName: string,
  customData?: Record<string, unknown>,
  eventId?: string
): void {
  if (!window.fbq) {
    console.warn('Meta Pixel not initialized');
    return;
  }

  const options = eventId ? { eventID: eventId } : undefined;
  if (options) {
    window.fbq('track', eventName, customData, options);
  } else {
    window.fbq('track', eventName, customData);
  }
  console.log('Meta Pixel event tracked:', eventName, customData, eventId ? `eventID: ${eventId}` : '');
}

/**
 * Track a custom Meta event with optional eventID for deduplication
 */
export function trackCustomEvent(
  eventName: string,
  customData?: Record<string, unknown>,
  eventId?: string
): void {
  if (!window.fbq) {
    console.warn('Meta Pixel not initialized');
    return;
  }

  const options = eventId ? { eventID: eventId } : undefined;
  if (options) {
    window.fbq('trackCustom', eventName, customData, options);
  } else {
    window.fbq('trackCustom', eventName, customData);
  }
  console.log('Meta Pixel custom event tracked:', eventName, customData, eventId ? `eventID: ${eventId}` : '');
}

/**
 * Track a pipeline stage change event with deduplication eventID
 */
export function trackPipelineEvent(
  eventType: 'STANDARD' | 'CUSTOM',
  eventName: string,
  data: {
    contactId: string;
    pipelineStage: string;
    propertyId?: string;
    leadScore?: number;
  },
  eventId?: string
): void {
  const customData = {
    pipeline_stage: data.pipelineStage,
    contact_id: data.contactId,
    property_id: data.propertyId,
    lead_score: data.leadScore,
  };

  if (eventType === 'CUSTOM') {
    trackCustomEvent(eventName, customData, eventId);
  } else {
    trackStandardEvent(eventName, customData, eventId);
  }
}

/**
 * Get Meta cookies (fbp and fbc) if available
 */
export function getMetaCookies(): { fbp?: string; fbc?: string } {
  const cookies: { fbp?: string; fbc?: string } = {};
  
  const allCookies = document.cookie.split(';');
  for (const cookie of allCookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '_fbp') {
      cookies.fbp = value;
    } else if (name === '_fbc') {
      cookies.fbc = value;
    }
  }

  return cookies;
}
