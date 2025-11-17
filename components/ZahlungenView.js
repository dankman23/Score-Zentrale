'use client'

import { useState, useEffect } from 'react'

export default function ZahlungenView({ zeitraum: zeitraumProp, initialFilter, onRefreshRequest }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState(zeitraumProp || '2025-10-01_2025-11-30')
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)
  
  // Filter States
  const [anbieterFilter, setAnbieterFilter] = useState('alle')
  const [zuordnungFilter, setZuordnungFilter] = useState(initialFilter || 'alle') // 'alle', 'zugeordnet', 'nicht_zugeordnet'
  const [richtungFilter, setRichtungFilter] = useState('alle') // 'alle', 'eingang', 'ausgang'
  const [searchTerm, setSearchTerm] = useState('')
  
  // Zuordnungs-Modal
  const [showZuordnungModal, setShowZuordnungModal] = useState(false)
  const [selectedZahlung, setSelectedZahlung] = useState(null)

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
      
      // Lade Zahlungen aus API (holt aus MongoDB Cache)
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
    if (anbieterFilter !== 'alle' && z.anbieter !== anbieterFilter) {
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
        z.zahlungId?.toLowerCase().includes(search) ||
        z.verwendungszweck?.toLowerCase().includes(search) ||
        z.gegenkonto?.toLowerCase().includes(search) ||
        z.anbieter?.toLowerCase().includes(search) ||
        z.zugeordneteRechnung?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  // Einzigartige Zahlungsanbieter für Filter
  const uniqueAnbieter = [...new Set(zahlungen.map(z => z.anbieter))].filter(Boolean).sort()

  // Statistiken
  const stats = {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💳 Zahlungen (Alle Konten)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Amazon, PayPal, Commerzbank, Postbank, Mollie
          </p>
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
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle Anbieter ({uniqueAnbieter.length})</option>
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

      {/* Tabelle - Komprimiert mit horizontalem Scrollbalken */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Datum</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Anbieter</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Betrag</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Rechnung</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Kunde</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap max-w-xs">Hinweis</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Zuordnung</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Quelle</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredZahlungen.map((zahlung, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {zahlung.datum ? new Date(zahlung.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Invalid Date'}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    <span className="font-medium text-gray-900">{zahlung.anbieter || '-'}</span>
                  </td>
                  <td className={`px-2 py-2 text-xs text-right font-bold whitespace-nowrap ${
                    (zahlung.betrag || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(zahlung.betrag || 0) >= 0 ? '+' : ''}{(zahlung.betrag || 0).toFixed(2)}€
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {zahlung.istZugeordnet && zahlung.zugeordneteRechnung ? (
                      <span className="text-blue-600 font-medium">📄 {zahlung.zugeordneteRechnung}</span>
                    ) : zahlung.zugeordnetesKonto ? (
                      <span className="text-purple-600 font-medium">📊 {zahlung.zugeordnetesKonto}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 max-w-[120px]">
                    <div className="truncate" title={zahlung.gegenkonto || zahlung.kundenEmail}>
                      {zahlung.gegenkonto || zahlung.kundenEmail || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 max-w-xs">
                    <div className="max-w-[200px] truncate" title={zahlung.verwendungszweck}>
                      {zahlung.verwendungszweck || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {zahlung.istZugeordnet ? (
                      <span className="text-green-600 font-medium">✅ {zahlung.zuordnungsArt === 'rechnung' ? 'Rechnung' : 'Konto'}</span>
                    ) : (
                      <span className="text-orange-600 font-medium">⚪ Offen</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {zahlung.quelle ? zahlung.quelle.replace('fibu_', '').replace('_transactions', '').replace('_settlements', '') : '-'}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zuordnungs-Modal (Placeholder) */}
      {showZuordnungModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Zahlung zuordnen</h3>
            <p className="text-gray-600 mb-4">Zuordnungsfunktion wird implementiert...</p>
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
