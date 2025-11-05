export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { firstExistingTable, hasColumn, inclusiveDateWhere, pickFirstExisting } from '../../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/purchase/expenses
 * Lieferantenrechnungen (Eingangsrechnungen) aggregieren: Netto/Brutto, Material/Fracht/Other
 * Fallback auf Wareneingang falls keine Rechnungstabellen vorhanden
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)

    const pool = await getMssqlPool()

    // Tabellenkandidaten für Eingangsrechnungen
    const headerCandidates = [
      'Einkauf.tEingangsrechnung',
      'dbo.tEingangsrechnung',
      'Eingang.tEingangsrechnung',
      'dbo.tLieferantenrechnung'
    ]
    const posCandidates = [
      'Einkauf.tEingangsrechnungPos',
      'dbo.tEingangsrechnungPos',
      'Eingang.tEingangsrechnungPos',
      'dbo.tLieferantenrechnungPos'
    ]

    const headerTable = await firstExistingTable(pool, headerCandidates)
    const posTable = await firstExistingTable(pool, posCandidates)

    // Fallback auf Wareneingang
    if (!headerTable || !posTable) {
      return await handleGoodsReceipts(pool, from, to)
    }

    // Datumsspalten-Priorität
    const dateColumns = ['dBelegDatum', 'dErstellt', 'dEingang']
    const dateField = await pickFirstExisting(pool, headerTable, dateColumns) || 'dErstellt'

    // Posted-Filter
    const hasVerbucht = await hasColumn(pool, headerTable, 'nVerbucht')
    const postedFilter = hasVerbucht ? 'AND h.nVerbucht = 1' : ''

    // Positionsfelder robust ermitteln
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge', 'fAnzahl', 'nAnzahl']) || 'fMenge'
    const mwstField = await pickFirstExisting(pool, posTable, ['fMwSt', 'fMwst', 'fMwStProzent', 'MwSt']) || 'fMwSt'
    
    // Netto- und Brutto-Summen - robuste Ermittlung
    let netExpr: string
    let grossExpr: string
    
    const hasGesamtNetto = await hasColumn(pool, posTable, 'fGesamtNetto')
    const hasGesamtBrutto = await hasColumn(pool, posTable, 'fGesamtBrutto')
    const hasVKNetto = await hasColumn(pool, posTable, 'fVKNetto')
    const hasVKBrutto = await hasColumn(pool, posTable, 'fVKBrutto')
    const hasEKNetto = await hasColumn(pool, posTable, 'fEKNetto')
    
    if (hasGesamtNetto) {
      netExpr = 'COALESCE(p.fGesamtNetto, 0)'
    } else if (hasVKNetto) {
      netExpr = `COALESCE(p.fVKNetto * COALESCE(p.${qtyField}, 1), 0)`
    } else if (hasEKNetto) {
      netExpr = `COALESCE(p.fEKNetto * COALESCE(p.${qtyField}, 1), 0)`
    } else {
      netExpr = '0'
    }
    
    if (hasGesamtBrutto) {
      grossExpr = 'COALESCE(p.fGesamtBrutto, 0)'
    } else if (hasVKBrutto) {
      grossExpr = `COALESCE(p.fVKBrutto * COALESCE(p.${qtyField}, 1), 0)`
    } else {
      grossExpr = `(${netExpr}) * (1 + COALESCE(p.${mwstField}, 19) / 100.0)`
    }

    // Fracht-Erkennung
    const nameField = await pickFirstExisting(pool, posTable, ['cName', 'cArtikelName']) || 'cName'
    const artNrField = await pickFirstExisting(pool, posTable, ['cArtNr', 'cArtikelNr']) || 'cArtNr'
    
    const freightDetection = `
      CASE 
        WHEN LOWER(ISNULL(p.${nameField},'')) LIKE '%fracht%' 
          OR LOWER(ISNULL(p.${nameField},'')) LIKE '%versand%'
          OR LOWER(ISNULL(p.${nameField},'')) LIKE '%zoll%'
          OR LOWER(ISNULL(p.${nameField},'')) LIKE '%transport%'
          OR LOWER(ISNULL(p.${nameField},'')) LIKE '%gebühr%'
          OR LOWER(ISNULL(p.${artNrField},'')) LIKE '%fracht%'
        THEN 'freight'
        ELSE 'material'
      END
    `

    // Währung
    const hasCurrency = await hasColumn(pool, headerTable, 'cWaehrung')
    const hasKurs = await hasColumn(pool, headerTable, 'fKurs')
    const currencyNormalizer = (hasCurrency && hasKurs) 
      ? '/ NULLIF(h.fKurs, 0)' 
      : ''
    const currencyDebug = (hasCurrency && hasKurs) ? 'EUR (converted)' : 'EUR (assumed)'

    const query = `
      WITH Invoices AS (
        SELECT 
          h.kEingangsrechnung AS id,
          p.${nameField} AS posName,
          (${netExpr}) ${currencyNormalizer} AS net,
          (${grossExpr}) ${currencyNormalizer} AS gross,
          ${freightDetection} AS category
        FROM ${headerTable} h
        INNER JOIN ${posTable} p ON h.kEingangsrechnung = p.kEingangsrechnung
        WHERE CAST(h.${dateField} AS DATE) BETWEEN @from AND @to
          ${postedFilter}
      )
      SELECT 
        COUNT(DISTINCT id) AS invoices,
        SUM(net) AS total_net,
        SUM(gross) AS total_gross,
        SUM(CASE WHEN category = 'material' THEN net ELSE 0 END) AS material_net,
        SUM(CASE WHEN category = 'freight' THEN net ELSE 0 END) AS freight_net,
        SUM(CASE WHEN category NOT IN ('material','freight') THEN net ELSE 0 END) AS other_net
      FROM Invoices
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset[0] || {}

    return NextResponse.json({
      ok: true,
      period: { from, to },
      invoices: row.invoices || 0,
      net: parseFloat(row.total_net || 0).toFixed(2),
      gross: parseFloat(row.total_gross || 0).toFixed(2),
      cost_components: {
        material: parseFloat(row.material_net || 0).toFixed(2),
        freight: parseFloat(row.freight_net || 0).toFixed(2),
        other: parseFloat(row.other_net || 0).toFixed(2)
      },
      debug: {
        headerTable,
        posTable,
        dateFieldUsed: dateField,
        currency: currencyDebug,
        source: 'invoices'
      }
    })

  } catch (error: any) {
    console.error('[/api/jtl/purchase/expenses] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Fallback: Wareneingang verwenden wenn keine Eingangsrechnungen
 */
async function handleGoodsReceipts(pool: any, from: string, to: string) {
  try {
    const headerCandidates = ['Einkauf.tWareneingang', 'dbo.tWareneingang']
    const posCandidates = ['Einkauf.tWareneingangPos', 'dbo.tWareneingangPos']

    const headerTable = await firstExistingTable(pool, headerCandidates)
    const posTable = await firstExistingTable(pool, posCandidates)

    if (!headerTable || !posTable) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Eingangsrechnungs- oder Wareneingangs-Tabellen gefunden'
      }, { status: 404 })
    }

    const dateField = await pickFirstExisting(pool, headerTable, ['dErstellt', 'dDatum']) || 'dErstellt'
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge', 'fAnzahl']) || 'fMenge'
    const ekField = await pickFirstExisting(pool, posTable, ['fEKNetto', 'fEK']) || 'fEKNetto'

    const query = `
      SELECT 
        COUNT(DISTINCT h.kWareneingang) AS invoices,
        SUM(p.${ekField} * p.${qtyField}) AS total_net
      FROM ${headerTable} h
      INNER JOIN ${posTable} p ON h.kWareneingang = p.kWareneingang
      WHERE CAST(h.${dateField} AS DATE) BETWEEN @from AND @to
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset[0] || {}
    const net = parseFloat(row.total_net || 0)

    return NextResponse.json({
      ok: true,
      period: { from, to },
      invoices: row.invoices || 0,
      net: net.toFixed(2),
      gross: (net * 1.19).toFixed(2), // Annahme 19% MwSt
      cost_components: {
        material: net.toFixed(2),
        freight: '0.00',
        other: '0.00'
      },
      debug: {
        headerTable,
        posTable,
        dateFieldUsed: dateField,
        currency: 'EUR (assumed)',
        source: 'goods_receipts'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || 'Goods receipts fallback failed'
    }, { status: 500 })
  }
}
