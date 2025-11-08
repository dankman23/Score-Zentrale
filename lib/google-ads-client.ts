// Campaign Metrics Interface
export interface CampaignMetric {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  costMicros: number;
  costAmount: number;
  cpcMicros: number;
  cpcAmount: number;
  conversions: number;
  status: string;
}

export interface CampaignMetricsResponse {
  campaigns: CampaignMetric[];
  timestamp: string;
  totalCampaigns: number;
}

// Singleton client instance
let adsClient: GoogleAdsApi | null = null;

// Initialize the Google Ads client
export function getGoogleAdsClient(): GoogleAdsApi {
  if (adsClient) {
    return adsClient;
  }

  try {
    if (!process.env.GOOGLE_ADS_CLIENT_ID) {
      throw new Error('GOOGLE_ADS_CLIENT_ID environment variable is not set');
    }
    if (!process.env.GOOGLE_ADS_CLIENT_SECRET) {
      throw new Error('GOOGLE_ADS_CLIENT_SECRET environment variable is not set');
    }
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN environment variable is not set');
    }
    if (!process.env.GOOGLE_ADS_REFRESH_TOKEN) {
      throw new Error('GOOGLE_ADS_REFRESH_TOKEN environment variable is not set');
    }

    adsClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    return adsClient;
  } catch (error) {
    console.error('Failed to initialize Google Ads client:', error);
    throw new Error('Failed to initialize Google Ads client');
  }
}

// Get the Customer ID
export function getCustomerId(): string {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId) {
    throw new Error('GOOGLE_ADS_CUSTOMER_ID environment variable is not set');
  }
  return customerId;
}

// Get Refresh Token
export function getRefreshToken(): string {
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('GOOGLE_ADS_REFRESH_TOKEN environment variable is not set');
  }
  return refreshToken;
}
