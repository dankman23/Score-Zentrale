'use client'

import { useState, useEffect } from 'react'

export default function ZahlungenView({ zeitraum: zeitraumProp, initialFilter }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState(zeitraumProp || '2025-10-01_2025-11-30')
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)
  
  // Filter States
  const [anbieterFilter, setAnbieterFilter] = useState('alle')
  const [zuordnungFilter, setZuordnungFilter] = useState(initialFilter || 'alle') // 'alle', 'zugeordnet', 'nicht_zugeordnet'
  const [richtungFilter, setRichtungFilter] = useState('alle') // 'alle', 'eingang', 'ausgang'
  const [searchTerm, setSearchTerm] = useState('')

  // Update zeitraum when prop changes
  useEffect(() => {
    if (zeitraumProp) {
      setZeitraum(zeitraumProp)
    }
  }, [zeitraumProp])

  // Update filter when initialFilter prop changes
  useEffect(() => {
    if (initialFilter) {
      setZuordnungFilter(initialFilter)
    }
  }, [initialFilter])

  useEffect(() => {
    loadZahlungen()
  }, [zeitraum, alleAnzeigen])

  async function loadZahlungen() {
    setLoading(true)
    try {
      const [from, to] = alleAnzeigen ? ['2020-01-01', '2099-12-31'] : zeitraum.split('_')
      
      // Lade Zahlungen aus API (holt aus JTL und speichert in MongoDB)
      const res = await fetch(`/api/fibu/zahlungen?from=${from}&to=${to}`)
      const data = await res.json()
      
      if (data.ok) {
        setZahlungen(data.zahlungen || [])
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  // Filtern
  const filteredZahlungen = zahlungen.filter(z => {
    // Anbieter-Filter
    if (anbieterFilter !== 'alle' && z.zahlungsanbieter !== anbieterFilter) {
      return false
    }
    
    // Zuordnungs-Filter
    if (zuordnungFilter === 'zugeordnet' && !z.istZugeordnet) {
      return false
    }
    if (zuordnungFilter === 'nicht_zugeordnet' && z.istZugeordnet) {
      return false
    }
    
    // Richtungs-Filter
    if (richtungFilter === 'eingang' && z.betrag <= 0) {
      return false
    }
    if (richtungFilter === 'ausgang' && z.betrag >= 0) {
      return false
    }
    
    // Such-Filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        z.rechnungsNr?.toLowerCase().includes(search) ||
        z.hinweis?.toLowerCase().includes(search) ||
        z.kundenName?.toLowerCase().includes(search) ||
        z.zahlungsanbieter?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  // Einzigartige Zahlungsanbieter für Filter
  const uniqueAnbieter = [...new Set(zahlungen.map(z => z.zahlungsanbieter))].sort()

  // Statistiken
  const stats = {
    gesamt: filteredZahlungen.length,
    eingaenge: filteredZahlungen.filter(z => z.betrag > 0).length,
    ausgaenge: filteredZahlungen.filter(z => z.betrag < 0).length,
    zugeordnet: filteredZahlungen.filter(z => z.istZugeordnet).length,
    nichtZugeordnet: filteredZahlungen.filter(z => !z.istZugeordnet).length,
    summeEingaenge: filteredZahlungen.filter(z => z.betrag > 0).reduce((sum, z) => sum + z.betrag, 0),
    summeAusgaenge: filteredZahlungen.filter(z => z.betrag < 0).reduce((sum, z) => sum + z.betrag, 0)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💳 Zahlungen (Alle Konten)</h2>
          <p className="text-sm text-gray-600 mt-1">
            PayPal, Amazon, eBay, Commerzbank, Mollie und mehr
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={alleAnzeigen}
              onChange={(e) => setAlleAnzeigen(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Alle anzeigen</span>
          </label>
          
          {!alleAnzeigen && (
            <select
              value={zeitraum}
              onChange={(e) => setZeitraum(e.target.value)}
              className="bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 text-sm"
            >
              <option value="2025-10-01_2025-10-31">Oktober 2025</option>
              <option value="2025-11-01_2025-11-30">November 2025</option>
              <option value="2025-10-01_2025-11-30">Okt + Nov 2025</option>
              <option value="2025-01-01_2025-12-31">Gesamtes Jahr 2025</option>
            </select>
          )}
          
          <button
            onClick={() => {
              if (confirm('Zahlungen neu aus JTL laden? Dies kann 30-40 Sekunden dauern.')) {
                window.location.href = window.location.href + '&reload=true'
              }
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium"
          >
            ⚡ Neu laden (JTL)
          </button>
          
          <button
            onClick={loadZahlungen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-gray-700 text-xs mb-2 font-medium">Zahlungsanbieter</label>
            <select
              value={anbieterFilter}
              onChange={(e) => setAnbieterFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle Anbieter ({uniqueAnbieter.length})</option>
              {uniqueAnbieter.map(anbieter => (
                <option key={anbieter} value={anbieter}>
                  {anbieter} ({zahlungen.filter(z => z.zahlungsanbieter === anbieter).length})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 text-xs mb-2 font-medium">Zuordnung</label>
            <select
              value={zuordnungFilter}
              onChange={(e) => setZuordnungFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
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
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle</option>
              <option value="eingang">💰 Eingänge (positiv)</option>
              <option value="ausgang">💸 Ausgänge (negativ)</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-700 text-xs mb-2 font-medium">Suche</label>
            <input
              type="text"
              placeholder="RgNr, Hinweis, Kunde, Anbieter..."
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
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
              >
                Anbieter: {anbieterFilter} <span className="ml-1">×</span>
              </button>
            )}
            {zuordnungFilter !== 'alle' && (
              <button
                onClick={() => setZuordnungFilter('alle')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
              >
                Zuordnung: {zuordnungFilter === 'zugeordnet' ? 'Ja' : 'Nein'} <span className="ml-1">×</span>
              </button>
            )}
            {richtungFilter !== 'alle' && (
              <button
                onClick={() => setRichtungFilter('alle')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
              >
                Richtung: {richtungFilter === 'eingang' ? 'Eingang' : 'Ausgang'} <span className="ml-1">×</span>
              </button>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
              >
                Suche: "{searchTerm}" <span className="ml-1">×</span>
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

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxWidth: '100vw' }}>
          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anbieter</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rechnung</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hinweis/Bestellnr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zuordnung</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quelle</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredZahlungen.map((zahlung, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(zahlung.zahlungsdatum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">{zahlung.zahlungsanbieter}</span>
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${
                    zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {zahlung.kRechnung > 0 ? (
                      <span className="text-blue-600 font-medium">{zahlung.rechnungsNr}</span>
                    ) : (
                      <span className="text-gray-400">{zahlung.rechnungsNr}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {zahlung.kundenName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="max-w-xs">
                      {zahlung.cBestellNr && (
                        <div className="font-medium text-blue-600 mb-1">
                          📦 {zahlung.cBestellNr}
                        </div>
                      )}
                      <div className="text-xs truncate" title={zahlung.hinweis}>
                        {zahlung.hinweis || '-'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {zahlung.istZugeordnet ? (
                      <div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          ✓ Zugeordnet
                        </span>
                        {zahlung.zuordnungstyp && (
                          <div className="text-xs text-gray-500 mt-1">{zahlung.zuordnungstyp}</div>
                        )}
                        {zahlung.kRechnung > 0 && !zahlung.zuordnungstyp && (
                          <div className="text-xs text-gray-500 mt-1">kRg: {zahlung.kRechnung}</div>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        ○ Offen
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs rounded ${
                      zahlung.quelle === 'tZahlung' 
                        ? 'bg-blue-100 text-blue-700' 
                        : zahlung.quelle === 'postbank'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {zahlung.quelle === 'tZahlung' ? 'JTL' : zahlung.quelle === 'postbank' ? 'Postbank' : 'Bank'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredZahlungen.length === 0 && zahlungen.length > 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Keine Zahlungen gefunden, die den Filterkriterien entsprechen.</p>
            <button
              onClick={() => {
                setAnbieterFilter('alle')
                setZuordnungFilter('alle')
                setRichtungFilter('alle')
                setSearchTerm('')
              }}
              className="mt-4 text-blue-600 underline"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
        
        {zahlungen.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Keine Zahlungen im gewählten Zeitraum gefunden.</p>
          </div>
        )}
      </div>
    </div>
  )
}
