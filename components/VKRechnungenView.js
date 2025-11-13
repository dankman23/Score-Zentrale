'use client'

import { useState, useEffect } from 'react'

export default function VKRechnungenView() {
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState('2025-10-01_2025-10-31')
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)

  useEffect(() => {
    loadRechnungen()
  }, [zeitraum, alleAnzeigen])

  async function loadRechnungen() {
    setLoading(true)
    try {
      const [from, to] = alleAnzeigen ? ['2000-01-01', '2099-12-31'] : zeitraum.split('_')
      
      // Lade VK-Rechnungen
      const vkRes = await fetch(`/api/fibu/rechnungen/vk?from=${from}&to=${to}`)
      const vkData = await vkRes.json()
      const vkRechnungen = vkData.rechnungen || []
      
      // Lade externe Rechnungen (Amazon)
      const extRes = await fetch(`/api/fibu/rechnungen/extern?from=${from}&to=${to}`)
      const extData = await extRes.json()
      const extRechnungen = (extData.rechnungen || []).map(r => ({
        ...r,
        quelle: 'Amazon/Extern'
      }))
      
      // Kombiniere beide
      const alle = [...vkRechnungen, ...extRechnungen].sort((a, b) => 
        new Date(b.datum) - new Date(a.datum)
      )
      
      setRechnungen(alle)
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  const [statusFilter, setStatusFilter] = useState('alle')
  const [quelleFilter, setQuelleFilter] = useState('alle')
  const [searchTerm, setSearchTerm] = useState('')

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return 'N/A'
      const day = d.getDate().toString().padStart(2, '0')
      const month = (d.getMonth() + 1).toString().padStart(2, '0')
      const year = d.getFullYear()
      return `${day}.${month}.${year}`
    } catch {
      return 'N/A'
    }
  }

  const filteredRechnungen = rechnungen.filter(r => {
    // Status Filter
    if (statusFilter !== 'alle') {
      if (statusFilter === 'bezahlt' && r.status !== 'Bezahlt') return false
      if (statusFilter === 'offen' && r.status === 'Bezahlt') return false
    }
    
    // Quelle Filter
    if (quelleFilter !== 'alle') {
      if (quelleFilter === 'jtl' && r.quelle !== 'JTL') return false
      if (quelleFilter === 'extern' && r.quelle === 'JTL') return false
    }
    
    // Such-Filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        r.rechnungsNr?.toLowerCase().includes(search) ||
        r.kunde?.toLowerCase().includes(search) ||
        r.zahlungsart?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-white">Lade Rechnungen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">VK-Rechnungen (Ausgangsrechnungen)</h2>
          <p className="text-sm text-gray-300 mt-1">
            {rechnungen.length} Rechnungen {alleAnzeigen ? 'gesamt' : `im Zeitraum`}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-white">
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
              className="border border-gray-600 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm"
            >
              <option value="2025-10-01_2025-10-31">Oktober 2025</option>
              <option value="2025-11-01_2025-11-30">November 2025</option>
              <option value="2025-10-01_2025-11-30">Okt + Nov 2025</option>
              <option value="2025-01-01_2025-12-31">Gesamtes Jahr 2025</option>
            </select>
          )}
          
          <button
            onClick={loadRechnungen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-gray-400 text-xs mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle Status</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="offen">Offen</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-400 text-xs mb-2">Quelle</label>
            <select
              value={quelleFilter}
              onChange={(e) => setQuelleFilter(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="alle">Alle Quellen</option>
              <option value="jtl">JTL (VK)</option>
              <option value="extern">Externe (Amazon, etc.)</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-400 text-xs mb-2">Suche</label>
            <input
              type="text"
              placeholder="Rechnungsnr, Kunde, Zahlungsart..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        
        {(statusFilter !== 'alle' || quelleFilter !== 'alle' || searchTerm) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-400 text-sm">Aktive Filter:</span>
            {statusFilter !== 'alle' && (
              <button
                onClick={() => setStatusFilter('alle')}
                className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs flex items-center gap-1"
              >
                Status: {statusFilter} <span className="ml-1">×</span>
              </button>
            )}
            {quelleFilter !== 'alle' && (
              <button
                onClick={() => setQuelleFilter('alle')}
                className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs flex items-center gap-1"
              >
                Quelle: {quelleFilter} <span className="ml-1">×</span>
              </button>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs flex items-center gap-1"
              >
                Suche: "{searchTerm}" <span className="ml-1">×</span>
              </button>
            )}
            <button
              onClick={() => {
                setStatusFilter('alle')
                setQuelleFilter('alle')
                setSearchTerm('')
              }}
              className="text-gray-400 text-xs underline ml-2"
            >
              Alle zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Angezeigt</div>
          <div className="text-2xl font-bold text-white mt-1">{filteredRechnungen.length}</div>
          <div className="text-xs text-gray-500">von {rechnungen.length} gesamt</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Bezahlt</div>
          <div className="text-2xl font-bold text-green-500 mt-1">
            {filteredRechnungen.filter(r => r.status === 'Bezahlt').length}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Offen</div>
          <div className="text-2xl font-bold text-orange-500 mt-1">
            {filteredRechnungen.filter(r => r.status !== 'Bezahlt').length}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Summe (gefiltert)</div>
          <div className="text-2xl font-bold text-white mt-1">
            {filteredRechnungen.reduce((sum, r) => sum + (r.betrag || 0), 0).toFixed(2)}€
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Rechnungsnr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Zahlungsart</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Netto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Brutto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Quelle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Debitor-Konto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Sachkonto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredRechnungen.map((rechnung, idx) => (
                <tr key={idx} className="hover:bg-gray-750">
                  <td className="px-4 py-3 text-sm font-medium text-blue-400">
                    {rechnung.rechnungsNr}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {formatDate(rechnung.datum)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{rechnung.kunde}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{rechnung.zahlungsart || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-300">
                    {(rechnung.netto || 0).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-white">
                    {(rechnung.betrag || 0).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      rechnung.status === 'Bezahlt' 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-orange-900 text-orange-300'
                    }`}>
                      {rechnung.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      rechnung.quelle === 'JTL' 
                        ? 'bg-blue-900 text-blue-300' 
                        : 'bg-purple-900 text-purple-300'
                    }`}>
                      {rechnung.quelle || 'JTL'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{rechnung.debitor || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{rechnung.sachkonto || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredRechnungen.length === 0 && rechnungen.length > 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>Keine Rechnungen gefunden, die den Filterkriterien entsprechen.</p>
            <button
              onClick={() => {
                setStatusFilter('alle')
                setQuelleFilter('alle')
                setSearchTerm('')
              }}
              className="mt-4 text-blue-400 underline"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
        
        {rechnungen.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>Keine Rechnungen im gewählten Zeitraum gefunden.</p>
          </div>
        )}
      </div>
    </div>
  )
}
// Cache-Buster: 1763046000
