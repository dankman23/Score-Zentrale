'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, CheckCircle, Circle, DollarSign } from 'lucide-react'

/**
 * Master-Detail-Layout für Zahlungen/Umsätze (wie Lexoffice)
 * 
 * Links: Master-Liste mit Filtern
 * Rechts: Detail-Panel mit Zuordnungs-UI
 */
export default function ZahlungenMasterDetail({ zeitraum }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedZahlung, setSelectedZahlung] = useState(null)
  const [filter, setFilter] = useState('alle') // alle, zugeordnet, nicht-zugeordnet
  const [searchTerm, setSearchTerm] = useState('')
  const [quelle, setQuelle] = useState('alle') // alle, amazon, paypal, bank, etc.

  // Zahlungen laden
  useEffect(() => {
    loadZahlungen()
  }, [zeitraum])

  const loadZahlungen = async () => {
    setLoading(true)
    try {
      // Zeitraum kann String "YYYY-MM-DD_YYYY-MM-DD" oder Objekt {from, to} sein
      let from, to
      if (typeof zeitraum === 'string') {
        [from, to] = zeitraum.split('_')
      } else {
        from = zeitraum.from
        to = zeitraum.to
      }
      
      const response = await fetch(`/api/fibu/zahlungen?from=${from}&to=${to}`)
      const data = await response.json()
      
      if (data.ok) {
        setZahlungen(data.zahlungen || [])
        // Erste Zahlung automatisch auswählen
        if (data.zahlungen?.length > 0 && !selectedZahlung) {
          setSelectedZahlung(data.zahlungen[0])
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  // Gefilterte Zahlungen
  const filteredZahlungen = zahlungen.filter(z => {
    // Filter nach Status
    if (filter === 'zugeordnet' && !z.istZugeordnet) return false
    if (filter === 'nicht-zugeordnet' && z.istZugeordnet) return false
    
    // Filter nach Quelle
    if (quelle !== 'alle' && z.quelle?.toLowerCase() !== quelle.toLowerCase()) return false
    
    // Suche
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matches = 
        z.verwendungszweck?.toLowerCase().includes(search) ||
        z.betrag?.toString().includes(search) ||
        z.transactionId?.toLowerCase().includes(search) ||
        z.kundenName?.toLowerCase().includes(search)
      if (!matches) return false
    }
    
    return true
  })

  // Statistiken
  const stats = {
    gesamt: zahlungen.length,
    zugeordnet: zahlungen.filter(z => z.istZugeordnet).length,
    nichtZugeordnet: zahlungen.filter(z => !z.istZugeordnet).length
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header mit Stats */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="font-semibold">{stats.gesamt}</span> Zahlungen gesamt
          </div>
          <div className="text-sm text-green-600">
            <CheckCircle className="inline w-4 h-4 mr-1" />
            <span className="font-semibold">{stats.zugeordnet}</span> zugeordnet
          </div>
          <div className="text-sm text-orange-600">
            <Circle className="inline w-4 h-4 mr-1" />
            <span className="font-semibold">{stats.nichtZugeordnet}</span> offen
          </div>
        </div>
        
        <button
          onClick={loadZahlungen}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </button>
      </div>

      {/* Master-Detail-Layout */}
      <div className="flex gap-4 flex-1 overflow-hidden">
        
        {/* MASTER: Liste (links) */}
        <div className="w-1/3 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Filter & Suche */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            {/* Suche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Status */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('alle')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'alle'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setFilter('zugeordnet')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'zugeordnet'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Zugeordnet
              </button>
              <button
                onClick={() => setFilter('nicht-zugeordnet')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'nicht-zugeordnet'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Offen
              </button>
            </div>

            {/* Filter Quelle */}
            <select
              value={quelle}
              onChange={(e) => setQuelle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="alle">Alle Quellen</option>
              <option value="amazon">Amazon</option>
              <option value="paypal">PayPal</option>
              <option value="commerzbank">Commerzbank</option>
              <option value="postbank">Postbank</option>
              <option value="mollie">Mollie</option>
            </select>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Lädt...</div>
              </div>
            ) : filteredZahlungen.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Filter className="w-12 h-12 mb-2 text-gray-300" />
                <p>Keine Zahlungen gefunden</p>
              </div>
            ) : (
              filteredZahlungen.map((zahlung) => (
                <div
                  key={zahlung.transactionId || zahlung._id}
                  onClick={() => setSelectedZahlung(zahlung)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                    selectedZahlung?.transactionId === zahlung.transactionId
                      ? 'bg-blue-50 border-l-4 border-l-blue-600'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {zahlung.istZugeordnet ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag?.toFixed(2)} {zahlung.waehrung || '€'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(zahlung.datum).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-1 line-clamp-2">
                    {zahlung.verwendungszweck || zahlung.beschreibung || 'Keine Beschreibung'}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {zahlung.quelle}
                    </span>
                    {zahlung.istZugeordnet && (
                      <span className="text-xs text-green-600">
                        ✓ {zahlung.zugeordnetesKonto || 'Zugeordnet'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DETAIL: Detail-Panel (rechts) */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {selectedZahlung ? (
            <ZahlungDetailPanel 
              zahlung={selectedZahlung} 
              onUpdate={loadZahlungen}
              zeitraum={zeitraum}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <DollarSign className="w-16 h-16 mb-4 text-gray-300" />
              <p>Wählen Sie eine Zahlung aus</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Detail-Panel für eine einzelne Zahlung
 */
function ZahlungDetailPanel({ zahlung, onUpdate, zeitraum }) {
  const [saving, setSaving] = useState(false)
  const [rechnungen, setRechnungen] = useState([])
  const [konten, setKonten] = useState([])
  const [selectedBeleg, setSelectedBeleg] = useState(zahlung.zugeordneteRechnung || '')
  const [selectedKonto, setSelectedKonto] = useState(zahlung.zugeordnetesKonto || '')

  // Rechnungen und Konten laden
  useEffect(() => {
    loadRechnungen()
    loadKonten()
  }, [])

  const loadRechnungen = async () => {
    try {
      const response = await fetch(`/api/fibu/rechnungen/alle?from=${zeitraum.from}&to=${zeitraum.to}&limit=1000`)
      const data = await response.json()
      if (data.ok) {
        setRechnungen(data.rechnungen || [])
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rechnungen:', error)
    }
  }

  const loadKonten = async () => {
    try {
      const response = await fetch('/api/fibu/kontenplan')
      const data = await response.json()
      if (data.ok) {
        setKonten(data.konten || [])
      }
    } catch (error) {
      console.error('Fehler beim Laden der Konten:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/fibu/zahlungen/zuordnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zahlungId: zahlung.transactionId || zahlung._id,
          quelle: zahlung.quelle,
          belegId: selectedBeleg || null,
          kontoId: selectedKonto || null
        })
      })

      const data = await response.json()
      if (data.ok) {
        alert('✓ Zuordnung gespeichert!')
        onUpdate()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      alert('Fehler beim Speichern: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">
            {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag?.toFixed(2)} {zahlung.waehrung || '€'}
          </h2>
          {zahlung.istZugeordnet ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Zugeordnet
            </span>
          ) : (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full flex items-center gap-1">
              <Circle className="w-4 h-4" />
              Nicht zugeordnet
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {new Date(zahlung.datum).toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Quelle:</span>
              <span className="font-medium">{zahlung.quelle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Transaktions-ID:</span>
              <span className="font-mono text-xs">{zahlung.transactionId || zahlung._id}</span>
            </div>
            {zahlung.kundenName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Kunde:</span>
                <span className="font-medium">{zahlung.kundenName}</span>
              </div>
            )}
            {zahlung.verwendungszweck && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">Verwendungszweck:</span>
                <span className="text-gray-900 bg-gray-50 p-2 rounded text-xs">
                  {zahlung.verwendungszweck}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Zuordnung */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🔗 Zuordnung
          </h3>

          <div className="space-y-4">
            {/* Beleg zuordnen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beleg (Rechnung)
              </label>
              <select
                value={selectedBeleg}
                onChange={(e) => setSelectedBeleg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Kein Beleg --</option>
                {rechnungen.map(r => (
                  <option key={r._id || r.belegnummer} value={r._id || r.belegnummer}>
                    {r.belegnummer} - {r.kundenName} ({r.brutto?.toFixed(2)}€)
                  </option>
                ))}
              </select>
            </div>

            {/* Konto zuordnen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Konto (SKR03/04)
              </label>
              <select
                value={selectedKonto}
                onChange={(e) => setSelectedKonto(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Kein Konto --</option>
                {konten.map(k => (
                  <option key={k.kontonummer} value={k.kontonummer}>
                    {k.kontonummer} - {k.bezeichnung}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Footer mit Buttons */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {saving ? 'Speichert...' : 'Zuordnung speichern'}
          </button>
          <button
            onClick={() => {
              setSelectedBeleg('')
              setSelectedKonto('')
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  )
}
