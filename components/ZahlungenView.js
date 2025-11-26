'use client'

import { useState, useEffect } from 'react'
import ZuordnungsModal from './ZuordnungsModal'

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

  // Load data when zeitraum changes
  useEffect(() => {
    if (zeitraum) {
      loadZahlungen(1) // Reset to page 1 when zeitraum changes
    }
  }, [zeitraum])

  async function loadZahlungen(page = 1, pageSize = 500) {
    setLoading(true)
    const abortController = new AbortController()
    
    try {
      const [from, to] = zeitraum.split('_')
      console.log(`[ZahlungenView] Loading from ${from} to ${to}, Page ${page}, PageSize ${pageSize}`)
      
      const url = `/api/fibu/zahlungen?from=${from}&to=${to}&page=${page}&pageSize=${pageSize}`
      console.log(`[ZahlungenView] Fetching from: ${url}`)
      
      const res = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log(`[ZahlungenView] Response status: ${res.status}`)
      
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      console.log('[ZahlungenView] API Response:', {
        ok: data.ok,
        zahlungenCount: data.zahlungen?.length,
        pagination: data.pagination,
        statsGesamt: data.stats?.gesamt
      })
      
      if (data.ok) {
        setZahlungen(data.zahlungen || [])
        setStats(data.stats)
        if (data.pagination) {
          setPagination(data.pagination)
        }
      } else {
        console.error('[ZahlungenView] API Error:', data.error)
        setZahlungen([])
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[ZahlungenView] Fetch aborted')
      } else {
        console.error('[ZahlungenView] Fetch Error:', error.message, error)
      }
      setZahlungen([])
    } finally {
      setLoading(false)
    }
    
    return () => abortController.abort()
  }
  
  function handlePageChange(newPage) {
    loadZahlungen(newPage)
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
  const uniqueAnbieter = Array.from(new Set(zahlungen.map(z => z.anbieter))).filter(Boolean).sort()

  // Statistics (lokale Filter-Stats - nur für aktuelle Seite)
  const localStats = {
    gesamt: filteredZahlungen.length,
    eingaenge: filteredZahlungen.filter(z => z.betrag > 0).length,
    ausgaenge: filteredZahlungen.filter(z => z.betrag < 0).length,
    zugeordnet: filteredZahlungen.filter(z => z.istZugeordnet).length,
    nichtZugeordnet: filteredZahlungen.filter(z => !z.istZugeordnet).length,
    summeEingaenge: filteredZahlungen.filter(z => z.betrag > 0).reduce((sum, z) => sum + (z.betrag || 0), 0),
    summeAusgaenge: filteredZahlungen.filter(z => z.betrag < 0).reduce((sum, z) => sum + (z.betrag || 0), 0)
  }
  
  // Check if any filter is active
  const hasActiveFilters = anbieterFilter !== 'alle' || zuordnungFilter !== 'alle' || richtungFilter !== 'alle' || searchTerm !== ''

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
              <option value="alle">Alle ({stats?.gesamt?.toLocaleString('de-DE') || '0'})</option>
              {Object.entries(stats?.anbieter || {}).map(([name, data]) => (
                <option key={name} value={name}>
                  {name} ({data.anzahl?.toLocaleString('de-DE') || '0'})
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
              <option value="alle">Alle ({stats?.gesamt?.toLocaleString('de-DE') || '0'})</option>
              <option value="zugeordnet">✅ Zugeordnet ({stats?.zuordnung?.zugeordnet?.toLocaleString('de-DE') || '0'})</option>
              <option value="nicht_zugeordnet">❌ Nicht zugeordnet ({stats?.zuordnung?.nichtZugeordnet?.toLocaleString('de-DE') || '0'})</option>
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

      {/* Statistiken - Gesamt (von API) */}
      {stats && (
        <div className="space-y-3">
          {/* Haupt-Statistik */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm font-medium text-blue-900">Gesamt im Zeitraum</div>
                <div className="text-2xl font-bold text-blue-600">{stats.gesamt?.toLocaleString('de-DE')} Zahlungen</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-700">Gesamtsumme</div>
                <div className={`text-xl font-bold ${(stats.gesamtsumme || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats.gesamtsumme || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </div>
              </div>
              <div className="flex gap-4">
                {Object.entries(stats.anbieter || {}).map(([name, data]) => (
                  <div key={name} className="text-center">
                    <div className="text-xs text-blue-700">{name}</div>
                    <div className="text-sm font-bold text-blue-900">{data.anzahl?.toLocaleString('de-DE')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Zuordnungs-Statistik */}
          {stats.zuordnung && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-2">📊 Zuordnungsstatus</div>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">✅ Zugeordnet</span>
                    <span className="font-bold text-green-600">
                      {stats.zuordnung.zugeordnet?.toLocaleString('de-DE')} ({stats.zuordnung.zugeordnetProzent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${stats.zuordnung.zugeordnetProzent}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">❌ Nicht zugeordnet</span>
                    <span className="font-bold text-orange-600">
                      {stats.zuordnung.nichtZugeordnet?.toLocaleString('de-DE')} ({stats.zuordnung.nichtZugeordnetProzent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ width: `${stats.zuordnung.nichtZugeordnetProzent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warnung bei aktiven Filtern */}
      {hasActiveFilters && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Filter aktiv:</span>
            <span>Die Zahlen unten beziehen sich nur auf die {zahlungen.length} geladenen Zahlungen auf dieser Seite. Für Gesamt-Statistiken siehe oben.</span>
          </div>
        </div>
      )}

      {/* Statistiken - Gefiltert (aktuelle Seite) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">{hasActiveFilters ? 'Gefiltert (Seite)' : 'Auf dieser Seite'}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{localStats.gesamt}</div>
          <div className="text-xs text-gray-500">{hasActiveFilters ? `von ${zahlungen.length} geladen` : `von ${pagination.totalCount} gesamt`}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💰 Eingänge</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{localStats.eingaenge}</div>
          <div className="text-xs text-green-700 font-medium">+{localStats.summeEingaenge.toFixed(2)}€</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💸 Ausgänge</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{localStats.ausgaenge}</div>
          <div className="text-xs text-red-700 font-medium">{localStats.summeAusgaenge.toFixed(2)}€</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">✅ Zugeordnet</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{localStats.zugeordnet}</div>
          <div className="text-xs text-gray-500">
            {localStats.gesamt > 0 ? Math.round((localStats.zugeordnet / localStats.gesamt) * 100) : 0}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">❌ Offen</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{localStats.nichtZugeordnet}</div>
          <div className="text-xs text-gray-500">
            {localStats.gesamt > 0 ? Math.round((localStats.nichtZugeordnet / localStats.gesamt) * 100) : 0}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-gray-600 text-sm">💵 Saldo</div>
          <div className={`text-2xl font-bold mt-1 ${
            (localStats.summeEingaenge + localStats.summeAusgaenge) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {(localStats.summeEingaenge + localStats.summeAusgaenge).toFixed(2)}€
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referenz/Auftrag</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verwendungszweck</th>
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
                        <div className="flex flex-col gap-1">
                          {zahlung.referenz && (
                            <span className="text-blue-600 font-medium">🔖 {zahlung.referenz}</span>
                          )}
                          {zahlung.transaktionsId && (
                            <span className="text-xs text-gray-500 font-mono truncate max-w-[120px]" title={zahlung.transaktionsId}>
                              {zahlung.transaktionsId}
                            </span>
                          )}
                          {!zahlung.referenz && !zahlung.transaktionsId && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
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
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✅ {zahlung.zuordnungsArt || 'Zugeordnet'}
                            </span>
                            {zahlung.zugeordneteRechnung && (
                              <span className="text-xs text-blue-600">📄 {zahlung.zugeordneteRechnung}</span>
                            )}
                            {zahlung.zugeordnetesKonto && (
                              <span className="text-xs text-purple-600">📊 {zahlung.zugeordnetesKonto}</span>
                            )}
                          </div>
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
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                    pagination.hasPrev
                      ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Zurück
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                    pagination.hasNext
                      ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Weiter
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Zeige <span className="font-medium">{(pagination.page - 1) * pagination.pageSize + 1}</span> bis{' '}
                    <span className="font-medium">{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}</span> von{' '}
                    <span className="font-medium">{pagination.totalCount}</span> Zahlungen
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                        pagination.hasPrev
                          ? 'bg-white text-gray-500 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      ‹
                    </button>
                    
                    {/* Seiten-Nummern */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i
                      } else {
                        pageNum = pagination.page - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === pagination.page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                        pagination.hasNext
                          ? 'bg-white text-gray-500 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      ›
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zuordnungs-Modal */}
      {showZuordnungModal && selectedZahlung && (
        <ZuordnungsModal
          zahlung={selectedZahlung}
          onClose={() => {
            setShowZuordnungModal(false)
            setSelectedZahlung(null)
          }}
          onZuordnen={async (zuordnungData) => {
            try {
              const res = await fetch('/api/fibu/zahlungen/zuordnen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(zuordnungData)
              })
              
              const data = await res.json()
              
              if (data.ok) {
                alert(`✅ Zuordnung erfolgreich!\n${data.updated} Zahlung(en) zugeordnet`)
                setShowZuordnungModal(false)
                setSelectedZahlung(null)
                // Reload data
                loadZahlungen()
              } else {
                alert(`❌ Fehler: ${data.error}`)
              }
            } catch (error) {
              console.error('Zuordnungs-Fehler:', error)
              alert(`❌ Fehler beim Zuordnen: ${error.message}`)
            }
          }}
        />
      )}
    </div>
  )
}
