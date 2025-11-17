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

  async function aktualisierenVonQuellen() {
    setLoading(true)
    try {
      const [from, to] = alleAnzeigen ? ['2020-01-01', '2099-12-31'] : zeitraum.split('_')
      
      // Hole neue Daten von allen Quellen mit refresh=true
      console.log('🔄 Aktualisiere Zahlungen von allen Quellen...')
      
      // PayPal (max 31 Tage, daher aufteilen wenn nötig)
      const fromDate = new Date(from)
      const toDate = new Date(to)
      const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24))
      
      if (daysDiff <= 31) {
        // Kann in einem Request
        await fetch(`/api/fibu/zahlungen/paypal?from=${from}&to=${to}&refresh=true`)
      } else {
        // Monat für Monat
        let currentDate = new Date(fromDate)
        while (currentDate <= toDate) {
          const monthStart = currentDate.toISOString().split('T')[0]
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
          const effectiveEnd = monthEnd < to ? monthEnd : to
          
          await fetch(`/api/fibu/zahlungen/paypal?from=${monthStart}&to=${effectiveEnd}&refresh=true`)
          
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
        }
      }
      
      // Commerzbank & Postbank (zusammen)
      await fetch(`/api/fibu/zahlungen/banks?bank=all&from=${from}&to=${to}&refresh=true`)
      
      // Mollie
      await fetch(`/api/fibu/zahlungen/mollie?from=${from}&to=${to}&refresh=true`)
      
      console.log('✅ Aktualisierung abgeschlossen, lade Daten...')
      
      // Jetzt normale Daten laden
      await loadZahlungen()
    } catch (error) {
      console.error('Fehler:', error)
      setLoading(false)
    }
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
  const uniqueAnbieter = [...new Set(zahlungen.map(z => z.anbieter))].sort()

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
            PayPal, Commerzbank, Postbank, Mollie
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
            onClick={aktualisierenVonQuellen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            title="Holt neue Zahlungen von PayPal, Commerzbank, Postbank und Mollie"
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
                    {new Date(zahlung.zahlungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    <span className="font-medium text-gray-900">{zahlung.zahlungsanbieter}</span>
                  </td>
                  <td className={`px-2 py-2 text-xs text-right font-bold whitespace-nowrap ${
                    zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)}€
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
                    {zahlung.zuordnungsArt === 'rechnung' && zahlung.rechnungsNr ? (
                      <div>
                        <span className="text-blue-600 font-medium">📄 {zahlung.rechnungsNr}</span>
                      </div>
                    ) : zahlung.zuordnungsArt === 'konto' && zahlung.zugeordnetesKonto ? (
                      <div>
                        <span className="text-purple-600 font-medium">📊 {zahlung.zugeordnetesKonto}</span>
                      </div>
                    ) : zahlung.kRechnung > 0 ? (
                      <span className="text-blue-600 font-medium">{zahlung.rechnungsNr}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 max-w-[120px]">
                    <div className="truncate" title={zahlung.kundenName}>
                      {zahlung.kundenName || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 max-w-xs">
                    <div className="max-w-[200px]">
                      {zahlung.cBestellNr && (
                        <div className="font-medium text-blue-600 truncate">
                          📦 {zahlung.cBestellNr}
                        </div>
                      )}
                      <div className="truncate" title={zahlung.hinweis}>
                        {zahlung.hinweis || '-'}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-center whitespace-nowrap">
                    {zahlung.istZugeordnet ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✓
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        ○
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap">
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
                  <td className="px-2 py-2 text-xs">
                    <button
                      onClick={() => {
                        setSelectedZahlung(zahlung)
                        setShowZuordnungModal(true)
                      }}
                      className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition"
                    >
                      {zahlung.istZugeordnet ? 'Bearbeiten' : 'Zuordnen'}
                    </button>
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
      
      {/* Zuordnungs-Modal (Lexoffice-Style) */}
      {showZuordnungModal && selectedZahlung && (
        <ZuordnungsModal
          zahlung={selectedZahlung}
          onClose={() => {
            setShowZuordnungModal(false)
            setSelectedZahlung(null)
          }}
          onSave={async () => {
            // Reload Zahlungen
            setShowZuordnungModal(false)
            setSelectedZahlung(null)
            // Force reload
            const [from, to] = zeitraum.split('_')
            const limit = alleAnzeigen ? 2000 : 1000
            const res = await fetch(`/api/fibu/zahlungen?from=${from}&to=${to}&limit=${limit}`)
            const data = await res.json()
            setZahlungen(data.zahlungen || [])
          }}
        />
      )}
    </div>
  )
}

// Zuordnungs-Modal Komponente (Lexoffice-Style)
function ZuordnungsModal({ zahlung, onClose, onSave }) {
  const [zuordnungsArt, setZuordnungsArt] = useState(zahlung.zuordnungsArt || null)
  const [rechnungsNr, setRechnungsNr] = useState(zahlung.rechnungsNr || '')
  const [kontonummer, setKontonummer] = useState(zahlung.zugeordnetesKonto || '')
  const [kontenplan, setKontenplan] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Lade Kontenplan
  useEffect(() => {
    async function loadKontenplan() {
      try {
        const res = await fetch('/api/fibu/kontenplan')
        const data = await res.json()
        setKontenplan(data.konten || [])
      } catch (err) {
        console.error('Fehler beim Laden des Kontenplans:', err)
      }
    }
    loadKontenplan()
  }, [])
  
  async function handleSave() {
    setError(null)
    
    if (!zuordnungsArt) {
      setError('Bitte wählen Sie eine Zuordnungsart aus.')
      return
    }
    
    if (zuordnungsArt === 'rechnung' && !rechnungsNr) {
      setError('Bitte geben Sie eine Rechnungsnummer ein.')
      return
    }
    
    if (zuordnungsArt === 'konto' && !kontonummer) {
      setError('Bitte wählen Sie ein Konto aus.')
      return
    }
    
    setSaving(true)
    
    try {
      const res = await fetch('/api/fibu/zahlungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zahlungId: zahlung.zahlungsId || zahlung._id,
          quelle: zahlung.quelle,
          zuordnungsArt,
          rechnungsNr: zuordnungsArt === 'rechnung' ? rechnungsNr : null,
          kontonummer: zuordnungsArt === 'konto' ? kontonummer : null
        })
      })
      
      const data = await res.json()
      
      if (!data.ok) {
        setError(data.error || 'Fehler beim Speichern')
        setSaving(false)
        return
      }
      
      // Success
      onSave()
      
    } catch (err) {
      setError('Netzwerkfehler: ' + err.message)
      setSaving(false)
    }
  }
  
  // Gruppiere Konten nach Klasse
  const kontenNachKlasse = kontenplan.reduce((acc, konto) => {
    const klasse = konto.kontonummer[0]
    if (!acc[klasse]) acc[klasse] = []
    acc[klasse].push(konto)
    return acc
  }, {})
  
  const klassenNamen = {
    '0': 'Anlagevermögen',
    '1': 'Umlaufvermögen',
    '2': 'Eigenkapital',
    '3': 'Fremdkapital',
    '4': 'Erträge',
    '5': 'Aufwendungen',
    '6': 'Aufwendungen',
    '7': 'Weitere Erträge/Aufwendungen',
    '9': 'Vorträge'
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Zahlung zuordnen</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Zahlungs-Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">📄 Zahlungs-Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Datum:</span>
                <div className="font-bold text-blue-900">
                  {new Date(zahlung.zahlungsdatum).toLocaleDateString('de-DE')}
                </div>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Betrag:</span>
                <div className={`font-bold ${zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)} €
                </div>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Anbieter:</span>
                <div className="font-bold text-blue-900">{zahlung.zahlungsanbieter}</div>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Kunde:</span>
                <div className="font-bold text-blue-900">{zahlung.kundenName || '-'}</div>
              </div>
              <div className="col-span-2">
                <span className="text-blue-700 font-medium">Hinweis:</span>
                <div className="text-blue-900">{zahlung.hinweis || '-'}</div>
              </div>
            </div>
          </div>
          
          {/* Zuordnungsart wählen */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Zuordnungsart wählen:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setZuordnungsArt('rechnung')}
                className={`p-4 border-2 rounded-lg transition ${
                  zuordnungsArt === 'rechnung'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-semibold text-sm">Mit Rechnung verknüpfen</div>
                <div className="text-xs text-gray-500 mt-1">Kundenzahlung oder Einkauf</div>
              </button>
              
              <button
                onClick={() => setZuordnungsArt('konto')}
                className={`p-4 border-2 rounded-lg transition ${
                  zuordnungsArt === 'konto'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold text-sm">Mit Buchungskonto verknüpfen</div>
                <div className="text-xs text-gray-500 mt-1">Betriebskosten, Gebühren etc.</div>
              </button>
            </div>
          </div>
          
          {/* Rechnung zuordnen */}
          {zuordnungsArt === 'rechnung' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechnungsnummer
              </label>
              <input
                type="text"
                value={rechnungsNr}
                onChange={(e) => setRechnungsNr(e.target.value)}
                placeholder="z.B. RE2025-12345"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Geben Sie die vollständige Rechnungsnummer ein
              </p>
            </div>
          )}
          
          {/* Konto zuordnen */}
          {zuordnungsArt === 'konto' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buchungskonto wählen
              </label>
              <select
                value={kontonummer}
                onChange={(e) => setKontonummer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Konto auswählen --</option>
                {Object.keys(kontenNachKlasse).sort().map(klasse => (
                  <optgroup key={klasse} label={`${klasse} - ${klassenNamen[klasse] || 'Sonstige'}`}>
                    {kontenNachKlasse[klasse].map(konto => (
                      <option key={konto.kontonummer} value={konto.kontonummer}>
                        {konto.kontonummer} - {konto.bezeichnung}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                💡 Häufig: 6850 (Telefon), 6640 (Beiträge), 4400 (Erlöse)
              </p>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">⚠️ {error}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            {zahlung.istZugeordnet && (
              <button
                onClick={async () => {
                  if (!confirm('Zuordnung wirklich löschen?')) return
                  
                  setSaving(true)
                  try {
                    const res = await fetch(
                      `/api/fibu/zahlungen?zahlungId=${zahlung.zahlungsId || zahlung._id}&quelle=${zahlung.quelle}`,
                      { method: 'DELETE' }
                    )
                    const data = await res.json()
                    if (data.ok) {
                      onSave()
                    } else {
                      setError(data.error)
                      setSaving(false)
                    }
                  } catch (err) {
                    setError('Fehler beim Löschen: ' + err.message)
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              >
                🗑️ Zuordnung löschen
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !zuordnungsArt}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
