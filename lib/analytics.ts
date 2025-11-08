import { getAnalyticsClient, getPropertyId, AnalyticsMetrics, TrafficSource, PageMetrics } from './ga4-client';

/**
 * Fetch key analytics metrics for a given date range
 */
export async function fetchAnalyticsMetrics(
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<AnalyticsMetrics> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    // Default values if no data
    if (!response.rows || response.rows.length === 0) {
      return {
        sessions: 0,
        users: 0,
        pageViews: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
      };
    }

    const row = response.rows[0];
    const metricValues = row.metricValues || [];

    return {
      sessions: parseInt(metricValues[0]?.value || '0', 10),
      users: parseInt(metricValues[1]?.value || '0', 10),
      pageViews: parseInt(metricValues[2]?.value || '0', 10),
      avgSessionDuration: parseFloat(metricValues[3]?.value || '0'),
      bounceRate: parseFloat(metricValues[4]?.value || '0'),
    };
  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    throw new Error('Failed to fetch analytics metrics');
  }
}

/**
 * Fetch traffic sources data
 */
export async function fetchTrafficSources(
  startDate: string = '30daysAgo',
  endDate: string = 'today',
  limit: number = 10
): Promise<TrafficSource[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
      ],
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
      limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      return {
        source: dimensionValues[0]?.value || 'unknown',
        medium: dimensionValues[1]?.value || 'unknown',
        sessions: parseInt(metricValues[0]?.value || '0', 10),
        users: parseInt(metricValues[1]?.value || '0', 10),
        conversions: parseInt(metricValues[2]?.value || '0', 10),
      };
    });
  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    throw new Error('Failed to fetch traffic sources');
  }
}

/**
 * Fetch top pages by pageviews
 */
export async function fetchTopPages(
  startDate: string = '30daysAgo',
  endDate: string = 'today',
  limit: number = 100
): Promise<PageMetrics[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      orderBys: [
        { metric: { metricName: 'screenPageViews' }, desc: true }
      ],
      limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: parseInt(metricValues[0]?.value || '0', 10),
        uniquePageViews: parseInt(metricValues[1]?.value || '0', 10),
        avgTimeOnPage: parseFloat(metricValues[2]?.value || '0'),
      };
    });
  } catch (error) {
    console.error('Error fetching top pages:', error);
    throw new Error('Failed to fetch top pages');
  }
}

/**
 * Fetch metrics for specific category pages
 */
export async function fetchCategoryPages(
  categoryPaths: string[],
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<PageMetrics[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        orGroup: {
          expressions: categoryPaths.map(path => ({
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'EXACT' as const,
                value: path
              }
            }
          }))
        }
      },
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: parseInt(metricValues[0]?.value || '0', 10),
        uniquePageViews: parseInt(metricValues[1]?.value || '0', 10),
        avgTimeOnPage: parseFloat(metricValues[2]?.value || '0'),
      };
    });
  } catch (error) {
    console.error('Error fetching category pages:', error);
    throw new Error('Failed to fetch category pages');
  }
}

/**
 * Fetch top product detail pages (filter by URL pattern)
 */
export async function fetchTopProductPages(
  startDate: string = '30daysAgo',
  endDate: string = 'today',
  limit: number = 100
): Promise<PageMetrics[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'CONTAINS' as const,
            value: '-kaufen/' // Produktseiten enthalten "-kaufen/"
          }
        }
      },
      orderBys: [
        { metric: { metricName: 'screenPageViews' }, desc: true }
      ],
      limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: parseInt(metricValues[0]?.value || '0', 10),
        uniquePageViews: parseInt(metricValues[1]?.value || '0', 10),
        avgTimeOnPage: parseFloat(metricValues[2]?.value || '0'),
      };
    });
  } catch (error) {
    console.error('Error fetching top product pages:', error);
    throw new Error('Failed to fetch top product pages');
  }
}
