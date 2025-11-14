'use client'

import { useState, useEffect } from 'react'

export default function KreditorZuordnung({ onUpdate }) {
  const [rechnungen, setRechnungen] = useState([])
  const [kreditoren, setKreditoren] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [showNewKreditorDialog, setShowNewKreditorDialog] = useState(false)
  const [bulkKreditor, setBulkKreditor] = useState('')
  
  // Edit-Modal State
  const [editRechnung, setEditRechnung] = useState(null)
  const [editForm, setEditForm] = useState({
    lieferantName: '',
    rechnungsNummer: '',
    gesamtBetrag: 0,
    rechnungsdatum: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Neue API: Lade nur Rechnungen für Zuordnung (ohne Kreditor ODER Betrag=0)
      const ekRes = await fetch('/api/fibu/zuordnung/ek-liste?from=2025-01-01&to=2025-12-31')
      const ekData = await ekRes.json()
      
      // Lade Kreditoren
      const kredRes = await fetch('/api/fibu/kreditoren?limit=500')
      const kredData = await kredRes.json()
      
      setRechnungen(ekData.rechnungen || [])
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

  async function bulkSave() {
    if (selectedItems.size === 0 || !bulkKreditor) return
    
    setSaving(true)
    let success = 0
    let failed = 0
    
    for (const id of selectedItems) {
      const saved = await saveKreditor(id, bulkKreditor)
      if (saved) success++
      else failed++
    }
    
    setSelectedItems(new Set())
    setBulkKreditor('')
    setSaving(false)
    
    if (failed > 0) {
      alert(`${success} Rechnungen zugeordnet, ${failed} fehlgeschlagen!`)
    } else {
      alert(`✅ ${success} Rechnungen erfolgreich zugeordnet!`)
    }
    
    // Trigger reload in parent
    if (onUpdate) onUpdate()
  }

  function openEditDialog(rechnung) {
    setEditRechnung(rechnung)
    setEditForm({
      lieferantName: rechnung.lieferantName || '',
      rechnungsNummer: rechnung.rechnungsNummer || '',
      gesamtBetrag: rechnung.gesamtBetrag || 0,
      rechnungsdatum: rechnung.rechnungsdatum ? rechnung.rechnungsdatum.split('T')[0] : ''
    })
  }

  async function saveEdit() {
    if (!editRechnung) return
    
    setSaving(true)
    try {
      const res = await fetch(`/api/fibu/rechnungen/ek/${editRechnung._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lieferantName: editForm.lieferantName,
          rechnungsNummer: editForm.rechnungsNummer,
          gesamtBetrag: parseFloat(editForm.gesamtBetrag),
          rechnungsdatum: editForm.rechnungsdatum
        })
      })
      
      if (res.ok) {
        alert('✅ Rechnung aktualisiert!')
        setEditRechnung(null)
        loadData() // Reload
      } else {
        alert('❌ Fehler beim Speichern')
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    }
    setSaving(false)
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

  function selectAll() {
    if (selectedItems.size === filteredRechnungen.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredRechnungen.map(r => r._id)))
    }
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
        
        <button
          onClick={() => setShowNewKreditorDialog(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Neuer Kreditor
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {selectedItems.size} Rechnungen ausgewählt
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Wähle einen Kreditor und klicke auf "Zuordnen"
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={bulkKreditor}
                onChange={(e) => setBulkKreditor(e.target.value)}
                disabled={saving}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kreditor wählen...</option>
                {kreditoren.map(k => (
                  <option key={k.kreditorenNummer} value={k.kreditorenNummer}>
                    {k.kreditorenNummer} - {k.name}
                  </option>
                ))}
              </select>
              <button
                onClick={bulkSave}
                disabled={saving || !bulkKreditor}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Speichere...
                  </>
                ) : (
                  '✓ Zuordnen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieferant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RgNr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beleg</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kreditor zuordnen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
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
                    {rechnung.gesamtBetrag ? (
                      <span>{rechnung.gesamtBetrag.toFixed(2)}€</span>
                    ) : (
                      <span className="text-red-600 font-bold">0,00€ ⚠️</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {rechnung.sourceEmailId ? (
                      <button
                        onClick={() => window.open(`/api/fibu/beleg/${rechnung.sourceEmailId}`, '_blank')}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        title="PDF-Beleg öffnen"
                      >
                        📄 PDF
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      onChange={(e) => e.target.value && saveKreditor(rechnung._id, e.target.value)}
                    >
                      <option value="" className="text-gray-900">Auswählen...</option>
                      {kreditoren
                        .filter(k => 
                          k.name.toLowerCase().includes(rechnung.lieferantName.toLowerCase().substring(0, 10)) ||
                          rechnung.lieferantName.toLowerCase().includes(k.name.toLowerCase().substring(0, 10))
                        )
                        .slice(0, 10)
                        .map(k => (
                          <option key={k.kreditorenNummer} value={k.kreditorenNummer} className="text-gray-900">
                            {k.kreditorenNummer} - {k.name}
                          </option>
                        ))
                      }
                      <optgroup label="Alle Kreditoren">
                        {kreditoren.map(k => (
                          <option key={k.kreditorenNummer} value={k.kreditorenNummer} className="text-gray-900">
                            {k.kreditorenNummer} - {k.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => openEditDialog(rechnung)}
                      className="text-gray-600 hover:text-gray-800 font-medium"
                      title="Rechnung bearbeiten"
                    >
                      ✏️
                    </button>
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

      {/* Neuer Kreditor Dialog */}
      {showNewKreditorDialog && (
        <NewKreditorDialog
          onClose={() => setShowNewKreditorDialog(false)}
          onSuccess={() => {
            setShowNewKreditorDialog(false)
            loadData()
          }}
        />
      )}

      {/* Edit-Rechnung Modal */}
      {editRechnung && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Rechnung bearbeiten</h3>
                <button
                  onClick={() => setEditRechnung(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Lieferant */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieferant *
                  </label>
                  <input
                    type="text"
                    value={editForm.lieferantName}
                    onChange={(e) => setEditForm({...editForm, lieferantName: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. DHL Paket GmbH"
                  />
                </div>

                {/* Rechnungsnummer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rechnungsnummer *
                  </label>
                  <input
                    type="text"
                    value={editForm.rechnungsNummer}
                    onChange={(e) => setEditForm({...editForm, rechnungsNummer: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. 2025-10-12345"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Betrag */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Betrag (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.gesamtBetrag}
                      onChange={(e) => setEditForm({...editForm, gesamtBetrag: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Datum */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rechnungsdatum *
                    </label>
                    <input
                      type="date"
                      value={editForm.rechnungsdatum}
                      onChange={(e) => setEditForm({...editForm, rechnungsdatum: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Hinweis */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Hinweis:</strong> Nach dem Speichern muss die Rechnung noch einem Kreditor zugeordnet werden.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setEditRechnung(null)}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || !editForm.lieferantName || !editForm.rechnungsNummer || !editForm.gesamtBetrag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Speichere...
                    </>
                  ) : (
                    '💾 Speichern'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NewKreditorDialog({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    kreditorenNummer: '',
    name: '',
    standardAufwandskonto: '5200'
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    
    try {
      const res = await fetch('/api/fibu/kreditoren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (res.ok) {
        alert('✅ Kreditor erfolgreich angelegt!')
        onSuccess()
      } else {
        const error = await res.json()
        alert('❌ Fehler: ' + error.error)
      }
    } catch (error) {
      alert('❌ Fehler: ' + error.message)
    }
    
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Neuen Kreditor anlegen</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kreditorennummer *
            </label>
            <input
              type="text"
              required
              value={formData.kreditorenNummer}
              onChange={(e) => setFormData({...formData, kreditorenNummer: e.target.value})}
              placeholder="z.B. 70099"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="z.B. Neue Firma GmbH"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standard-Aufwandskonto
            </label>
            <select
              value={formData.standardAufwandskonto}
              onChange={(e) => setFormData({...formData, standardAufwandskonto: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="5200">5200 - Wareneinkauf</option>
              <option value="6300">6300 - Versandkosten</option>
              <option value="6510">6510 - Bürobedarf</option>
              <option value="6520">6520 - Telefon/Internet</option>
              <option value="6530">6530 - Porto</option>
              <option value="6600">6600 - Werbung</option>
              <option value="6610">6610 - Reisekosten</option>
              <option value="6640">6640 - Fachliteratur</option>
              <option value="6805">6805 - Versicherungen</option>
              <option value="6815">6815 - Rechts-/Beratungskosten</option>
              <option value="6823">6823 - Buchführungskosten</option>
              <option value="6850">6850 - Sonstige Kosten</option>
            </select>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichere...' : 'Kreditor anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
