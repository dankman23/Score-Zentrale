import { CampaignMetric, CampaignMetricsResponse } from './google-ads-client';

/**
 * Get OAuth2 access token from refresh token
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch campaign metrics from Google Ads using REST API
 */
export async function getCampaignMetrics(
  startDate?: string,
  endDate?: string
): Promise<CampaignMetricsResponse> {
  try {
    const accessToken = await getAccessToken();
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    // Format dates for Google Ads API (YYYYMMDD)
    let dateCondition = '';
    if (startDate && endDate) {
      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');
      dateCondition = `
        AND segments.date >= '${formattedStart}'
        AND segments.date <= '${formattedEnd}'
      `;
    }

    // Google Ads Query Language (GAQL) query
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.average_cpc,
        metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ${dateCondition}
      ORDER BY metrics.impressions DESC
      LIMIT 50
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken!,
          'Content-Type': 'application/json',
          'login-customer-id': customerId!,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Ads API Error:', response.status, errorText);
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    const campaigns: CampaignMetric[] = [];

    // Parse response
    if (data && data.results) {
      for (const row of data.results) {
        campaigns.push({
          campaignId: row.campaign?.id || '',
          campaignName: row.campaign?.name || '',
          status: row.campaign?.status || '',
          impressions: parseInt(row.metrics?.impressions || '0', 10),
          clicks: parseInt(row.metrics?.clicks || '0', 10),
          ctr: parseFloat(row.metrics?.ctr || '0') * 100,
          costMicros: parseInt(row.metrics?.costMicros || '0', 10),
          costAmount: parseInt(row.metrics?.costMicros || '0', 10) / 1000000,
          cpcMicros: parseInt(row.metrics?.averageCpc || '0', 10),
          cpcAmount: parseInt(row.metrics?.averageCpc || '0', 10) / 1000000,
          conversions: parseFloat(row.metrics?.conversions || '0'),
        });
      }
    }

    return {
      campaigns,
      timestamp: new Date().toISOString(),
      totalCampaigns: campaigns.length,
    };
  } catch (error: any) {
    console.error('Error fetching Google Ads metrics:', error);
    throw new Error(`Failed to fetch campaign metrics: ${error.message}`);
  }
}
