import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Types for analytics data
export interface AnalyticsMetrics {
  sessions: number;
  users: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface PageMetrics {
  pagePath: string;
  pageTitle: string;
  pageViews: number;
  uniquePageViews: number;
  avgTimeOnPage: number;
}

// Singleton client instance
let analyticsClient: BetaAnalyticsDataClient | null = null;

// Initialize the GA4 client
export function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (analyticsClient) {
    return analyticsClient;
  }

  try {
    const credentialsJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      throw new Error('GA4_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    const credentials = JSON.parse(credentialsJson);
    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });

    return analyticsClient;
  } catch (error) {
    console.error('Failed to initialize GA4 client:', error);
    throw new Error('Failed to initialize GA4 client');
  }
}

// Get the GA4 property ID
export function getPropertyId(): string {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID environment variable is not set');
  }
  return propertyId;
}
