'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Kontenplan View - SKR04 (Abschlussgliederungsprinzip)
 * Hierarchische Darstellung: Klasse → Gruppe → Untergruppe → Konto
 */

export default function KontenplanView() {
  const [konten, setKonten] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKlasse, setSelectedKlasse] = useState(0) // Start mit Klasse 0
  const [editingKonto, setEditingKonto] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // SKR04 Kontenklassen mit Namen
  const klassenNamen = {
    0: 'Anlagevermögen',
    1: 'Umlaufvermögen',
    2: 'Eigenkapital',
    3: 'Fremdkapital', 
    4: 'Betriebliche Erträge',
    5: 'Betriebliche Aufwendungen',
    6: 'Betriebliche Aufwendungen',
    7: 'Weitere Erträge/Aufwendungen',
    8: 'Eröffnung/Abschluss',
    9: 'Vortragskonten'
  }
  
  const loadKontenplan = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      
      const res = await fetch(`/api/fibu/kontenplan?${params}`)
      const data = await res.json()
      
      if (data.ok) {
        setKonten(data.konten)
        setGrouped(data.grouped)
        
        // Setze erste verfügbare Klasse als aktiv, wenn noch nicht gesetzt
        if (data.grouped.length > 0 && selectedKlasse === null) {
          setSelectedKlasse(data.grouped[0].klasse)
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }, [searchTerm, selectedKlasse])
  
  useEffect(() => {
    loadKontenplan()
  }, [loadKontenplan])
  
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
          <h2 className="text-2xl font-bold text-gray-900">📋 Kontenplan</h2>
          <p className="text-sm text-gray-600 mt-1">
            SKR04 Abschlussgliederungsprinzip
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
          
          <button
            onClick={loadKontenplan}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            🔍 Suchen
          </button>
        </div>
      </div>
      
      {/* Tabs für Kontenklassen */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tab Navigation mit Namen */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {grouped.map((klasseData) => {
              const klassenName = klassenNamen[klasseData.klasse] || klasseData.bezeichnung
              return (
                <button
                  key={klasseData.klasse}
                  onClick={() => setSelectedKlasse(klasseData.klasse)}
                  className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                    selectedKlasse === klasseData.klasse
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-lg">{klasseData.klasse}</span>
                      <span className="text-xs">–</span>
                      <span className="font-medium">{klassenName}</span>
                    </div>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                      {klasseData.konten.length} Konten
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Konten-Liste */}
        <div className="p-4">
          {grouped
            .filter(k => k.klasse === selectedKlasse)
            .map(klasseData => (
              <div key={klasseData.klasse}>
                {klasseData.konten.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Keine Konten in dieser Klasse</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Kontonummer</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Bezeichnung</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Klasse</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Belegpflicht</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {klasseData.konten.map(konto => (
                          <tr key={konto.kontonummer} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                              {konto.kontonummer}
                            </td>
                            <td className="px-4 py-3 text-gray-900">{konto.bezeichnung}</td>
                            <td className="px-4 py-3 text-gray-600">{konto.klasse}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={async () => {
                                  const newValue = !konto.belegpflicht
                                  try {
                                    const res = await fetch('/api/fibu/kontenplan', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        ...konto,
                                        belegpflicht: newValue
                                      })
                                    })
                                    if (res.ok) {
                                      await loadKontenplan()
                                    }
                                  } catch (error) {
                                    console.error('Fehler beim Toggle:', error)
                                  }
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                  konto.belegpflicht
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={konto.belegpflicht ? 'Beleg erforderlich' : 'Kein Beleg nötig'}
                              >
                                {konto.belegpflicht ? '✓ Ja' : '✗ Nein'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setEditingKonto(konto)}
                                className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium"
                              >
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => deleteKonto(konto.kontonummer)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>
      
      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingKonto) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <h3 className="text-xl font-bold mb-4">
              {editingKonto ? 'Konto bearbeiten' : 'Neues Konto anlegen'}
            </h3>
            
            <KontoForm
              konto={editingKonto}
              onSave={saveKonto}
              onCancel={() => {
                setEditingKonto(null)
                setShowCreateForm(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function KontoForm({ konto, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    kontonummer: konto?.kontonummer || '',
    bezeichnung: konto?.bezeichnung || '',
    klasse: konto?.klasse || 0,
    gruppe: konto?.gruppe || 0,
    untergruppe: konto?.untergruppe || '',
    beschreibung: konto?.beschreibung || '',
    belegpflicht: konto?.belegpflicht || false
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kontonummer</label>
          <input
            type="text"
            value={formData.kontonummer}
            onChange={(e) => setFormData({ ...formData, kontonummer: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Klasse</label>
          <input
            type="number"
            value={formData.klasse}
            onChange={(e) => setFormData({ ...formData, klasse: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
        <input
          type="text"
          value={formData.bezeichnung}
          onChange={(e) => setFormData({ ...formData, bezeichnung: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gruppe</label>
          <input
            type="number"
            value={formData.gruppe}
            onChange={(e) => setFormData({ ...formData, gruppe: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Untergruppe</label>
          <input
            type="text"
            value={formData.untergruppe}
            onChange={(e) => setFormData({ ...formData, untergruppe: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
        <textarea
          value={formData.beschreibung}
          onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={formData.belegpflicht}
            onChange={(e) => setFormData({ ...formData, belegpflicht: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Belegpflicht (Beleg erforderlich für Buchungen)
        </label>
      </div>
      
      <div className="flex gap-3 justify-end pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Speichern
        </button>
      </div>
    </form>
  )
}
