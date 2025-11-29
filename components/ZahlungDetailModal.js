/**
 * Verbessertes Zahlungs-Detail-Modal
 * Inspiriert von Lexoffice: Beleg + Konto gleichzeitig zuordnen
 */

'use client'

import { useState, useEffect } from 'react'

export default function ZahlungDetailModal({ zahlung, onClose, onSave }) {
  // Tabs
  const [activeTab, setActiveTab] = useState('both') // 'both' | 'beleg' | 'konto'
  
  // Beleg-Zuordnung
  const [belegVorschlaege, setBelegVorschlaege] = useState([])
  const [selectedBeleg, setSelectedBeleg] = useState(null)
  const [belegSearch, setBelegSearch] = useState('')
  
  // Konto-Zuordnung
  const [kontoVorschlaege, setKontoVorschlaege] = useState([])
  const [konten, setKonten] = useState([])
  const [selectedKonto, setSelectedKonto] = useState(null)
  const [selectedSteuersatz, setSelectedSteuersatz] = useState(19)
  const [kontoSearch, setKontoSearch] = useState('')
  
  // Loading & Errors
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Notes
  const [notiz, setNotiz] = useState('')
  
  useEffect(() => {
    loadVorschlaege()
    loadKonten()
  }, [])
  
  async function loadVorschlaege() {
    try {
      // Lade Beleg-Vorschläge
      const belegRes = await fetch(
        `/api/fibu/matching-suggestions?limit=10&minConfidence=medium`
      )
      const belegData = await belegRes.json()
      
      if (belegData.ok) {
        // Filtere für diese Zahlung
        const thisZahlung = belegData.suggestions.find(
          s => s.zahlung._id === zahlung._id
        )
        
        if (thisZahlung) {
          setBelegVorschlaege(thisZahlung.suggestions || [])
        }
      }
      
      // Lade Konto-Vorschläge
      const kontoRes = await fetch(
        `/api/fibu/konto-suggestions?limit=10&minConfidence=0.7`
      )
      const kontoData = await kontoRes.json()
      
      if (kontoData.ok) {
        // Filtere für diese Zahlung
        const thisZahlung = kontoData.suggestions.find(
          s => s.zahlung._id === zahlung._id
        )
        
        if (thisZahlung && thisZahlung.suggestion) {
          setKontoVorschlaege([thisZahlung.suggestion])
          
          // Auto-select wenn Confidence hoch
          if (thisZahlung.suggestion.confidence >= 0.85) {
            setSelectedKonto(thisZahlung.suggestion.konto)
            setSelectedSteuersatz(thisZahlung.suggestion.steuer)
          }
        }
      }
      
    } catch (err) {
      console.error('Fehler beim Laden der Vorschläge:', err)
      setError('Vorschläge konnten nicht geladen werden')
    }
    
    setLoading(false)
  }
  
  async function loadKonten() {
    try {
      const res = await fetch('/api/fibu/kontenplan')
      const data = await res.json()
      
      if (data.ok) {
        setKonten(data.konten || [])
      }
    } catch (err) {
      console.error('Fehler beim Laden der Konten:', err)
    }
  }
  
  async function handleSave() {
    if (!selectedBeleg && !selectedKonto) {
      alert('Bitte wählen Sie mindestens einen Beleg ODER ein Konto')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const updates = []
      
      // Beleg zuordnen
      if (selectedBeleg) {
        const belegRes = await fetch('/api/fibu/zahlungen/assign-beleg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zahlungId: zahlung._id,
            anbieter: zahlung.anbieter,
            belegId: selectedBeleg.belegId,
            belegNr: selectedBeleg.belegnummer
          })
        })
        
        const belegData = await belegRes.json()
        if (!belegData.ok) {
          throw new Error(belegData.error || 'Beleg-Zuordnung fehlgeschlagen')
        }
        
        updates.push('Beleg')
      }
      
      // Konto zuordnen
      if (selectedKonto) {
        const kontoRes = await fetch('/api/fibu/zahlungen/assign-konto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zahlungId: zahlung._id,
            anbieter: zahlung.anbieter,
            konto: selectedKonto,
            steuer: selectedSteuersatz,
            saveAsRule: true  // Als Lern-Regel speichern
          })
        })
        
        const kontoData = await kontoRes.json()
        if (!kontoData.ok) {
          throw new Error(kontoData.error || 'Konto-Zuordnung fehlgeschlagen')
        }
        
        updates.push('Konto')
      }
      
      alert(`✅ ${updates.join(' + ')} erfolgreich zugeordnet!`)
      
      if (onSave) {
        onSave()
      }
      
      onClose()
      
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  
  // Filtere Konten nach Suchbegriff
  const filteredKonten = konten.filter(k => {
    if (!kontoSearch) return true
    const search = kontoSearch.toLowerCase()
    return (
      k.kontonummer.includes(search) ||
      k.bezeichnung.toLowerCase().includes(search)
    )
  })
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Zahlung zuordnen</h2>
            <p className="text-sm text-gray-600 mt-1">
              {zahlung.anbieter} • {new Date(zahlung.datum).toLocaleDateString('de-DE')} • {zahlung.betrag.toFixed(2)} €
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Zahlungs-Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Zahlungs-Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Beschreibung:</span>
                <p className="font-medium">{zahlung.verwendungszweck || zahlung.beschreibung || '—'}</p>
              </div>
              <div>
                <span className="text-gray-600">Betrag:</span>
                <p className="font-medium text-lg">{zahlung.betrag.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-gray-600">Datum:</span>
                <p className="font-medium">{new Date(zahlung.datum).toLocaleDateString('de-DE')}</p>
              </div>
              <div>
                <span className="text-gray-600">Anbieter:</span>
                <p className="font-medium">{zahlung.anbieter}</p>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'both'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Beleg + Konto
            </button>
            <button
              onClick={() => setActiveTab('beleg')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'beleg'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Nur Beleg
            </button>
            <button
              onClick={() => setActiveTab('konto')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'konto'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Nur Konto
            </button>
          </div>
          
          {loading && (
            <div className="text-center py-8 text-gray-600">
              Lade Vorschläge...
            </div>
          )}
          
          {!loading && (
            <div className="space-y-6">
              {/* Beleg-Auswahl */}
              {(activeTab === 'both' || activeTab === 'beleg') && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Beleg auswählen</h3>
                  
                  {belegVorschlaege.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">💡 Vorschläge:</p>
                      <div className="space-y-2">
                        {belegVorschlaege.slice(0, 3).map((v, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedBeleg(v)}
                            className={`w-full text-left p-3 rounded-lg border ${
                              selectedBeleg?.belegId === v.belegId
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{v.belegnummer}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(v.rechnungsdatum).toLocaleDateString('de-DE')} • {v.brutto?.toFixed(2)} €
                                </p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                v.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                v.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {v.confidence}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{v.reason}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedBeleg && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        ✓ Beleg ausgewählt: <strong>{selectedBeleg.belegnummer}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Konto-Auswahl */}
              {(activeTab === 'both' || activeTab === 'konto') && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Konto auswählen</h3>
                  
                  {kontoVorschlaege.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">💡 Vorschlag:</p>
                      {kontoVorschlaege.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedKonto(v.konto)
                            setSelectedSteuersatz(v.steuer)
                          }}
                          className={`w-full text-left p-3 rounded-lg border ${
                            selectedKonto === v.konto
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{v.konto} - {v.bezeichnung}</p>
                              <p className="text-sm text-gray-600">Steuer: {v.steuer}%</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                              {Math.round(v.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{v.reason}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Manuelle Konto-Suche */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Konto suchen (Nummer oder Bezeichnung)..."
                      value={kontoSearch}
                      onChange={(e) => setKontoSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {kontoSearch && (
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                      {filteredKonten.slice(0, 20).map(k => (
                        <button
                          key={k.kontonummer}
                          onClick={() => setSelectedKonto(k.kontonummer)}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 ${
                            selectedKonto === k.kontonummer ? 'bg-blue-50' : ''
                          }`}
                        >
                          <p className="font-medium text-sm">{k.kontonummer} - {k.bezeichnung}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedKonto && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                      <p className="text-sm text-green-800">
                        ✓ Konto ausgewählt: <strong>{selectedKonto}</strong>
                      </p>
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Steuersatz:</label>
                        <select
                          value={selectedSteuersatz}
                          onChange={(e) => setSelectedSteuersatz(parseInt(e.target.value))}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value={19}>19%</option>
                          <option value={7}>7%</option>
                          <option value={0}>0% (steuerfrei)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Notiz */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notiz (optional)
                </label>
                <textarea
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Z.B. Grund für manuelle Zuordnung..."
                />
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
              ❌ {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!selectedBeleg && !selectedKonto)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
