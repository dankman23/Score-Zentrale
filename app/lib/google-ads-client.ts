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
