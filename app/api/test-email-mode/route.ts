export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    EMAIL_TEST_MODE: process.env.EMAIL_TEST_MODE,
    testModeActive: process.env.EMAIL_TEST_MODE === 'true',
    allEnvVars: {
      hasEmailFrom: !!process.env.EMAIL_FROM,
      hasSmtpHost: !!process.env.SMTP_HOST,
      hasEmailTestMode: !!process.env.EMAIL_TEST_MODE
    }
  })
}
