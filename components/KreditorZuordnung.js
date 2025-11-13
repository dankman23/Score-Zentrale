'use client'

import { useState, useEffect } from 'react'

export default function KreditorZuordnung() {
  const [rechnungen, setRechnungen] = useState([])
  const [kreditoren, setKreditoren] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState(new Set())

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Lade EK ohne Kreditor
      const ekRes = await fetch('/api/fibu/rechnungen/ek?from=2025-10-01&to=2025-11-30&limit=500')
      const ekData = await ekRes.json()
      const ohneKreditor = (ekData.rechnungen || []).filter(r => !r.kreditorKonto && r.gesamtBetrag > 0)
      
      // Lade Kreditoren
      const kredRes = await fetch('/api/fibu/kreditoren?limit=500')
      const kredData = await kredRes.json()
      
      setRechnungen(ohneKreditor)
      setKreditoren(kredData.kreditoren || [])
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  async function saveKreditor(rechnungId, kreditorNr) {
    try {
      const res = await fetch(`/api/fibu/rechnungen/ek/${rechnungId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kreditorKonto: kreditorNr })
      })
      
      if (res.ok) {
        // Update local state
        setRechnungen(prev => prev.filter(r => r._id !== rechnungId))
        return true
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
    }
    return false
  }

  async function bulkSave(kreditorNr) {
    if (selectedItems.size === 0) return
    
    setSaving(true)
    let success = 0
    
    for (const id of selectedItems) {
      const saved = await saveKreditor(id, kreditorNr)
      if (saved) success++
    }
    
    setSelectedItems(new Set())
    setSaving(false)
    alert(`${success} Rechnungen zugeordnet!`)
  }

  function toggleSelection(id) {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const filteredRechnungen = rechnungen.filter(r => 
    r.lieferantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.rechnungsNummer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Lade Daten...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kreditor-Zuordnung</h2>
          <p className="text-sm text-gray-600 mt-1">
            {rechnungen.length} Rechnungen ohne Kreditor • {selectedItems.size} ausgewählt
          </p>
        </div>
        
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-4">
            <select
              className="border border-gray-300 rounded-lg px-4 py-2"
              onChange={(e) => e.target.value && bulkSave(e.target.value)}
              disabled={saving}
            >
              <option value="">Kreditor für ausgewählte...</option>
              {kreditoren.map(k => (
                <option key={k.kreditorenNummer} value={k.kreditorenNummer}>
                  {k.kreditorenNummer} - {k.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Suche nach Lieferant oder Rechnungsnummer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredRechnungen.length && filteredRechnungen.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(new Set(filteredRechnungen.map(r => r._id)))
                      } else {
                        setSelectedItems(new Set())
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieferant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RgNr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kreditor zuordnen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRechnungen.map(rechnung => (
                <tr key={rechnung._id} className={`hover:bg-gray-50 ${selectedItems.has(rechnung._id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(rechnung._id)}
                      onChange={() => toggleSelection(rechnung._id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rechnung.lieferantName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rechnung.rechnungsNummer}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {rechnung.gesamtBetrag?.toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      onChange={(e) => e.target.value && saveKreditor(rechnung._id, e.target.value)}
                    >
                      <option value="">Auswählen...</option>
                      {kreditoren
                        .filter(k => 
                          k.name.toLowerCase().includes(rechnung.lieferantName.toLowerCase().substring(0, 10)) ||
                          rechnung.lieferantName.toLowerCase().includes(k.name.toLowerCase().substring(0, 10))
                        )
                        .slice(0, 10)
                        .map(k => (
                          <option key={k.kreditorenNummer} value={k.kreditorenNummer}>
                            {k.kreditorenNummer} - {k.name}
                          </option>
                        ))
                      }
                      <optgroup label="Alle Kreditoren">
                        {kreditoren.map(k => (
                          <option key={k.kreditorenNummer} value={k.kreditorenNummer}>
                            {k.kreditorenNummer} - {k.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRechnungen.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Alle Rechnungen zugeordnet!</h3>
          <p className="text-gray-600">Es gibt keine Rechnungen ohne Kreditor mehr.</p>
        </div>
      )}
    </div>
  )
}
