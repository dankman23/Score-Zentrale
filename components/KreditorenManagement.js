'use client'

import { useState, useEffect } from 'react'

export default function KreditorenManagement() {
  const [kreditoren, setKreditoren] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editKreditor, setEditKreditor] = useState(null)
  const [formData, setFormData] = useState({
    kreditorenNummer: '',
    name: '',
    kategorie: '4'
  })

  useEffect(() => {
    loadKreditoren()
  }, [])

  async function loadKreditoren() {
    setLoading(true)
    try {
      const res = await fetch('/api/fibu/kreditoren?limit=500')
      const data = await res.json()
      setKreditoren(data.kreditoren || [])
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  async function saveKreditor() {
    try {
      const url = editKreditor 
        ? `/api/fibu/kreditoren/${editKreditor._id}`
        : '/api/fibu/kreditoren'
      
      const res = await fetch(url, {
        method: editKreditor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        alert(editKreditor ? '✅ Kreditor aktualisiert!' : '✅ Kreditor angelegt!')
        setShowAddDialog(false)
        setEditKreditor(null)
        setFormData({ kreditorenNummer: '', name: '', kategorie: '4' })
        loadKreditoren()
      } else {
        const data = await res.json()
        alert(`❌ Fehler: ${data.error || 'Unbekannter Fehler'}`)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    }
  }

  async function deleteKreditor(id, name) {
    if (!confirm(`Kreditor "${name}" wirklich löschen?`)) return
    
    try {
      const res = await fetch(`/api/fibu/kreditoren/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        alert('✅ Kreditor gelöscht!')
        loadKreditoren()
      } else {
        alert('❌ Fehler beim Löschen')
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Löschen')
    }
  }

  function openAddDialog() {
    setEditKreditor(null)
    setFormData({ kreditorenNummer: '', name: '', kategorie: '4' })
    setShowAddDialog(true)
  }

  function openEditDialog(kreditor) {
    setEditKreditor(kreditor)
    setFormData({
      kreditorenNummer: kreditor.kreditorenNummer,
      name: kreditor.name,
      kategorie: kreditor.kategorie || '4'
    })
    setShowAddDialog(true)
  }

  const filteredKreditoren = kreditoren.filter(k =>
    k.kreditorenNummer.includes(searchTerm) ||
    k.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">👥 Kreditoren-Verwaltung</h2>
            <p className="text-indigo-200 text-sm mt-1">{kreditoren.length} Kreditoren gesamt</p>
          </div>
          <button
            onClick={openAddDialog}
            className="bg-white text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 font-medium"
          >
            ➕ Neuer Kreditor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Suche nach Nummer oder Name..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nummer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredKreditoren.map((kreditor) => (
                <tr key={kreditor._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {kreditor.kreditorenNummer}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {kreditor.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {kreditor.kategorie || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditDialog(kreditor)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        title="Bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteKreditor(kreditor._id, kreditor.name)}
                        className="text-red-600 hover:text-red-800 font-medium"
                        title="Löschen"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredKreditoren.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Keine Kreditoren gefunden
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {editKreditor ? 'Kreditor bearbeiten' : 'Neuer Kreditor'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddDialog(false)
                    setEditKreditor(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Nummer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kreditor-Nummer *
                  </label>
                  <input
                    type="text"
                    value={formData.kreditorenNummer}
                    onChange={(e) => setFormData({...formData, kreditorenNummer: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="z.B. 70123"
                    disabled={!!editKreditor}
                  />
                  {editKreditor && (
                    <p className="text-xs text-gray-500 mt-1">Nummer kann nicht geändert werden</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="z.B. DHL Paket GmbH"
                  />
                </div>

                {/* Kategorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={formData.kategorie}
                    onChange={(e) => setFormData({...formData, kategorie: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  >
                    <option value="4">4 - Standard</option>
                    <option value="1">1 - Wichtig</option>
                    <option value="2">2 - Regelmäßig</option>
                    <option value="3">3 - Sonstige</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddDialog(false)
                    setEditKreditor(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveKreditor}
                  disabled={!formData.kreditorenNummer || !formData.name}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editKreditor ? '💾 Speichern' : '➕ Anlegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
