'use client'

import { useState, useEffect } from 'react'

export default function ZuordnungsModal({ zahlung, onClose, onZuordnen }) {
  const [activeTab, setActiveTab] = useState('beleg') // 'beleg' | 'kategorie'
  const [vorschlaege, setVorschlaege] = useState([])
  const [konten, setKonten] = useState([])
  const [loading, setLoading] = useState(true)
  const [suchbegriff, setSuchbegriff] = useState('')
  const [selectedBeleg, setSelectedBeleg] = useState(null)
  const [selectedKonto, setSelectedKonto] = useState(null)
  
  // Abweichungsgrund bei Betrag-Differenz
  const [showAbweichung, setShowAbweichung] = useState(false)
  const [abweichungsgrund, setAbweichungsgrund] = useState(null)
  const [notiz, setNotiz] = useState('')
  
  useEffect(() => {
    loadVorschlaege()
    loadKonten()
  }, [])
  
  async function loadVorschlaege() {
    try {
      const res = await fetch(
        `/api/fibu/zahlungen/vorschlaege?` +
        `betrag=${zahlung.betrag}&` +
        `datum=${zahlung.datum}&` +
        `referenz=${zahlung.referenz || ''}&` +
        `transaktionsId=${zahlung.transaktionsId}`
      )
      const data = await res.json()
      
      if (data.ok) {
        setVorschlaege(data.vorschlaege || [])
      }
    } catch (error) {
      console.error('Fehler beim Laden der Vorschläge:', error)
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
    } catch (error) {
      console.error('Fehler beim Laden der Konten:', error)
    }
  }
  
  function handleBelegSelect(beleg) {
    setSelectedBeleg(beleg)
    setSelectedKonto(null)
    
    // Prüfe Betrag-Abweichung
    const diff = Math.abs(Math.abs(zahlung.betrag) - Math.abs(beleg.betrag))
    if (diff > 0.50) {
      setShowAbweichung(true)
    } else {
      setShowAbweichung(false)
    }
  }
  
  function handleKontoSelect(konto) {
    setSelectedKonto(konto)
    setSelectedBeleg(null)
    setShowAbweichung(false)
  }
  
  async function handleZuordnen() {
    if (!selectedBeleg && !selectedKonto) {
      alert('Bitte wählen Sie einen Beleg oder ein Konto')
      return
    }
    
    if (showAbweichung && !abweichungsgrund) {
      alert('Bitte wählen Sie einen Grund für die Abweichung')
      return
    }
    
    const zuordnungData = {
      zahlungIds: [zahlung._id],
      abweichungsgrund: showAbweichung ? abweichungsgrund : null,
      abweichungsBetrag: selectedBeleg ? (Math.abs(zahlung.betrag) - Math.abs(selectedBeleg.betrag)) : null,
      notiz: notiz || null
    }
    
    if (selectedBeleg) {
      zuordnungData.rechnungId = selectedBeleg.belegId
      zuordnungData.rechnungsNr = selectedBeleg.rechnungsNr
    } else if (selectedKonto) {
      zuordnungData.kontoNr = selectedKonto.kontonummer
      zuordnungData.kontoName = selectedKonto.bezeichnung
    }
    
    onZuordnen(zuordnungData)
  }
  
  // Gefilterte Listen
  const gefiltereVorschlaege = vorschlaege.filter(v => {
    if (!suchbegriff) return true
    const search = suchbegriff.toLowerCase()
    return (
      v.rechnungsNr?.toLowerCase().includes(search) ||
      v.kunde?.toLowerCase().includes(search)
    )
  })
  
  const gefilterteKonten = konten.filter(k => {
    if (!suchbegriff) return true
    const search = suchbegriff.toLowerCase()
    return (
      k.kontonummer?.toLowerCase().includes(search) ||
      k.bezeichnung?.toLowerCase().includes(search)
    )
  })
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Zahlung zuordnen</h2>
            <p className="text-sm text-gray-600 mt-1">
              {zahlung.anbieter} • {new Date(zahlung.datum).toLocaleDateString('de-DE')} • {zahlung.betrag.toFixed(2)}€
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('beleg')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'beleg'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              BELEG WÄHLEN
            </button>
            <button
              onClick={() => setActiveTab('kategorie')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'kategorie'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              KATEGORIE WÄHLEN
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Suchfeld */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={activeTab === 'beleg' ? 'Beleg suchen...' : 'Kategorie suchen...'}
              value={suchbegriff}
              onChange={(e) => setSuchbegriff(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {activeTab === 'beleg' && (
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Lade Vorschläge...</div>
              ) : gefiltereVorschlaege.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Keine passenden Belege gefunden</p>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Manuell Beleg hochladen
                  </button>
                </div>
              ) : (
                gefiltereVorschlaege.map(beleg => (
                  <div
                    key={beleg.belegId}
                    onClick={() => handleBelegSelect(beleg)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedBeleg?.belegId === beleg.belegId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{beleg.rechnungsNr}</span>
                          {beleg.score >= 150 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Hohe Übereinstimmung
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{beleg.kunde}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {new Date(beleg.datum).toLocaleDateString('de-DE')}
                        </div>
                        {beleg.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {beleg.reasons.map((reason, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900">{beleg.betrag.toFixed(2)}€</div>
                        {beleg.betragDiff > 0.50 && (
                          <div className="text-xs text-orange-600 mt-1">
                            ±{beleg.betragDiff.toFixed(2)}€ Diff
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {activeTab === 'kategorie' && (
            <div className="space-y-2">
              {gefilterteKonten.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Keine Kategorien gefunden</div>
              ) : (
                gefilterteKonten.slice(0, 20).map(konto => (
                  <div
                    key={konto._id}
                    onClick={() => handleKontoSelect(konto)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedKonto?._id === konto._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900">{konto.bezeichnung}</div>
                        <div className="text-sm text-gray-500">Konto {konto.kontonummer}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Abweichungsgrund (wenn Betrag abweicht) */}
          {showAbweichung && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm font-medium text-yellow-900 mb-2">
                Betrag weicht ab - Bitte Grund angeben:
              </div>
              <select
                value={abweichungsgrund || ''}
                onChange={(e) => setAbweichungsgrund(e.target.value)}
                className="w-full border border-yellow-300 rounded px-3 py-2 text-sm mb-2"
              >
                <option value="">-- Grund wählen --</option>
                <option value="teilzahlung">Teilzahlung</option>
                <option value="skonto">Skonto</option>
                <option value="währung">Währungsumrechnung</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
              <input
                type="text"
                placeholder="Optionale Notiz..."
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                className="w-full border border-yellow-300 rounded px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Abbrechen
          </button>
          <button
            onClick={handleZuordnen}
            disabled={!selectedBeleg && !selectedKonto}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedBeleg || selectedKonto
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Zuordnen
          </button>
        </div>
      </div>
    </div>
  )
}
