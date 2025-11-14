'use client'

import { useState, useEffect } from 'react'

/**
 * Kontenplan View - SKR04 (Abschlussgliederungsprinzip)
 * Hierarchische Darstellung: Klasse → Gruppe → Untergruppe → Konto
 */

export default function KontenplanView() {
  const [konten, setKonten] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKlasse, setSelectedKlasse] = useState(null)
  const [editingKonto, setEditingKonto] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Expandierte Gruppen
  const [expandedKlassen, setExpandedKlassen] = useState(new Set())
  
  useEffect(() => {
    loadKontenplan()
  }, [])
  
  async function loadKontenplan() {
    try {
      const params = new URLSearchParams()
      if (selectedKlasse !== null) params.append('klasse', selectedKlasse)
      if (searchTerm) params.append('search', searchTerm)
      
      const res = await fetch(`/api/fibu/kontenplan?${params}`)
      const data = await res.json()
      
      if (data.ok) {
        setKonten(data.konten)
        setGrouped(data.grouped)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }
  
  function toggleKlasse(klasse) {
    const newExpanded = new Set(expandedKlassen)
    if (newExpanded.has(klasse)) {
      newExpanded.delete(klasse)
    } else {
      newExpanded.add(klasse)
    }
    setExpandedKlassen(newExpanded)
  }
  
  async function saveKonto(konto) {
    try {
      const res = await fetch('/api/fibu/kontenplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(konto)
      })
      
      const data = await res.json()
      
      if (data.ok) {
        await loadKontenplan()
        setEditingKonto(null)
        setShowCreateForm(false)
        alert('Konto gespeichert!')
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }
  
  async function deleteKonto(kontonummer) {
    if (!confirm('Konto wirklich löschen?')) return
    
    try {
      const res = await fetch(`/api/fibu/kontenplan?kontonummer=${kontonummer}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.ok) {
        await loadKontenplan()
        alert('Konto gelöscht!')
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Kontenplan...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📋 Kontenplan SKR04</h2>
          <p className="text-sm text-gray-600 mt-1">
            {konten.length} Konten • Abschlussgliederungsprinzip
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Neues Konto
        </button>
      </div>
      
      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Suche Kontonummer oder Bezeichnung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && loadKontenplan()}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select
            value={selectedKlasse || ''}
            onChange={(e) => {
              setSelectedKlasse(e.target.value ? parseInt(e.target.value) : null)
              setTimeout(() => loadKontenplan(), 100)
            }}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Klassen</option>
            <option value="0">0 - Anlagevermögen</option>
            <option value="1">1 - Umlaufvermögen</option>
            <option value="2">2 - Eigenkapital</option>
            <option value="3">3 - Fremdkapital</option>
            <option value="4">4 - Betriebliche Erträge</option>
            <option value="5">5 - Betriebliche Aufwendungen</option>
            <option value="6">6 - Betriebliche Aufwendungen</option>
            <option value="7">7 - Weitere Erträge/Aufwendungen</option>
            <option value="9">9 - Saldo/Statistik</option>
          </select>
          
          <button
            onClick={loadKontenplan}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            🔍 Suchen
          </button>
        </div>
      </div>
      
      {/* Hierarchische Konten-Liste */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {grouped.map((klasseData) => (
            <div key={klasseData.klasse}>
              {/* Kontenklasse Header */}
              <div
                onClick={() => toggleKlasse(klasseData.klasse)}
                className="px-6 py-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {expandedKlassen.has(klasseData.klasse) ? '▼' : '▶'}
                  </span>
                  <div>
                    <span className="text-lg font-bold text-gray-900">
                      Klasse {klasseData.klasse}: {klasseData.bezeichnung}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">
                      ({klasseData.typ})
                    </span>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {klasseData.konten.length} Konten
                </span>
              </div>
              
              {/* Konten in dieser Klasse */}
              {expandedKlassen.has(klasseData.klasse) && (
                <div className="bg-gray-50 px-6 py-4">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                        <th className="pb-3">Konto</th>
                        <th className="pb-3">Bezeichnung</th>
                        <th className="pb-3">Gruppe</th>
                        <th className="pb-3">Steuer</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {klasseData.konten.map((konto) => (
                        <tr key={konto.kontonummer} className="hover:bg-white">
                          <td className="py-3">
                            <span className="font-mono text-sm font-bold text-blue-600">
                              {konto.kontonummer}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="text-sm text-gray-900">{konto.bezeichnung}</div>
                            {konto.beschreibung && (
                              <div className="text-xs text-gray-500 mt-1">{konto.beschreibung}</div>
                            )}
                          </td>
                          <td className="py-3">
                            <span className="text-xs font-mono text-gray-600">
                              {konto.kontengruppe}
                            </span>
                          </td>
                          <td className="py-3">
                            {konto.steuerrelevant && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                {konto.steuersatz ? `${konto.steuersatz}%` : 'VSt'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                konto.istAktiv
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {konto.istAktiv ? '✓ Aktiv' : '○ Inaktiv'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingKonto(konto)}
                                className="text-blue-600 hover:text-blue-700 text-sm"
                              >
                                ✏️ Bearbeiten
                              </button>
                              {!konto.istSystemkonto && (
                                <button
                                  onClick={() => deleteKonto(konto.kontonummer)}
                                  className="text-red-600 hover:text-red-700 text-sm"
                                >
                                  🗑️ Löschen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Edit/Create Modal */}
      {(editingKonto || showCreateForm) && (
        <KontoFormModal
          konto={editingKonto}
          onSave={saveKonto}
          onClose={() => {
            setEditingKonto(null)
            setShowCreateForm(false)
          }}
        />
      )}
    </div>
  )
}

// Konto Form Modal
function KontoFormModal({ konto, onSave, onClose }) {
  const [formData, setFormData] = useState(konto || {
    kontonummer: '',
    bezeichnung: '',
    beschreibung: '',
    steuersatz: undefined,
    vorsteuer: false,
    istAktiv: true
  })
  
  function handleSubmit(e) {
    e.preventDefault()
    onSave(formData)
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {konto ? 'Konto bearbeiten' : 'Neues Konto anlegen'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontonummer (4-stellig) *
              </label>
              <input
                type="text"
                value={formData.kontonummer}
                onChange={(e) => setFormData({ ...formData, kontonummer: e.target.value })}
                placeholder="z.B. 1802"
                maxLength={4}
                required
                disabled={!!konto}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bezeichnung *
              </label>
              <input
                type="text"
                value={formData.bezeichnung}
                onChange={(e) => setFormData({ ...formData, bezeichnung: e.target.value })}
                placeholder="z.B. Postbank"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                value={formData.beschreibung || ''}
                onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                placeholder="Zusätzliche Informationen..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Steuersatz
                </label>
                <select
                  value={formData.steuersatz || ''}
                  onChange={(e) => setFormData({ ...formData, steuersatz: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keine USt</option>
                  <option value="7">7%</option>
                  <option value="19">19%</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.vorsteuer || false}
                    onChange={(e) => setFormData({ ...formData, vorsteuer: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Vorsteuer</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.istAktiv}
                  onChange={(e) => setFormData({ ...formData, istAktiv: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Konto ist aktiv</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
