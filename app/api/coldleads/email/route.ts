export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateEmail, sendEmail, testSMTP } from '../../../../services/coldleads/emailer'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/coldleads/email
 * Generiert personalisierte Email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { website, send = false } = body

    if (!website) {
      return NextResponse.json({
        ok: false,
        error: 'Website ist erforderlich'
      }, { status: 400 })
    }

    // Prospect aus DB laden
    const { db } = await connectToDatabase()
    const collection = db.collection('cold_prospects')
    
    const prospect = await collection.findOne({ website })

    if (!prospect || !prospect.analysis) {
      return NextResponse.json({
        ok: false,
        error: 'Firma muss erst analysiert werden'
      }, { status: 400 })
    }

    // Email generieren mit strukturierten Daten
    const contactPerson = prospect.analysis.contact_persons?.[0]
    
    const email = await generateEmail({
      company_name: prospect.company_name,
      contact_person: contactPerson?.name,
      contact_department: contactPerson?.department,
      industry: prospect.industry,
      analysis: {
        detected_applications: prospect.analysis.company_info.detected_applications || [],
        potential_products: prospect.analysis.needs_assessment.potential_products || [],
        target_materials: prospect.analysis.company_info.target_materials || [],
        estimated_volume: prospect.analysis.needs_assessment.estimated_volume || 'medium',
        reasoning: prospect.analysis.needs_assessment.reasoning || '',
        score: prospect.analysis.needs_assessment.score || 50
      }
    })

    // Wenn send=true → Email versenden
    if (send && contactPerson?.email) {
      const result = await sendEmail(
        contactPerson.email,
        email.subject,
        email.body
      )

      // Status aktualisieren & History hinzufügen
      await collection.updateOne(
        { website },
        {
          $set: {
            status: 'contacted',
            email_sent_at: new Date(),
            updated_at: new Date(),
            last_contact_date: new Date()
          },
          $push: {
            history: {
              type: 'email_sent',
              date: new Date(),
              to: contactPerson.email,
              subject: email.subject,
              body: email.body.substring(0, 500),
              messageId: result.messageId
            }
          }
        }
      )

      return NextResponse.json({
        ok: true,
        email,
        sent: true,
        messageId: result.messageId
      })
    }

    // Nur Email-Entwurf zurückgeben
    return NextResponse.json({
      ok: true,
      email,
      sent: false,
      recipient: contactPerson?.email || 'Keine Email gefunden'
    })

  } catch (error: any) {
    console.error('[ColdLeads Email] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Email-Generierung fehlgeschlagen'
    }, { status: 500 })
  }
}

/**
 * GET /api/coldleads/email/test
 * Testet SMTP-Verbindung
 */
export async function GET() {
  const result = await testSMTP()
  return NextResponse.json(result, {
    status: result.ok ? 200 : 500
  })
}
