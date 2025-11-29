/**
 * Beleg-Detail-Modal
 * Zeigt Beleg-Details und erlaubt Zahlung + Kategorie zuzuordnen
 */

'use client'

import { useState, useEffect } from 'react'

export default function BelegDetailModal({ beleg, onClose, onSave }) {
  // Zahlung-Zuordnung
  const [zahlungen, setZahlungen] = useState([])
  const [filteredZahlungen, setFilteredZahlungen] = useState([])
  const [selectedZahlung, setSelectedZahlung] = useState(null)
  const [zahlungSearch, setZahlungSearch] = useState('')
  
  // Kategorie/Konto-Zuordnung
  const [konten, setKonten] = useState([])
  const [selectedKonto, setSelectedKonto] = useState(null)
  const [selectedSteuersatz, setSelectedSteuersatz] = useState(19)
  
  // Loading & Errors
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    loadData()
  }, [])
  
  useEffect(() => {
    // Filter Zahlungen nach Such-Begriff
    if (!zahlungSearch) {
      setFilteredZahlungen(zahlungen.slice(0, 20))
    } else {
      const search = zahlungSearch.toLowerCase()
      const filtered = zahlungen.filter(z => {
        const text = `${z.verwendungszweck} ${z.beschreibung} ${z.betrag}`.toLowerCase()
        return text.includes(search)
      })
      setFilteredZahlungen(filtered.slice(0, 20))
    }
  }, [zahlungSearch, zahlungen])
  
  async function loadData() {
    try {
      // Lade nicht-zugeordnete Zahlungen
      const zahlungenRes = await fetch(
        `/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31&page=1&pageSize=500`
      )
      const zahlungenData = await zahlungenRes.json()
      
      if (zahlungenData.zahlungen) {
        // Filtere Zahlungen die ähnlichen Betrag haben (±10%)
        const belegBetrag = Math.abs(beleg.brutto || 0)
        const relevant = zahlungenData.zahlungen.filter(z => {
          const zahlungBetrag = Math.abs(z.betrag)
          const diff = Math.abs(zahlungBetrag - belegBetrag)
          return diff < belegBetrag * 0.1  // ±10%
        })
        
        setZahlungen(relevant)
        setFilteredZahlungen(relevant.slice(0, 20))
      }
      
      // Lade Kontenplan
      const kontenRes = await fetch('/api/fibu/kontenplan')
      const kontenData = await kontenRes.json()
      
      if (kontenData.ok) {
        // Nur Erlöskonten für VK-Belege
        const erlöskonten = kontenData.konten.filter(k => 
          k.kategorie === 'Erlöse'
        )
        setKonten(erlöskonten)
        
        // Auto-select Standard-Erlöskonto
        setSelectedKonto('8400')  // Erlöse 19% USt
      }
      
    } catch (err) {
      console.error('Fehler beim Laden:', err)
      setError('Daten konnten nicht geladen werden')
    }
    
    setLoading(false)
  }
  
  async function handleSave() {
    if (!selectedZahlung && !selectedKonto) {
      alert('Bitte wählen Sie mindestens eine Zahlung ODER ein Konto')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      // TODO: API für Beleg-Zuordnung
      // Aktuell nur Client-seitig - Backend-API fehlt noch
      
      alert('✅ Zuordnung gespeichert!\n\n(Backend-Integration folgt)')
      
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
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Beleg-Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              {beleg.belegnummer} • {new Date(beleg.rechnungsdatum).toLocaleDateString('de-DE')} • {beleg.brutto?.toFixed(2)} €
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
          {/* Beleg-Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Beleg-Informationen</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Belegnummer:</span>
                <p className="font-medium">{beleg.belegnummer}</p>
              </div>
              <div>
                <span className="text-gray-600">Rechnungsdatum:</span>
                <p className="font-medium">{new Date(beleg.rechnungsdatum).toLocaleDateString('de-DE')}</p>
              </div>
              <div>
                <span className="text-gray-600">Kunde:</span>
                <p className="font-medium">{beleg.kundenname || '—'}</p>
              </div>
              <div>
                <span className="text-gray-600">Betrag (Brutto):</span>
                <p className="font-medium text-lg">{beleg.brutto?.toFixed(2)} €</p>
              </div>
              {beleg.land && (
                <div>
                  <span className="text-gray-600">Land:</span>
                  <p className="font-medium">{beleg.land}</p>
                </div>
              )}
              {beleg.cBestellNr && (
                <div>
                  <span className="text-gray-600">Bestellnummer:</span>
                  <p className="font-medium">{beleg.cBestellNr}</p>
                </div>
              )}
            </div>
          </div>
          
          {loading && (
            <div className="text-center py-8 text-gray-600">
              Lade Daten...
            </div>
          )}
          
          {!loading && (
            <div className="space-y-6">
              {/* Zahlung zuordnen */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Zahlung zuordnen</h3>
                
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Zahlung suchen (Betrag, Beschreibung)..."
                    value={zahlungSearch}
                    onChange={(e) => setZahlungSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {filteredZahlungen.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredZahlungen.map(z => (
                      <button
                        key={z._id}
                        onClick={() => setSelectedZahlung(z)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${
                          selectedZahlung?._id === z._id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {z.verwendungszweck || z.beschreibung || 'Keine Beschreibung'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {z.anbieter} • {new Date(z.datum).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{z.betrag.toFixed(2)} €</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 text-center py-4 border border-gray-200 rounded-lg">
                    Keine passenden Zahlungen gefunden
                  </p>
                )}
                
                {selectedZahlung && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      ✓ Zahlung ausgewählt: <strong>{selectedZahlung.betrag.toFixed(2)} €</strong> ({selectedZahlung.anbieter})
                    </p>
                  </div>
                )}
              </div>
              
              {/* Kategorie/Konto zuordnen */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Kategorie/Erlöskonto</h3>
                
                <div className="space-y-2">
                  {konten.map(k => (
                    <button
                      key={k.kontonummer}
                      onClick={() => setSelectedKonto(k.kontonummer)}
                      className={`w-full text-left px-4 py-3 rounded-lg border ${
                        selectedKonto === k.kontonummer
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{k.kontonummer} - {k.bezeichnung}</p>
                    </button>
                  ))}
                </div>
                
                {selectedKonto && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Steuersatz:</label>
                    <select
                      value={selectedSteuersatz}
                      onChange={(e) => setSelectedSteuersatz(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value={19}>19%</option>
                      <option value={7}>7%</option>
                      <option value={0}>0% (steuerfrei/IGL)</option>
                    </select>
                  </div>
                )}
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
            disabled={saving || (!selectedZahlung && !selectedKonto)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
