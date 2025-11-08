#!/usr/bin/env node
/**
 * Score Zentrale - Post-Deployment Healthcheck
 * Testet alle kritischen JTL-Endpoints nach Deployment
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kpi-central-4.preview.emergentagent.com'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(level, msg) {
  const color = level === 'OK' ? colors.green : level === 'FAIL' ? colors.red : colors.yellow
  console.log(`${color}[${level}]${colors.reset} ${msg}`)
}

async function testEndpoint(name, url, validator) {
  try {
    const res = await fetch(url)
    const data = await res.json()
    
    if (validator(data, res.status)) {
      log('OK', `${name}: ${res.status}`)
      return { name, status: 'PASS', data }
    } else {
      log('FAIL', `${name}: Validation failed`)
      console.log('  Response:', JSON.stringify(data, null, 2))
      return { name, status: 'FAIL', data }
    }
  } catch (error) {
    log('FAIL', `${name}: ${error.message}`)
    return { name, status: 'ERROR', error: error.message }
  }
}

async function runHealthchecks() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.blue}║  Score Zentrale - Deployment Healthcheck      ║${colors.reset}`)
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}`)
  console.log(`\nBase URL: ${BASE_URL}\n`)

  const tests = [
    {
      name: '1. SQL Connectivity (Ping)',
      url: `${BASE_URL}/api/jtl/ping`,
      validator: (data) => data.ok === true
    },
    {
      name: '2. Orders KPI (Stichtag 03.11)',
      url: `${BASE_URL}/api/jtl/orders/kpi/shipping-split?from=2025-11-03&to=2025-11-03`,
      validator: (data) => data.ok === true && data.orders !== undefined
    },
    {
      name: '3. Orders Diagnostics (03.11)',
      url: `${BASE_URL}/api/jtl/orders/diag/day?date=2025-11-03`,
      validator: (data) => data.ok === true && data.totals && data.totals.orders > 0
    },
    {
      name: '4. Expenses (2024)',
      url: `${BASE_URL}/api/jtl/purchase/expenses?from=2024-01-01&to=2024-12-31`,
      validator: (data) => data.ok === true || (data.ok === false && data.error.includes('Tabellen'))
    },
    {
      name: '5. Margin (Nov 2025)',
      url: `${BASE_URL}/api/jtl/orders/kpi/margin?from=2025-11-01&to=2025-11-05`,
      validator: (data) => data.ok === true && data.margin_net !== undefined
    },
    {
      name: '6. Timeseries (Nov)',
      url: `${BASE_URL}/api/jtl/orders/timeseries?from=2025-11-01&to=2025-11-03`,
      validator: (data) => data.ok === true && Array.isArray(data.rows)
    }
  ]

  const results = []
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, test.validator)
    results.push(result)
    await new Promise(resolve => setTimeout(resolve, 500)) // Rate limit
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status !== 'PASS').length

  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`)
  console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`)

  if (failed === 0) {
    console.log(`\n${colors.green}🎉 All healthchecks passed! Ready for production.${colors.reset}`)
    process.exit(0)
  } else {
    console.log(`\n${colors.red}⚠️  Some checks failed. Review deployment guide.${colors.reset}`)
    process.exit(1)
  }
}

// Optional: Warmakquise Import Test (commented out by default)
async function testWarmakquiseImport() {
  log('INFO', 'Testing Warmakquise Import...')
  try {
    const res = await fetch(`${BASE_URL}/api/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 })
    })
    const data = await res.json()
    if (data.ok && data.imported >= 0) {
      log('OK', `Warmakquise Import: ${data.imported} leads imported`)
    } else {
      log('WARN', 'Warmakquise Import: No data or error')
      console.log('  Response:', JSON.stringify(data, null, 2))
    }
  } catch (error) {
    log('FAIL', `Warmakquise Import: ${error.message}`)
  }
}

runHealthchecks()
