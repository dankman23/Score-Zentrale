'use client'

import { useState, useEffect } from 'react'

export default function EKRechnungenView({ zeitraum: zeitraumProp, initialFilter }) {
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState(zeitraumProp || '2025-10-01_2025-10-31')
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)
  
  // Filter States
  const [kreditorFilter, setKreditorFilter] = useState(initialFilter || 'alle')
  const [zahlungsFilter, setZahlungsFilter] = useState('alle')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sortierung
  const [sortField, setSortField] = useState('datum')
  const [sortDirection, setSortDirection] = useState('desc')

  // Update zeitraum when prop changes
  useEffect(() => {
    if (zeitraumProp) {
      setZeitraum(zeitraumProp)
    }
  }, [zeitraumProp])

  // Update filter when initialFilter prop changes
  useEffect(() => {
    if (initialFilter) {
      setKreditorFilter(initialFilter)
    }
  }, [initialFilter])

  useEffect(() => {
    loadRechnungen()
  }, [zeitraum, alleAnzeigen])

  async function loadRechnungen() {
    setLoading(true)
    try {
      const [from, to] = alleAnzeigen ? ['2000-01-01', '2099-12-31'] : zeitraum.split('_')
      
      // Lade EK-Rechnungen direkt aus MongoDB
      const res = await fetch(`/api/fibu/ek-rechnungen/list?from=${from}&to=${to}`)
      const data = await res.json()
      
      if (data.ok) {
        setRechnungen(data.rechnungen || [])
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  // Sortierung
  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function getSortIcon(field) {
    if (sortField !== field) return '↕️'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  // Filterung
  const filteredRechnungen = rechnungen
    .filter(r => {
      // Kreditor-Filter
      if (kreditorFilter === 'mit_kreditor' && !r.kreditorKonto) return false
      if (kreditorFilter === 'ohne_kreditor' && r.kreditorKonto) return false
      
      // Zahlungs-Filter
      if (zahlungsFilter === 'bezahlt' && !r.zahlungId) return false
      if (zahlungsFilter === 'offen' && r.zahlungId) return false
      
      // Suchfilter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          r.lieferantName?.toLowerCase().includes(term) ||
          r.rechnungsNummer?.toLowerCase().includes(term) ||
          r.kreditorKonto?.toString().includes(term)
        )
      }
      
      return true
    })
    .sort((a, b) => {
      let aVal, bVal
      
      switch(sortField) {
        case 'datum':
          aVal = new Date(a.rechnungsdatum).getTime()
          bVal = new Date(b.rechnungsdatum).getTime()
          break
        case 'lieferant':
          aVal = a.lieferantName || ''
          bVal = b.lieferantName || ''
          break
        case 'betrag':
          aVal = a.gesamtBetrag || 0
          bVal = b.gesamtBetrag || 0
          break
        case 'kreditor':
          aVal = a.kreditorKonto || ''
          bVal = b.kreditorKonto || ''
          break
        default:
          return 0
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

  const gesamtBetrag = filteredRechnungen.reduce((sum, r) => sum + (r.gesamtBetrag || 0), 0)
  const ohneKreditor = filteredRechnungen.filter(r => !r.kreditorKonto).length
  const offen = filteredRechnungen.filter(r => !r.zahlungId).length

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header mit Statistik */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-4 text-white">
        <h2 className="text-2xl font-bold mb-2">📥 EK-Rechnungen (Lieferanten)</h2>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-purple-200">Gesamt</div>
            <div className="text-xl font-bold">{filteredRechnungen.length}</div>
          </div>
          <div>
            <div className="text-purple-200">Gesamtbetrag</div>
            <div className="text-xl font-bold">{gesamtBetrag.toFixed(2)}€</div>
          </div>
          <div>
            <div className="text-purple-200">Ohne Kreditor</div>
            <div className="text-xl font-bold">{ohneKreditor}</div>
          </div>
          <div>
            <div className="text-purple-200">Offen</div>
            <div className="text-xl font-bold">{offen}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Kreditor-Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kreditor</label>
            <select
              value={kreditorFilter}
              onChange={(e) => setKreditorFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="alle" className="text-gray-900">Alle</option>
              <option value="mit_kreditor" className="text-gray-900">Mit Kreditor</option>
              <option value="ohne_kreditor" className="text-gray-900">Ohne Kreditor</option>
            </select>
          </div>

          {/* Zahlungs-Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zahlung</label>
            <select
              value={zahlungsFilter}
              onChange={(e) => setZahlungsFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="alle" className="text-gray-900">Alle</option>
              <option value="bezahlt" className="text-gray-900">Bezahlt</option>
              <option value="offen" className="text-gray-900">Offen</option>
            </select>
          </div>

          {/* Suche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Lieferant, RgNr..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Alle anzeigen */}
          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={alleAnzeigen}
                onChange={(e) => setAlleAnzeigen(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Alle Zeiträume</span>
            </label>
          </div>
        </div>

        {/* Reset Filter */}
        {(kreditorFilter !== 'alle' || zahlungsFilter !== 'alle' || searchTerm) && (
          <button
            onClick={() => {
              setKreditorFilter('alle')
              setZahlungsFilter('alle')
              setSearchTerm('')
            }}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            ✕ Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  onClick={() => handleSort('datum')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Datum {getSortIcon('datum')}
                </th>
                <th 
                  onClick={() => handleSort('lieferant')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Lieferant {getSortIcon('lieferant')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  RgNr
                </th>
                <th 
                  onClick={() => handleSort('betrag')}
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Betrag {getSortIcon('betrag')}
                </th>
                <th 
                  onClick={() => handleSort('kreditor')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Kreditor {getSortIcon('kreditor')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRechnungen.map((ek, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {new Date(ek.rechnungsdatum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {ek.lieferantName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ek.rechnungsNummer}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    {(ek.gesamtBetrag || 0).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ek.kreditorKonto ? (
                      <span className="text-green-600 font-medium">{ek.kreditorKonto}</span>
                    ) : (
                      <span className="text-red-600">❌ Fehlt</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ek.zahlungId ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✓ Bezahlt
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        ○ Offen
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRechnungen.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Keine EK-Rechnungen gefunden
          </div>
        )}
      </div>
    </div>
  )
}
