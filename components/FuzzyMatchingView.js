'use client'

import { useState, useEffect } from 'react'

export default function FuzzyMatchingView() {
  const [vorschlaege, setVorschlaege] = useState([])
  const [commerzbankVorschlaege, setCommerzbankVorschlaege] = useState([])
  const [kreditoren, setKreditoren] = useState([])
  const [kontenplan, setKontenplan] = useState([])
  const [stats, setStats] = useState(null)
  const [commerzbankStats, setCommerzbankStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [activeView, setActiveView] = useState('fuzzy') // 'fuzzy' or 'commerzbank'

  useEffect(() => {
    loadVorschlaege()
  }, [])

  async function loadVorschlaege() {
    setLoading(true)
    try {
      const res = await fetch('/api/fibu/fuzzy-match?status=pending&limit=50')
      const data = await res.json()
      
      if (data.ok) {
        setVorschlaege(data.vorschlaege || [])
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  async function runFuzzyMatching() {
    if (!confirm('Fuzzy Matching jetzt ausführen? Dies kann einige Minuten dauern.')) {
      return
    }
    
    setRunning(true)
    try {
      const res = await fetch('/api/fibu/fuzzy-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' })
      })
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ Fuzzy Matching erfolgreich!\n\n' + data.output?.split('\n').slice(-10).join('\n'))
        loadVorschlaege()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (error) {
      alert('❌ Fehler: ' + error.message)
    }
    setRunning(false)
  }

  async function handleVorschlag(vorschlagId, action) {
    try {
      const res = await fetch('/api/fibu/fuzzy-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, vorschlagId })
      })
      const data = await res.json()
      
      if (data.ok) {
        // Entferne aus Liste
        setVorschlaege(vorschlaege.filter(v => v._id !== vorschlagId))
        
        // Update Stats
        if (stats) {
          setStats({
            ...stats,
            pending: stats.pending - 1,
            [action === 'approve' ? 'approved' : 'rejected']: stats[action === 'approve' ? 'approved' : 'rejected'] + 1
          })
        }
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      alert('Fehler: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Vorschläge...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🔍 Fuzzy Matching - Automatische Zahlungs-Zuordnung</h2>
          <p className="text-sm text-gray-600 mt-1">
            Intelligente Zuordnung von Zahlungen zu Rechnungen basierend auf Betrag, Datum und Hinweisen
          </p>
        </div>
        
        <button
          onClick={runFuzzyMatching}
          disabled={running}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {running ? '⏳ Läuft...' : '▶️ Fuzzy Matching starten'}
        </button>
      </div>

      {/* Statistiken */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-3xl mb-2">⏳</div>
            <div className="text-2xl font-bold text-yellow-900">{stats.pending}</div>
            <div className="text-sm text-yellow-700">Warten auf Prüfung</div>
          </div>
          
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-2xl font-bold text-green-900">{stats.approved}</div>
            <div className="text-sm text-green-700">Genehmigt</div>
          </div>
          
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-3xl mb-2">❌</div>
            <div className="text-2xl font-bold text-red-900">{stats.rejected}</div>
            <div className="text-sm text-red-700">Abgelehnt</div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <div className="text-blue-600 text-2xl mr-3">💡</div>
          <div>
            <p className="text-blue-900 font-medium">Wie funktioniert Fuzzy Matching?</p>
            <ul className="text-blue-800 text-sm mt-2 space-y-1">
              <li>✓ <strong>≥70% Confidence</strong>: Automatisch zugeordnet (keine Prüfung nötig)</li>
              <li>⚠️ <strong>50-69% Confidence</strong>: Manuelle Prüfung erforderlich (wird hier angezeigt)</li>
              <li>✗ <strong>&lt;50% Confidence</strong>: Keine Übereinstimmung gefunden</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Vorschläge-Liste */}
      {vorschlaege.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Keine offenen Vorschläge!</h3>
          <p className="text-gray-600">
            Alle Matching-Vorschläge wurden verarbeitet. Führe Fuzzy Matching erneut aus, 
            um neue nicht zugeordnete Zahlungen zu finden.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">
            📋 Vorschläge zur Prüfung ({vorschlaege.length})
          </h3>
          
          {vorschlaege.map((vorschlag, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Confidence Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                      vorschlag.confidence >= 60 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vorschlag.confidence}%
                    </span>
                    <div>
                      <div className="text-sm text-gray-500">Confidence Score</div>
                      <div className="text-xs text-gray-400">
                        {vorschlag.reasons?.join(' • ')}
                      </div>
                    </div>
                  </div>

                  {/* Zahlung & Rechnung Vergleich */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Zahlung */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-xs text-blue-600 font-medium mb-2">💰 ZAHLUNG</div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600">Betrag:</span>
                          <span className="font-bold text-blue-900 ml-2">
                            {vorschlag.zahlungBetrag?.toFixed(2)}€
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Datum:</span>
                          <span className="text-gray-900 ml-2">
                            {new Date(vorschlag.zahlungDatum).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Hinweis:</span>
                          <div className="text-gray-900 text-xs mt-1 break-words">
                            {vorschlag.zahlungHinweis || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rechnung */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-xs text-green-600 font-medium mb-2">📄 RECHNUNG</div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600">RgNr:</span>
                          <span className="font-bold text-green-900 ml-2">
                            {vorschlag.rechnungNr}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Betrag:</span>
                          <span className="font-bold text-green-900 ml-2">
                            {vorschlag.rechnungBetrag?.toFixed(2)}€
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Datum:</span>
                          <span className="text-gray-900 ml-2">
                            {new Date(vorschlag.rechnungDatum).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Differenzen */}
                  <div className="mt-4 flex gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Δ Betrag:</span>
                      <span className="font-medium ml-2">
                        {Math.abs(vorschlag.zahlungBetrag - vorschlag.rechnungBetrag).toFixed(2)}€
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Δ Tage:</span>
                      <span className="font-medium ml-2">
                        {Math.round(
                          Math.abs(
                            (new Date(vorschlag.zahlungDatum) - new Date(vorschlag.rechnungDatum)) / 
                            (1000 * 60 * 60 * 24)
                          )
                        )} Tage
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aktionen */}
                <div className="flex flex-col gap-2 ml-6">
                  <button
                    onClick={() => handleVorschlag(vorschlag._id, 'approve')}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium whitespace-nowrap"
                  >
                    ✓ Genehmigen
                  </button>
                  <button
                    onClick={() => handleVorschlag(vorschlag._id, 'reject')}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium whitespace-nowrap"
                  >
                    ✗ Ablehnen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
