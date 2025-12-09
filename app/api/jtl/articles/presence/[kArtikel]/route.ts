export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/jtl/articles/presence/:kArtikel
 * Zeigt wo ein Artikel überall vorkommt (Stücklisten, Plattformen, etc.)
 */
export async function GET(request: NextRequest, { params }: { params: { kArtikel: string } }) {
  try {
    const kArtikel = parseInt(params.kArtikel)
    
    if (!kArtikel) {
      return NextResponse.json({ 
        ok: false, 
        error: 'kArtikel erforderlich' 
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    const presence: any = {
      kArtikel,
      stuecklisten: [],
      ebay_angebote: [],
      amazon_angebote: [],
      online_shops: [],
      verkaufskanaele: []
    }

    // 1. In wie vielen Stücklisten kommt der Artikel vor?
    const stuecklistenQuery = await pool.request().query(`
      SELECT 
        s.kStueckliste,
        a.cArtNr as cVaterArtNr,
        a.cName as cVaterName,
        s.fAnzahl as fMenge
      FROM tStueckliste s
      LEFT JOIN tArtikel a ON s.kArtikel = a.kArtikel
      WHERE s.kArtikelKomponente = ${kArtikel}
    `)
    presence.stuecklisten = stuecklistenQuery.recordset

    // 2. eBay-Angebote
    const ebayQuery = await pool.request().query(`
      SELECT TOP 10
        e.ItemID,
        e.cTitel as Title,
        e.cPlattform as Platform,
        e.fPrice as Price,
        e.nVerkauft as Sold
      FROM ebay_item e
      WHERE e.kArtikel = ${kArtikel}
        AND e.nAktiv = 1
      ORDER BY e.dEingestellt DESC
    `)
    presence.ebay_angebote = ebayQuery.recordset

    // 3. Amazon-Angebote
    const amazonQuery = await pool.request().query(`
      SELECT TOP 10
        a.cSellerSKU as SellerSKU,
        a.cASIN as ASIN,
        p.cName as Platform,
        a.fPreis as Price
      FROM pf_amazon_angebot a
      LEFT JOIN tPlattform p ON a.kPlattform = p.kPlattform
      WHERE a.kArtikel = ${kArtikel}
        AND a.nAktiv = 1
    `)
    presence.amazon_angebote = amazonQuery.recordset

    // 4. Shop-Präsenz
    const shopQuery = await pool.request().query(`
      SELECT 
        s.cName as ShopName,
        s.cURL as ShopURL,
        arsh.cURL as ArtikelURL
      FROM tArtikelShop arsh
      LEFT JOIN tShop s ON arsh.kShop = s.kShop
      WHERE arsh.kArtikel = ${kArtikel}
    `)
    presence.online_shops = shopQuery.recordset

    // 5. Verkaufskanäle (SCX)
    const scxQuery = await pool.request().query(`
      SELECT TOP 10
        c.cName as Channel,
        o.cExternId as ExternID,
        o.fPrice as Price,
        o.nActive as Active
      FROM SCX.tOffer o
      LEFT JOIN SCX.tChannel c ON o.kChannel = c.kChannel
      WHERE o.kArtikel = ${kArtikel}
      ORDER BY o.dModified DESC
    `)
    presence.verkaufskanaele = scxQuery.recordset

    // Zusammenfassung
    const summary = {
      in_stuecklisten: presence.stuecklisten.length,
      auf_ebay: presence.ebay_angebote.length,
      auf_amazon: presence.amazon_angebote.length,
      in_shops: presence.online_shops.length,
      in_verkaufskanaelen: presence.verkaufskanaele.length,
      gesamt_praesenz: presence.stuecklisten.length + 
                       presence.ebay_angebote.length + 
                       presence.amazon_angebote.length + 
                       presence.online_shops.length +
                       presence.verkaufskanaele.length
    }

    return NextResponse.json({ 
      ok: true,
      presence,
      summary
    })
  } catch (error: any) {
    console.error('[Artikel Presence] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
