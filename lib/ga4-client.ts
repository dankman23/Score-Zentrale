import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Types for analytics data
export interface AnalyticsMetrics {
  sessions: number;
  users: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
  revenue: number;
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

export interface TimeSeriesDataPoint {
  date: string;
  sessions?: number;
  users?: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  pageViews?: number;
  uniquePageViews?: number;
  avgTimeOnPage?: number;
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
      console.error('GA4_SERVICE_ACCOUNT_JSON environment variable is not set');
      throw new Error('GA4_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    // Parse the credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (parseError) {
      console.error('Failed to parse GA4_SERVICE_ACCOUNT_JSON:', parseError);
      throw new Error('Invalid GA4_SERVICE_ACCOUNT_JSON format');
    }

    // Validate required fields
    if (!credentials.client_email || !credentials.private_key) {
      console.error('Missing required fields in GA4 credentials:', {
        hasClientEmail: !!credentials.client_email,
        hasPrivateKey: !!credentials.private_key
      });
      throw new Error('GA4 credentials missing client_email or private_key');
    }

    // Ensure private_key has correct newlines
    const privateKey = credentials.private_key.replace(/\\n/g, '\n');

    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: privateKey,
      },
      projectId: credentials.project_id,
    });

    console.log('GA4 client initialized successfully');
    return analyticsClient;
  } catch (error) {
    console.error('Failed to initialize GA4 client:', error);
    throw error;
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
