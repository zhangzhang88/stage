/**
 * Analytics utility for tracking events with Umami
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

/**
 * Safely track an event with Umami
 * @param eventName - Name of the event to track
 * @param eventData - Optional data to attach to the event
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>): void {
  // Check if we're in the browser and Umami is loaded
  if (typeof window !== 'undefined' && window.umami) {
    try {
      window.umami.track(eventName, eventData);
    } catch (error) {
      // Silently fail if tracking fails to avoid breaking the app
      console.warn('Failed to track event:', error);
    }
  }
}

