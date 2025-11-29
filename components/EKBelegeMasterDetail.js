'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, CheckCircle, Circle, FileText } from 'lucide-react'

/**
 * Master-Detail-Layout für EK-Belege (Eingangsrechnungen)
 * 
 * Links: Master-Liste mit Filtern
 * Rechts: Detail-Panel mit Zuordnungs-UI
 */
export default function EKBelegeMasterDetail({ zeitraum }) {
  const [belege, setBelege] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBeleg, setSelectedBeleg] = useState(null)
  const [filter, setFilter] = useState('alle') // alle, bezahlt, offen, überfällig
  const [searchTerm, setSearchTerm] = useState('')

  // Belege laden
  useEffect(() => {
    loadBelege()
  }, [zeitraum])

  const loadBelege = async () => {
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
      
      const response = await fetch(`/api/fibu/rechnungen/ek?from=${from}&to=${to}`)
      const data = await response.json()
      
      if (data.ok) {
        setBelege(data.rechnungen || [])
        // Ersten Beleg automatisch auswählen
        if (data.rechnungen?.length > 0 && !selectedBeleg) {
          setSelectedBeleg(data.rechnungen[0])
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  // Gefilterte Belege
  const filteredBelege = belege.filter(b => {
    // Filter nach Status
    if (filter === 'bezahlt' && b.status !== 'Bezahlt') return false
    if (filter === 'offen' && b.status !== 'Offen') return false
    if (filter === 'überfällig' && b.status !== 'Überfällig') return false
    
    // Suche
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matches = 
        b.rechnungsNummer?.toLowerCase().includes(search) ||
        b.lieferantName?.toLowerCase().includes(search) ||
        b.rechnungsnummer?.toLowerCase().includes(search) ||
        b.brutto?.toString().includes(search)
      if (!matches) return false
    }
    
    return true
  })

  // Statistiken
  const stats = {
    gesamt: belege.length,
    bezahlt: belege.filter(b => b.status === 'Bezahlt').length,
    offen: belege.filter(b => b.status === 'Offen').length,
    überfällig: belege.filter(b => b.status === 'Überfällig').length
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header mit Stats */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="font-semibold">{stats.gesamt}</span> EK-Belege gesamt
          </div>
          <div className="text-sm text-green-600">
            <CheckCircle className="inline w-4 h-4 mr-1" />
            <span className="font-semibold">{stats.bezahlt}</span> bezahlt
          </div>
          <div className="text-sm text-orange-600">
            <Circle className="inline w-4 h-4 mr-1" />
            <span className="font-semibold">{stats.offen}</span> offen
          </div>
          {stats.überfällig > 0 && (
            <div className="text-sm text-red-600">
              <Circle className="inline w-4 h-4 mr-1" />
              <span className="font-semibold">{stats.überfällig}</span> überfällig
            </div>
          )}
        </div>
        
        <button
          onClick={loadBelege}
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
                placeholder="Rechnung oder Lieferant suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Status */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFilter('alle')}
                className={`px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'alle'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setFilter('offen')}
                className={`px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'offen'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Offen
              </button>
              <button
                onClick={() => setFilter('bezahlt')}
                className={`px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'bezahlt'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bezahlt
              </button>
              <button
                onClick={() => setFilter('überfällig')}
                className={`px-3 py-2 text-xs rounded-lg transition ${
                  filter === 'überfällig'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Überfällig
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Lädt...</div>
              </div>
            ) : filteredBelege.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Filter className="w-12 h-12 mb-2 text-gray-300" />
                <p>Keine EK-Belege gefunden</p>
              </div>
            ) : (
              filteredBelege.map((beleg) => (
                <div
                  key={beleg._id || beleg.rechnungsNummer}
                  onClick={() => setSelectedBeleg(beleg)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                    selectedBeleg?._id === beleg._id
                      ? 'bg-blue-50 border-l-4 border-l-blue-600'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {beleg.status === 'Bezahlt' ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : beleg.status === 'Überfällig' ? (
                        <Circle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {beleg.rechnungsNummer || beleg.rechnungsnummer}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(beleg.rechnungsdatum || beleg.datum).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {beleg.lieferantName || 'Unbekannt'}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {beleg.brutto?.toFixed(2) || beleg.gesamtBetrag?.toFixed(2)} €
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      beleg.status === 'Bezahlt' 
                        ? 'bg-green-100 text-green-700'
                        : beleg.status === 'Überfällig'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {beleg.status || 'Offen'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DETAIL: Detail-Panel (rechts) */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {selectedBeleg ? (
            <BelegDetailPanel 
              beleg={selectedBeleg} 
              onUpdate={loadBelege}
              zeitraum={zeitraum}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <p>Wählen Sie einen Beleg aus</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Detail-Panel für einen einzelnen EK-Beleg
 */
function BelegDetailPanel({ beleg, onUpdate, zeitraum }) {
  const [saving, setSaving] = useState(false)
  const [zahlungen, setZahlungen] = useState([])
  const [konten, setKonten] = useState([])
  const [selectedZahlung, setSelectedZahlung] = useState(beleg.zugeordneteZahlung || '')
  const [selectedKonto, setSelectedKonto] = useState(beleg.sachkonto || beleg.zugeordnetesKonto || '')

  // Zahlungen und Konten laden
  useEffect(() => {
    loadZahlungen()
    loadKonten()
  }, [])

  const loadZahlungen = async () => {
    try {
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
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zahlungen:', error)
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
      const response = await fetch('/api/fibu/rechnungen/ek/zuordnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          belegId: beleg._id || beleg.rechnungsNummer,
          zahlungId: selectedZahlung || null,
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
            {beleg.rechnungsNummer || beleg.rechnungsnummer}
          </h2>
          {beleg.status === 'Bezahlt' ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Bezahlt
            </span>
          ) : beleg.status === 'Überfällig' ? (
            <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full flex items-center gap-1">
              <Circle className="w-4 h-4" />
              Überfällig
            </span>
          ) : (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full flex items-center gap-1">
              <Circle className="w-4 h-4" />
              Offen
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {new Date(beleg.rechnungsdatum || beleg.datum).toLocaleDateString('de-DE', { 
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
              <span className="text-gray-600">Lieferant:</span>
              <span className="font-medium">{beleg.lieferantName || 'Unbekannt'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rechnungsnummer:</span>
              <span className="font-medium">{beleg.rechnungsNummer || beleg.rechnungsnummer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Brutto:</span>
              <span className="font-semibold">{(beleg.brutto || beleg.gesamtBetrag || 0).toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Netto:</span>
              <span>{(beleg.netto || 0).toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">MwSt:</span>
              <span>{(beleg.mwst || beleg.steuer || 0).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Zuordnung */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🔗 Zuordnung
          </h3>

          <div className="space-y-4">
            {/* Zahlung zuordnen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zahlung
              </label>
              <select
                value={selectedZahlung}
                onChange={(e) => setSelectedZahlung(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Keine Zahlung --</option>
                {zahlungen.map(z => (
                  <option key={z.transactionId || z._id} value={z.transactionId || z._id}>
                    {new Date(z.datum).toLocaleDateString('de-DE')} - {z.betrag?.toFixed(2)}€ ({z.quelle})
                  </option>
                ))}
              </select>
            </div>

            {/* Konto zuordnen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sachkonto (SKR03/04)
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
              setSelectedZahlung('')
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
