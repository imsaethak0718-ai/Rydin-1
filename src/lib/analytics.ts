/**
 * Analytics Tracking
 * Track user events, metrics, and conversions
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

// Mock analytics implementation (replace with PostHog/Mixpanel in production)
class Analytics {
  private events: AnalyticsEvent[] = [];

  /**
   * Track event
   */
  public trackEvent(eventName: string, properties?: Record<string, any>) {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: Date.now(),
    };

    this.events.push(event);
    console.log(`📊 Event: ${eventName}`, properties);

    // Send to backend
    this.flushEvents();
  }

  /**
   * Track page view
   */
  public trackPageView(pageName: string) {
    this.trackEvent('page_view', { page: pageName });
  }

  /**
   * Track user signup
   */
  public trackSignup(email: string, method: 'email' | 'google' | 'facebook' = 'email') {
    this.trackEvent('user_signup', { email, method });
  }

  /**
   * Track ride split creation
   */
  public trackSplitCreated(amount: number, platform: string, peopleCount: number) {
    this.trackEvent('split_created', { amount, platform, people_count: peopleCount });
  }

  /**
   * Track split joined
   */
  public trackSplitJoined(amount: number, splitId: string) {
    this.trackEvent('split_joined', { amount, split_id: splitId });
  }

  /**
   * Track payment settled
   */
  public trackPaymentSettled(amount: number, method: string) {
    this.trackEvent('payment_settled', { amount, method });
  }

  /**
   * Track referral
   */
  public trackReferral(referrerId: string, refereeId: string) {
    this.trackEvent('referral_completed', { referrer_id: referrerId, referee_id: refereeId });
  }

  /**
   * Track feature usage
   */
  public trackFeatureUsage(featureName: string) {
    this.trackEvent('feature_used', { feature: featureName });
  }

  /**
   * Track error
   */
  public trackError(errorName: string, context?: string) {
    this.trackEvent('error_occurred', { error: errorName, context });
  }

  /**
   * Set user properties
   */
  public setUserProperties(userId: string, properties: Record<string, any>) {
    console.log(`📊 User ${userId} properties:`, properties);
  }

  /**
   * Flush events to server
   */
  private flushEvents() {
    if (this.events.length === 0) return;

    // In production, send to PostHog/Mixpanel
    // For now, just log
    console.log(`📊 Flushing ${this.events.length} events`);
  }

  /**
   * Get analytics summary
   */
  public getSummary() {
    const summary = {
      total_events: this.events.length,
      events: this.events,
      by_type: {} as Record<string, number>,
    };

    this.events.forEach((event) => {
      summary.by_type[event.name] = (summary.by_type[event.name] || 0) + 1;
    });

    return summary;
  }
}

// Singleton instance
export const analytics = new Analytics();

/**
 * Initialize analytics
 */
export const initializeAnalytics = () => {
  // In production:
  // posthog.init('your-api-key')
  // Or: mixpanel.init('your-token')
  console.log('✅ Analytics initialized');
};

/**
 * Export for convenience
 */
export const trackEvent = (name: string, properties?: Record<string, any>) =>
  analytics.trackEvent(name, properties);

export const trackPageView = (page: string) => analytics.trackPageView(page);
