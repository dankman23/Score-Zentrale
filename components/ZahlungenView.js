'use client'

import { useState, useEffect } from 'react'

export default function ZahlungenView({ zeitraum, initialFilter }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 500,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  
  // Filter States
  const [anbieterFilter, setAnbieterFilter] = useState('alle')
  const [zuordnungFilter, setZuordnungFilter] = useState(initialFilter || 'alle')
  const [richtungFilter, setRichtungFilter] = useState('alle')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Zuordnungs-Modal
  const [showZuordnungModal, setShowZuordnungModal] = useState(false)
  const [selectedZahlung, setSelectedZahlung] = useState(null)

  // Load data when zeitraum or page changes
  useEffect(() => {
    if (zeitraum) {
      loadZahlungen()
    }
  }, [zeitraum, pagination.page])

  async function loadZahlungen(page = pagination.page) {
    setLoading(true)
    try {
      const [from, to] = zeitraum.split('_')
      console.log(`[ZahlungenView] Loading from ${from} to ${to}, Page ${page}`)
      
      const res = await fetch(`/api/fibu/zahlungen?from=${from}&to=${to}&page=${page}&pageSize=${pagination.pageSize}`)
      const data = await res.json()
      
      console.log('[ZahlungenView] API Response:', {
        ok: data.ok,
        zahlungenCount: data.zahlungen?.length,
        pagination: data.pagination,
        sample: data.zahlungen?.[0]
      })
      
      if (data.ok) {
        setZahlungen(data.zahlungen || [])
        setStats(data.stats)
        if (data.pagination) {
          setPagination(data.pagination)
        }
      } else {
        console.error('[ZahlungenView] API Error:', data.error)
      }
    } catch (error) {
      console.error('[ZahlungenView] Fetch Error:', error)
    }
    setLoading(false)
  }
  
  function handlePageChange(newPage) {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  // Filter zahlungen
  const filteredZahlungen = zahlungen.filter(z => {
    if (anbieterFilter !== 'alle' && z.anbieter !== anbieterFilter) return false
    if (zuordnungFilter === 'zugeordnet' && !z.istZugeordnet) return false
    if (zuordnungFilter === 'nicht_zugeordnet' && z.istZugeordnet) return false
    if (richtungFilter === 'eingang' && z.betrag <= 0) return false
    if (richtungFilter === 'ausgang' && z.betrag >= 0) return false
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        z.zahlungId?.toLowerCase().includes(search) ||
        z.verwendungszweck?.toLowerCase().includes(search) ||
        z.gegenkonto?.toLowerCase().includes(search) ||
        z.anbieter?.toLowerCase().includes(search) ||
        z.zugeordneteRechnung?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  // Unique providers
  const uniqueAnbieter = [...new Set(zahlungen.map(z => z.anbieter))].filter(Boolean).sort()

  // Statistics (lokale Filter-Stats)
  const localStats = {
    gesamt: filteredZahlungen.length,
    eingaenge: filteredZahlungen.filter(z => z.betrag > 0).length,
    ausgaenge: filteredZahlungen.filter(z => z.betrag < 0).length,
    zugeordnet: filteredZahlungen.filter(z => z.istZugeordnet).length,
    nichtZugeordnet: filteredZahlungen.filter(z => !z.istZugeordnet).length,
    summeEingaenge: filteredZahlungen.filter(z => z.betrag > 0).reduce((sum, z) => sum + (z.betrag || 0), 0),
    summeAusgaenge: filteredZahlungen.filter(z => z.betrag < 0).reduce((sum, z) => sum + (z.betrag || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Zahlungen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">💳 Zahlungen (Alle Konten)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Amazon, PayPal, Commerzbank, Postbank, Mollie
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-gray-700 text-xs mb-2 font-medium">Zahlungsanbieter</label>
            <select
              value={anbieterFilter}
              onChange={(e) => setAnbieterFilter(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle ({zahlungen.length})</option>
              {uniqueAnbieter.map(anbieter => (
                <option key={anbieter} value={anbieter}>
                  {anbieter} ({zahlungen.filter(z => z.anbieter === anbieter).length})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 text-xs mb-2 font-medium">Zuordnung</label>
            <select
              value={zuordnungFilter}
              onChange={(e) => setZuordnungFilter(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle</option>
              <option value="zugeordnet">✅ Zugeordnet</option>
              <option value="nicht_zugeordnet">❌ Nicht zugeordnet</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 text-xs mb-2 font-medium">Richtung</label>
            <select
              value={richtungFilter}
              onChange={(e) => setRichtungFilter(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle</option>
              <option value="eingang">💰 Eingänge</option>
              <option value="ausgang">💸 Ausgänge</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-700 text-xs mb-2 font-medium">Suche</label>
            <input
              type="text"
              placeholder="Betrag, Kunde, Verwendungszweck..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        
        {(anbieterFilter !== 'alle' || zuordnungFilter !== 'alle' || richtungFilter !== 'alle' || searchTerm) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-700 text-sm font-medium">Aktive Filter:</span>
            {anbieterFilter !== 'alle' && (
              <button
                onClick={() => setAnbieterFilter('alle')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
              >
                {anbieterFilter} ×
              </button>
            )}
            {zuordnungFilter !== 'alle' && (
              <button
                onClick={() => setZuordnungFilter('alle')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
              >
                {zuordnungFilter === 'zugeordnet' ? 'Zugeordnet' : 'Nicht zugeordnet'} ×
              </button>
            )}
            {richtungFilter !== 'alle' && (
              <button
                onClick={() => setRichtungFilter('alle')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
              >
                {richtungFilter === 'eingang' ? 'Eingänge' : 'Ausgänge'} ×
              </button>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
              >
                "{searchTerm}" ×
              </button>
            )}
            <button
              onClick={() => {
                setAnbieterFilter('alle')
                setZuordnungFilter('alle')
                setRichtungFilter('alle')
                setSearchTerm('')
              }}
              className="text-gray-600 text-xs underline ml-2"
            >
              Alle zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">Angezeigt</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.gesamt}</div>
          <div className="text-xs text-gray-500">von {zahlungen.length} gesamt</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💰 Eingänge</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.eingaenge}</div>
          <div className="text-xs text-green-700 font-medium">+{stats.summeEingaenge.toFixed(2)}€</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💸 Ausgänge</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.ausgaenge}</div>
          <div className="text-xs text-red-700 font-medium">{stats.summeAusgaenge.toFixed(2)}€</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">✅ Zugeordnet</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.zugeordnet}</div>
          <div className="text-xs text-gray-500">
            {stats.gesamt > 0 ? Math.round((stats.zugeordnet / stats.gesamt) * 100) : 0}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">❌ Offen</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.nichtZugeordnet}</div>
          <div className="text-xs text-gray-500">
            {stats.gesamt > 0 ? Math.round((stats.nichtZugeordnet / stats.gesamt) * 100) : 0}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💵 Saldo</div>
          <div className={`text-2xl font-bold mt-1 ${
            (stats.summeEingaenge + stats.summeAusgaenge) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {(stats.summeEingaenge + stats.summeAusgaenge).toFixed(2)}€
          </div>
          <div className="text-xs text-gray-500">Gefiltert</div>
        </div>
      </div>

      {/* Debug Info */}
      {zahlungen.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
          <div className="font-medium text-blue-900 mb-1">Debug Info:</div>
          <div className="text-blue-700">
            Geladene Zahlungen: {zahlungen.length} | 
            Erste Zahlung: Datum={zahlungen[0]?.datum}, Anbieter={zahlungen[0]?.anbieter}, Betrag={zahlungen[0]?.betrag}
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anbieter</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rechnung</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hinweis</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zuordnung</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredZahlungen.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-3 py-8 text-center text-gray-500">
                    Keine Zahlungen gefunden
                  </td>
                </tr>
              ) : (
                filteredZahlungen.map((zahlung, idx) => {
                  // Parse date
                  let datumFormatted = 'Invalid Date'
                  try {
                    if (zahlung.datum) {
                      const date = new Date(zahlung.datum)
                      if (!isNaN(date.getTime())) {
                        datumFormatted = date.toLocaleDateString('de-DE', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: '2-digit' 
                        })
                      }
                    }
                  } catch (e) {
                    console.error('Date parse error:', e, zahlung.datum)
                  }

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {datumFormatted}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        <span className="font-medium text-gray-900">{zahlung.anbieter || '-'}</span>
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-bold whitespace-nowrap ${
                        (zahlung.betrag || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(zahlung.betrag || 0) >= 0 ? '+' : ''}{(zahlung.betrag || 0).toFixed(2)}€
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {zahlung.istZugeordnet && zahlung.zugeordneteRechnung ? (
                          <span className="text-blue-600 font-medium">📄 {zahlung.zugeordneteRechnung}</span>
                        ) : zahlung.zugeordnetesKonto ? (
                          <span className="text-purple-600 font-medium">📊 {zahlung.zugeordnetesKonto}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[150px]">
                        <div className="truncate" title={zahlung.gegenkonto || zahlung.kundenEmail}>
                          {zahlung.gegenkonto || zahlung.kundenEmail || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[200px]">
                        <div className="truncate" title={zahlung.verwendungszweck}>
                          {zahlung.verwendungszweck || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {zahlung.istZugeordnet ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ {zahlung.zuordnungsArt || 'Zugeordnet'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            ⚪ Offen
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedZahlung(zahlung)
                            setShowZuordnungModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Zuordnen
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zuordnungs-Modal */}
      {showZuordnungModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Zahlung zuordnen</h3>
            <p className="text-gray-600 mb-4">
              Zahlung: {selectedZahlung?.betrag?.toFixed(2)}€ von {selectedZahlung?.anbieter}
            </p>
            <p className="text-sm text-gray-500 mb-4">Zuordnungsfunktion wird implementiert...</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowZuordnungModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                Abbrechen
              </button>
              <button
                onClick={() => setShowZuordnungModal(false)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
