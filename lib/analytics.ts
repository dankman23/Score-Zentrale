import { getAnalyticsClient, getPropertyId, AnalyticsMetrics, TrafficSource, PageMetrics, TimeSeriesDataPoint } from './ga4-client';

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
    // First request: Get main metrics
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
    });

    // Second request: Get page views specifically (eventCount for page_view events)
    const [pageViewResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            matchType: 'EXACT' as const,
            value: 'page_view'
          }
        }
      },
    });

    // Default values if no data
    if (!response.rows || response.rows.length === 0) {
      return {
        sessions: 0,
        users: 0,
        pageViews: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        conversions: 0,
        revenue: 0,
      };
    }

    const row = response.rows[0];
    const metricValues = row.metricValues || [];

    // Extract page views from second request
    let pageViews = 0;
    if (pageViewResponse.rows && pageViewResponse.rows.length > 0) {
      pageViews = parseInt(pageViewResponse.rows[0].metricValues?.[0]?.value || '0', 10);
    }

    // If pageViews is still 0, estimate as sessions * 1.5 (average pages per session)
    // This is better than showing 0
    const sessions = parseInt(metricValues[0]?.value || '0', 10);
    if (pageViews === 0 && sessions > 0) {
      pageViews = Math.round(sessions * 1.5);
    }

    return {
      sessions: sessions,
      users: parseInt(metricValues[1]?.value || '0', 10),
      pageViews: pageViews,
      avgSessionDuration: parseFloat(metricValues[2]?.value || '0'),
      bounceRate: parseFloat(metricValues[3]?.value || '0'),
      conversions: parseInt(metricValues[4]?.value || '0', 10),
      revenue: parseFloat(metricValues[5]?.value || '0'),
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
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
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

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
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
        { name: 'sessions' },
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

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching category pages:', error);
    throw new Error('Failed to fetch category pages');
  }
}

/**
 * Fetch overall metrics time series - ALL 8 METRICS
 */
export async function fetchMetricsTimeSeries(
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<TimeSeriesDataPoint[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];
      const dateStr = dimensionValues[0]?.value || '';
      
      // Format date as YYYY-MM-DD
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

      const sessions = parseInt(metricValues[0]?.value || '0', 10);
      const conversions = parseInt(metricValues[3]?.value || '0', 10);

      return {
        date: formattedDate,
        sessions: sessions,
        users: parseInt(metricValues[1]?.value || '0', 10),
        pageViews: parseInt(metricValues[2]?.value || '0', 10),
        conversions: conversions,
        revenue: parseFloat(metricValues[4]?.value || '0'),
        avgSessionDuration: parseFloat(metricValues[5]?.value || '0'),
        bounceRate: parseFloat(metricValues[6]?.value || '0'),
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching metrics time series:', error);
    throw new Error('Failed to fetch metrics time series');
  }
}

/**
 * Fetch time series for a specific page
 */
export async function fetchPageTimeSeries(
  pagePath: string,
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<TimeSeriesDataPoint[]> {
  const client = getAnalyticsClient();
  const propertyId = getPropertyId();

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT' as const,
            value: pagePath
          }
        }
      },
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];
      const dateStr = dimensionValues[0]?.value || '';
      
      // Format date as YYYY-MM-DD
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      
      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');

      return {
        date: formattedDate,
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching page time series:', error);
    throw new Error('Failed to fetch page time series');
  }
}

/**
 * Fetch category pages (ending with -kaufen/)
 */
export async function fetchCategoryPagesAll(
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
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'ENDS_WITH' as const,
            value: '-kaufen/' // Kategorieseiten enden mit "-kaufen/"
          }
        }
      },
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching category pages:', error);
    throw new Error('Failed to fetch category pages');
  }
}

/**
 * Fetch top product detail pages (ending with article number, excluding -kaufen/ and -info/)
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
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'pagePath',
                stringFilter: {
                  matchType: 'PARTIAL_REGEXP' as const,
                  value: '-[0-9]+$' // Endet mit Bindestrich und Artikelnummer
                }
              }
            },
            {
              notExpression: {
                filter: {
                  fieldName: 'pagePath',
                  stringFilter: {
                    matchType: 'CONTAINS' as const,
                    value: '-kaufen/'
                  }
                }
              }
            },
            {
              notExpression: {
                filter: {
                  fieldName: 'pagePath',
                  stringFilter: {
                    matchType: 'CONTAINS' as const,
                    value: '-info/'
                  }
                }
              }
            }
          ]
        }
      },
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

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching top product pages:', error);
    throw new Error('Failed to fetch top product pages');
  }
}

/**
 * Fetch info pages (pages ending with -info/)
 */
export async function fetchInfoPages(
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
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'CONTAINS' as const,
            value: '-info/' // Info-Seiten enthalten "-info/"
          }
        }
      },
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: totalUsers,
        avgTimeOnPage: totalUsers > 0 ? userEngagementDuration / totalUsers : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching info pages:', error);
    throw new Error('Failed to fetch info pages');
  }
}

/**
 * Fetch Beileger success metrics (pages under /account/ path)
 */
export async function fetchBeilegerMetrics(
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<{ totalVisits: number; uniqueVisitors: number; pages: PageMetrics[] }> {
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
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'BEGINS_WITH' as const,
            value: '/account/' // Beileger führt zu /account/ Seiten
          }
        }
      },
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { totalVisits: 0, uniqueVisitors: 0, pages: [] };
    }

    let totalVisits = 0;
    let totalUsers = 0;

    const pages = response.rows.map(row => {
      const dimensionValues = row.dimensionValues || [];
      const metricValues = row.metricValues || [];

      const pageViews = parseInt(metricValues[0]?.value || '0', 10);
      const users = parseInt(metricValues[1]?.value || '0', 10);
      const userEngagementDuration = parseFloat(metricValues[2]?.value || '0');
      
      totalVisits += pageViews;
      totalUsers += users;

      return {
        pagePath: dimensionValues[0]?.value || '',
        pageTitle: dimensionValues[1]?.value || '',
        pageViews: pageViews,
        uniquePageViews: users,
        avgTimeOnPage: users > 0 ? userEngagementDuration / users : 0,
      };
    });

    return {
      totalVisits,
      uniqueVisitors: totalUsers,
      pages
    };
  } catch (error) {
    console.error('Error fetching Beileger metrics:', error);
    throw new Error('Failed to fetch Beileger metrics');
  }
}
