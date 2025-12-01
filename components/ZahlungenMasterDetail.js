'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, CheckCircle, Circle, AlertCircle, DollarSign, X, FileText, Calendar } from 'lucide-react'

/**
 * Kompaktes Master-Detail-Layout für Zahlungen/Umsätze
 * 
 * Vollbreite Liste mit Slide-in Detail-Panel von rechts
 */
export default function ZahlungenMasterDetail({ zeitraum }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedZahlung, setSelectedZahlung] = useState(null)
  const [filter, setFilter] = useState('alle') // alle, zugeordnet, beleg_fehlt, offen
  const [searchTerm, setSearchTerm] = useState('')
  const [quelle, setQuelle] = useState('alle') // alle, amazon, paypal, bank, etc.
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50 // Nur 50 Zahlungen pro Seite

  // Zahlungen laden
  useEffect(() => {
    loadZahlungen()
  }, [zeitraum, currentPage, filter, quelle])  // Quelle hinzugefügt!

  const loadZahlungen = async () => {
    setLoading(true)
    try {
      let from, to
      if (typeof zeitraum === 'string') {
        [from, to] = zeitraum.split('_')
      } else {
        from = zeitraum.from
        to = zeitraum.to
      }
      
      // Quelle-Filter: Mappe UI-Namen auf API-Parameter
      const anbieterParam = quelle === 'alle' ? 'all' : quelle
      
      // Serverseitiger Filter + Pagination
      const response = await fetch(`/api/fibu/zahlungen?from=${from}&to=${to}&page=${currentPage}&pageSize=${pageSize}&statusFilter=${filter}&anbieter=${anbieterParam}`)
      const data = await response.json()
      
      if (data.ok) {
        console.log(`Zahlungen geladen: Seite ${currentPage}/${data.pagination?.totalPages || 1}`)
        setZahlungen(data.zahlungen || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalCount(data.pagination?.totalCount || 0)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter-Änderung: Setze Seite zurück auf 1
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchTerm, quelle])

  // Hilfsfunktion: Normalisiere Quellen-String für Vergleich
  const normalizeQuelle = (quelle) => {
    if (!quelle) return ''
    const q = quelle.toLowerCase()
    // Mappe Collection-Namen auf UI-Namen
    if (q.includes('amazon')) return 'amazon'
    if (q.includes('paypal')) return 'paypal'
    if (q.includes('commerzbank')) return 'commerzbank'
    if (q.includes('postbank')) return 'postbank'
    if (q.includes('mollie')) return 'mollie'
    if (q.includes('ebay')) return 'ebay'
    return q
  }

  // Gefilterte Zahlungen (Status-Filter UND Quelle-Filter laufen jetzt serverseitig!)
  const filteredZahlungen = zahlungen.filter(z => {
    // Quelle-Filter läuft jetzt serverseitig, wird hier NICHT mehr gefiltert
    
    // Nur noch Search-Filter im Frontend
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
    <div className="flex flex-col h-[calc(100vh-200px)] relative">
      {/* Kompakte Header-Zeile mit Stats & Controls */}
      <div className="mb-3 flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-gray-200">
        <div className="flex gap-4 text-xs items-center">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-900">{totalCount}</span>
            <span className="text-gray-500">gesamt</span>
          </div>
          <div className="text-gray-400">|</div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Seite {currentPage} von {totalPages}</span>
          </div>
          <div className="text-gray-400">|</div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">{filteredZahlungen.length} auf dieser Seite</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Erste Seite"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Vorherige Seite"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Nächste Seite"
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Letzte Seite"
            >
              »»
            </button>
          </div>
          
          <button
            onClick={loadZahlungen}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Kompakte Filter-Leiste */}
      <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex gap-3 items-center">
          {/* Suche */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filter Status */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('alle')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
                filter === 'alle'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setFilter('zugeordnet')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
                filter === 'zugeordnet'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✓ Zugeordnet
            </button>
            <button
              onClick={() => setFilter('beleg_fehlt')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
                filter === 'beleg_fehlt'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⚠ Beleg fehlt
            </button>
            <button
              onClick={() => setFilter('offen')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
                filter === 'offen'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✗ Offen
            </button>
          </div>

          {/* Quelle Dropdown */}
          <select
            value={quelle}
            onChange={(e) => setQuelle(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="alle">Alle Quellen</option>
            <option value="amazon">Amazon</option>
            <option value="paypal">PayPal</option>
            <option value="commerzbank">Commerzbank</option>
            <option value="postbank">Postbank</option>
            <option value="mollie">Mollie</option>
            <option value="ebay">eBay</option>
          </select>
        </div>
      </div>

      {/* Vollbreite Tabelle */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm">Lädt...</div>
          </div>
        ) : filteredZahlungen.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Filter className="w-12 h-12 mb-2 text-gray-300" />
            <p className="text-sm">Keine Zahlungen gefunden</p>
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
            <table className="w-full text-xs table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 w-8"></th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 w-20">Datum</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Beschreibung</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-700 w-24">Betrag</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 w-28">Quelle</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 w-44">Zuordnung</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700 w-16">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredZahlungen.map((zahlung) => {
                  return (
                    <tr
                      key={zahlung.transactionId || zahlung._id}
                      className={`transition cursor-pointer ${
                        selectedZahlung?.transactionId === zahlung.transactionId
                          ? 'bg-blue-50'
                          : zahlung.zuordnungs_status === 'offen'
                          ? 'bg-red-50 hover:bg-red-100'
                          : zahlung.zuordnungs_status === 'beleg_fehlt'
                          ? 'bg-yellow-50 hover:bg-yellow-100'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedZahlung(zahlung)}
                    >
                      <td className="px-2 py-2.5">
                        {zahlung.zuordnungs_status === 'zugeordnet' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {zahlung.zuordnungs_status === 'beleg_fehlt' && (
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                        )}
                        {zahlung.zuordnungs_status === 'offen' && (
                          <Circle className="w-4 h-4 text-red-600" />
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-gray-700 whitespace-nowrap text-[11px]">
                        {new Date(zahlung.datum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'UTC'
                        })}
                      </td>
                      <td className="px-2 py-2.5 text-gray-900">
                        <div className="truncate">
                          {zahlung.verwendungszweck || zahlung.beschreibung || 'Keine Beschreibung'}
                        </div>
                        {/* Kundenname oder Gegenkonto */}
                        {(zahlung.kundenName || zahlung.gegenkonto) && (
                          <div className="text-gray-600 text-[10px] mt-0.5 truncate">
                            👤 {zahlung.kundenName || zahlung.gegenkonto}
                          </div>
                        )}
                        {/* Order ID / Referenz */}
                        {zahlung.referenz && (
                          <div className="text-blue-600 text-[10px] mt-0.5 truncate font-mono">
                            📦 {zahlung.referenz}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium">
                        <span className={zahlung.betrag >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag?.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                          {zahlung.anbieter || normalizeQuelle(zahlung.quelle)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        {zahlung.zugeordneteRechnung || zahlung.match_result?.vk_rechnung_nr ? (
                          <div className="flex items-center gap-1">
                            <div>
                              <span className="text-green-700 text-[10px] font-bold block">
                                📄 {zahlung.zugeordneteRechnung || zahlung.match_result?.vk_rechnung_nr}
                              </span>
                              {zahlung.referenz && zahlung.referenz.match(/^AU_\d+_SW\d+$/) && (
                                <span className="text-gray-500 text-[9px]">{zahlung.referenz}</span>
                              )}
                            </div>
                            {zahlung.match_source && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                                zahlung.match_source === 'import_vk' ? 'bg-green-100 text-green-700' :
                                zahlung.match_source === 'auto_vk' ? 'bg-blue-100 text-blue-700' :
                                zahlung.match_source === 'auto_bank' ? 'bg-blue-100 text-blue-700' :
                                zahlung.match_source === 'manuell' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {zahlung.match_source === 'import_vk' ? 'JTL' :
                                 zahlung.match_source === 'auto_vk' ? 'Auto' :
                                 zahlung.match_source === 'auto_bank' ? 'Auto' :
                                 zahlung.match_source === 'manuell' ? 'Manuell' : ''}
                              </span>
                            )}
                          </div>
                        ) : zahlung.zugeordnetesKonto || zahlung.match_result?.konto_id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-blue-700 text-[10px]">
                              🏦 {zahlung.zugeordnetesKonto || zahlung.match_result?.konto_id}
                            </span>
                            {zahlung.match_source && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                                zahlung.match_source === 'auto_bank' ? 'bg-blue-100 text-blue-700' :
                                zahlung.match_source === 'manuell' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {zahlung.match_source === 'auto_bank' ? 'Auto' :
                                 zahlung.match_source === 'manuell' ? 'Manuell' : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedZahlung(zahlung)
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-[10px]"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLIDE-IN Detail-Panel von rechts */}
      {selectedZahlung && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
            onClick={() => setSelectedZahlung(null)}
          />
          
          {/* Slide-in Panel */}
          <div className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl z-50 animate-slide-in-right">
            <ZahlungDetailPanel
              zahlung={selectedZahlung}
              onClose={() => setSelectedZahlung(null)}
              onUpdate={() => {
                loadZahlungen()
                setSelectedZahlung(null)
              }}
              zeitraum={zeitraum}
            />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Detail-Panel für eine einzelne Zahlung (Slide-in von rechts)
 */
function ZahlungDetailPanel({ zahlung, onClose, onUpdate, zeitraum }) {
  const [saving, setSaving] = useState(false)
  const [rechnungen, setRechnungen] = useState([])
  const [konten, setKonten] = useState([])
  const [selectedBeleg, setSelectedBeleg] = useState(zahlung.zugeordneteRechnung || '')
  const [selectedKonto, setSelectedKonto] = useState(zahlung.zugeordnetesKonto || '')

  useEffect(() => {
    loadRechnungen()
    loadKonten()
  }, [])

  const loadRechnungen = async () => {
    try {
      let from, to
      if (typeof zeitraum === 'string') {
        [from, to] = zeitraum.split('_')
      } else {
        from = zeitraum.from
        to = zeitraum.to
      }
      
      const response = await fetch(`/api/fibu/rechnungen/alle?from=${from}&to=${to}&limit=1000`)
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
      {/* Kompakter Header mit Close-Button */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag?.toFixed(2)} €
          </h2>
          <div className="text-xs text-gray-500 mt-0.5">
            {new Date(zahlung.datum).toLocaleDateString('de-DE', { 
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {zahlung.istZugeordnet ? (
            <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Zugeordnet
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-orange-100 text-orange-800 text-xs rounded-full flex items-center gap-1">
              <Circle className="w-3.5 h-3.5" />
              Offen
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-md transition"
            title="Schließen"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content - scrollbar */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Details Sektion */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Details</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Quelle:</span>
              <span className="font-medium text-gray-900">{zahlung.anbieter || zahlung.quelle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Transaktions-ID:</span>
              <span className="font-mono text-gray-900 text-[10px]">{zahlung.transactionId || zahlung._id}</span>
            </div>
            {zahlung.kundenName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Kunde:</span>
                <span className="font-medium text-gray-900">{zahlung.kundenName}</span>
              </div>
            )}
            {zahlung.steuerschluessel && (
              <div className="flex justify-between">
                <span className="text-gray-600">Steuerschlüssel:</span>
                <span className="font-mono font-bold text-green-700">{zahlung.steuerschluessel}</span>
              </div>
            )}
            {zahlung.referenz && (
              <div className="flex justify-between">
                <span className="text-gray-600">Referenz:</span>
                <span className="font-mono font-medium text-blue-700">{zahlung.referenz}</span>
              </div>
            )}
            {zahlung.zugeordneteRechnung && (
              <div className="flex justify-between">
                <span className="text-gray-600">Zugeordnete Rechnung:</span>
                <span className="font-mono font-bold text-green-700">📄 {zahlung.zugeordneteRechnung}</span>
              </div>
            )}
            {zahlung.verwendungszweck && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-600 block mb-1">Verwendungszweck:</span>
                <div className="text-gray-900 bg-white p-2 rounded text-xs leading-relaxed">
                  {zahlung.verwendungszweck}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Match-Info Sektion (NEU) */}
        {zahlung.match_result && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-blue-800 mb-3 uppercase tracking-wide flex items-center gap-1.5">
              🎯 Match-Informationen
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-blue-700 font-medium">Match-Quelle:</span>
                <span className={`px-2 py-1 rounded font-semibold ${
                  zahlung.match_source === 'import_vk' ? 'bg-green-100 text-green-700' :
                  zahlung.match_source === 'auto_vk' ? 'bg-blue-100 text-blue-700' :
                  zahlung.match_source === 'auto_bank' ? 'bg-blue-100 text-blue-700' :
                  zahlung.match_source === 'manuell' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {zahlung.match_source === 'import_vk' ? '📦 JTL-Import' :
                   zahlung.match_source === 'auto_vk' ? '🤖 Auto-Match (Beleg)' :
                   zahlung.match_source === 'auto_bank' ? '🏦 Auto-Match (Bank)' :
                   zahlung.match_source === 'manuell' ? '👤 Manuell' : zahlung.match_source}
                </span>
              </div>
              
              {zahlung.match_confidence !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Konfidenz:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          zahlung.match_confidence >= 95 ? 'bg-green-500' :
                          zahlung.match_confidence >= 80 ? 'bg-blue-500' :
                          zahlung.match_confidence >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${zahlung.match_confidence}%` }}
                      />
                    </div>
                    <span className={`font-bold ${
                      zahlung.match_confidence < 100 ? 'text-orange-600' : 'text-green-700'
                    }`}>
                      {zahlung.match_confidence}%
                    </span>
                  </div>
                </div>
              )}
              
              {zahlung.match_result.match_details && (
                <div className="pt-2 border-t border-blue-200">
                  <span className="text-blue-700 font-medium block mb-1">Details:</span>
                  <div className="text-blue-900 bg-white p-2 rounded text-xs">
                    {zahlung.match_result.match_details}
                  </div>
                </div>
              )}
              
              {zahlung.match_result.konto_vorschlag_id && !zahlung.zugeordnetesKonto && (
                <div className="pt-2 border-t border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 font-medium">💡 Konto-Vorschlag:</span>
                    <span className="font-mono font-bold text-blue-900">
                      {zahlung.match_result.konto_vorschlag_id}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Zuordnung Sektion */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-1.5">
            🔗 Zuordnung
          </h3>

          <div className="space-y-3">
            {/* Beleg zuordnen */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Beleg (Rechnung)
              </label>
              <select
                value={selectedBeleg}
                onChange={(e) => setSelectedBeleg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Konto (SKR03/04)
              </label>
              <select
                value={selectedKonto}
                onChange={(e) => setSelectedKonto(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Buchungsvorschlag (falls vorhanden) */}
        {zahlung.buchung && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">💡 Buchungsvorschlag</h3>
            <div className="space-y-1.5 text-xs text-blue-900">
              <div className="flex justify-between">
                <span>Soll:</span>
                <span className="font-mono">{zahlung.buchung.sollKonto}</span>
              </div>
              <div className="flex justify-between">
                <span>Haben:</span>
                <span className="font-mono">{zahlung.buchung.habenKonto}</span>
              </div>
              <div className="flex justify-between">
                <span>Netto:</span>
                <span className="font-medium">{zahlung.buchung.nettoBetrag?.toFixed(2)} €</span>
              </div>
              {zahlung.buchung.mwstSatz && (
                <div className="flex justify-between">
                  <span>MwSt:</span>
                  <span>{zahlung.buchung.mwstSatz}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer mit Buttons */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition text-sm font-medium"
          >
            {saving ? 'Speichert...' : 'Zuordnung speichern'}
          </button>
          <button
            onClick={() => {
              setSelectedBeleg('')
              setSelectedKonto('')
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition text-sm"
          >
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  )
}
