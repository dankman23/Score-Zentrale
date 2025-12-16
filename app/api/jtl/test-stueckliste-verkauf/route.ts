export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Finde einen Auftrag mit Stückliste
    const query = `
      SELECT TOP 1
        o.kAuftrag,
        o.dErstellt,
        parent.cArtNr as ParentArtNr,
        parent_op.fVKNetto as ParentVK,
        parent_op.fAnzahl as ParentMenge
      FROM Verkauf.tAuftragPosition parent_op
      INNER JOIN Verkauf.tAuftrag o ON parent_op.kAuftrag = o.kAuftrag
      INNER JOIN dbo.tArtikel parent ON parent_op.kArtikel = parent.kArtikel
      WHERE EXISTS (SELECT 1 FROM dbo.tStueckliste WHERE kVaterArtikel = parent.kArtikel)
        AND o.dErstellt >= '2024-11-01'
        AND o.nType = 1
      ORDER BY o.dErstellt DESC
    `
    
    const result = await pool.request().query(query)
    
    if (result.recordset.length === 0) {
      return NextResponse.json({ ok: true, message: 'Keine Stücklisten-Verkäufe gefunden' })
    }
    
    const auftrag = result.recordset[0]
    
    // Alle Positionen dieses Auftrags
    const posQuery = `
      SELECT 
        op.kAuftragPosition,
        a.cArtNr,
        op.fAnzahl,
        op.fVKNetto,
        op.fVKNetto * op.fAnzahl as Gesamt,
        CASE WHEN EXISTS (SELECT 1 FROM dbo.tStueckliste WHERE kVaterArtikel = a.kArtikel) THEN 'Parent' ELSE 'Normal' END as Typ
      FROM Verkauf.tAuftragPosition op
      INNER JOIN dbo.tArtikel a ON op.kArtikel = a.kArtikel
      WHERE op.kAuftrag = @kAuftrag
      ORDER BY op.kAuftragPosition
    `
    
    const positions = await pool.request()
      .input('kAuftrag', auftrag.kAuftrag)
      .query(posQuery)
    
    // Stückliste des Parents
    const stuecklisteQuery = `
      SELECT 
        a.cArtNr,
        sl.fAnzahl
      FROM dbo.tStueckliste sl
      INNER JOIN dbo.tArtikel a ON sl.kArtikel = a.kArtikel
      WHERE sl.kVaterArtikel = (SELECT kArtikel FROM dbo.tArtikel WHERE cArtNr = @parentArtNr)
    `
    
    const stueckliste = await pool.request()
      .input('parentArtNr', auftrag.ParentArtNr)
      .query(stuecklisteQuery)
    
    return NextResponse.json({
      ok: true,
      auftrag: {
        kAuftrag: auftrag.kAuftrag,
        datum: auftrag.dErstellt,
        parentArtikel: auftrag.ParentArtNr
      },
      positionen: positions.recordset,
      stueckliste: stueckliste.recordset,
      analyse: {
        anzahlPositionen: positions.recordset.length,
        gesamtWert: positions.recordset.reduce((sum, p) => sum + p.Gesamt, 0),
        hatParent: positions.recordset.some(p => p.Typ === 'Parent'),
        hatChildren: positions.recordset.some(p => stueckliste.recordset.find(s => s.cArtNr === p.cArtNr))
      }
    })
    
  } catch (error: any) {
    console.error('[Test Stueckliste] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
