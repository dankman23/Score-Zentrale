import { getGoogleAdsClient, getCustomerId, getRefreshToken, CampaignMetric, CampaignMetricsResponse } from './google-ads-client';

/**
 * Fetch campaign metrics from Google Ads
 */
export async function getCampaignMetrics(
  startDate?: string,
  endDate?: string
): Promise<CampaignMetricsResponse> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const refreshToken = getRefreshToken();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });

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

    const response = await customer.query(query);
    
    // Transform the response
    const campaigns: CampaignMetric[] = response.map((row: any) => ({
      campaignId: row.campaign.id.toString(),
      campaignName: row.campaign.name,
      status: row.campaign.status,
      impressions: parseInt(row.metrics.impressions, 10) || 0,
      clicks: parseInt(row.metrics.clicks, 10) || 0,
      ctr: parseFloat(row.metrics.ctr) * 100 || 0, // Convert to percentage
      costMicros: parseInt(row.metrics.cost_micros, 10) || 0,
      costAmount: parseInt(row.metrics.cost_micros, 10) / 1000000 || 0,
      cpcMicros: parseInt(row.metrics.average_cpc, 10) || 0,
      cpcAmount: parseInt(row.metrics.average_cpc, 10) / 1000000 || 0,
      conversions: parseFloat(row.metrics.conversions) || 0,
    }));

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
