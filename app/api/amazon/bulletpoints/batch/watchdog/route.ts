export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/amazon/bulletpoints/batch/watchdog
 * 
 * Watchdog der prüft ob running Jobs tatsächlich aktiv arbeiten.
 * Wenn ein Job seit >2 Minuten nicht mehr aktualisiert wurde, wird er neu gestartet.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    
    // Finde alle running Jobs
    const runningJobs = await jobsCollection.find({ status: 'running' }).toArray()
    
    if (runningJobs.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No running jobs found',
        checked: 0
      })
    }
    
    const now = new Date()
    const restartedJobs: string[] = []
    
    for (const job of runningJobs) {
      const lastUpdate = job.updated_at || job.started_at || job.created_at
      const timeSinceUpdate = (now.getTime() - new Date(lastUpdate).getTime()) / 1000 // in Sekunden
      
      // Wenn Job seit mehr als 120 Sekunden nicht aktualisiert wurde
      if (timeSinceUpdate > 120) {
        console.log(`[Watchdog] Job ${job._id} ist seit ${Math.floor(timeSinceUpdate)}s inaktiv. Restarting...`)
        
        // Prüfe ob Job wirklich noch unvollständig ist
        if (job.processed < job.artikelIds.length) {
          // Restart Job
          const internalUrl = 'http://localhost:3000'
          try {
            const response = await fetch(`${internalUrl}/api/amazon/bulletpoints/batch/process-job`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: job._id.toString() })
            })
            
            if (response.ok) {
              console.log(`[Watchdog] Job ${job._id} erfolgreich neu gestartet`)
              restartedJobs.push(job._id.toString())
            } else {
              console.error(`[Watchdog] Job ${job._id} restart fehlgeschlagen: ${response.status}`)
            }
          } catch (err: any) {
            console.error(`[Watchdog] Job ${job._id} restart Fehler:`, err.message)
          }
        } else {
          // Job ist vollständig, aber Status ist noch running
          console.log(`[Watchdog] Job ${job._id} ist vollständig, setze Status auf completed`)
          await jobsCollection.updateOne(
            { _id: job._id },
            { 
              $set: { 
                status: 'completed',
                finished_at: new Date()
              }
            }
          )
        }
      }
    }
    
    return NextResponse.json({
      ok: true,
      message: `Checked ${runningJobs.length} running jobs`,
      restarted: restartedJobs
    })
    
  } catch (error: any) {
    console.error('[Watchdog] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
