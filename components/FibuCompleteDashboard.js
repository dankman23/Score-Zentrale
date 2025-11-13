'use client'

import { useState, useEffect } from 'react'

export default function FibuCompleteDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('2025-10-01_2025-11-30')
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadData()
  }, [selectedPeriod])

  async function loadData() {
    setLoading(true)
    try {
      const [from, to] = selectedPeriod.split('_')
      const res = await fetch(`/api/fibu/uebersicht/complete?from=${from}&to=${to}`)
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade FIBU-Daten...</p>
        </div>
      </div>
    )
  }

  if (!data || !data.ok) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600 mb-4">Die FIBU-Daten konnten nicht geladen werden.</p>
          <button 
            onClick={loadData}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  const { summary, details } = data
  const issues = summary.issues

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">FIBU Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Vollständige Buchhaltungs-Übersicht • Zeitraum: {summary.zeitraum.from} bis {summary.zeitraum.to}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2025-10-01_2025-10-31">Oktober 2025</option>
                <option value="2025-11-01_2025-11-30">November 2025</option>
                <option value="2025-10-01_2025-11-30">Okt + Nov 2025</option>
              </select>
              <button
                onClick={loadData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                🔄 Aktualisieren
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-t border-gray-100">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Übersicht
            </button>
            <button
              onClick={() => setActiveTab('ek')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'ek'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📥 EK-Rechnungen
            </button>
            <button
              onClick={() => setActiveTab('vk')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'vk'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📤 VK-Rechnungen
            </button>
            <button
              onClick={() => setActiveTab('zahlungen')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'zahlungen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💳 Zahlungen
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Critical Issues Alert */}
            {(issues.ekOhneBetrag > 0 || issues.ekOhneKreditor > 0 || issues.zahlungenNegativOhneZuordnung > 0 || issues.vkOffen > 0) && (
              <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
                <div className="flex items-start">
                  <div className="text-red-600 text-3xl mr-4">⚠️</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900 mb-2">Nicht zugeordnete Datensätze gefunden</h3>
                    <p className="text-red-700 text-sm mb-4">
                      Folgende Datensätze benötigen Ihre Aufmerksamkeit für eine vollständige Buchhaltung:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {issues.ekOhneBetrag > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="text-2xl font-bold text-red-600">{issues.ekOhneBetrag}</div>
                          <div className="text-xs text-red-700">EK ohne Betrag</div>
                        </div>
                      )}
                      {issues.ekOhneKreditor > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="text-2xl font-bold text-red-600">{issues.ekOhneKreditor}</div>
                          <div className="text-xs text-red-700">EK ohne Kreditor</div>
                        </div>
                      )}
                      {issues.zahlungenNegativOhneZuordnung > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="text-2xl font-bold text-red-600">{issues.zahlungenNegativOhneZuordnung}</div>
                          <div className="text-xs text-red-700">Ausgaben ohne Konto</div>
                        </div>
                      )}
                      {issues.vkOffen > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="text-2xl font-bold text-red-600">{issues.vkOffen}</div>
                          <div className="text-xs text-red-700">VK offen</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* EK-Rechnungen */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">EK-Rechnungen</h3>
                  <span className="text-2xl">📥</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {summary.ekRechnungen.total}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mit Betrag:</span>
                    <span className="font-medium text-green-600">{summary.ekRechnungen.mitBetrag}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ohne Betrag:</span>
                    <span className="font-medium text-red-600">{summary.ekRechnungen.ohneBetrag}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-bold text-gray-900">
                      {summary.ekRechnungen.gesamtBetrag.toFixed(2)}€
                    </div>
                  </div>
                </div>
              </div>

              {/* VK-Rechnungen */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">VK-Rechnungen</h3>
                  <span className="text-2xl">📤</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {summary.vkRechnungen.total}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bezahlt:</span>
                    <span className="font-medium text-green-600">{summary.vkRechnungen.bezahlt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Offen:</span>
                    <span className="font-medium text-orange-600">{summary.vkRechnungen.offen}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-bold text-gray-900">
                      {summary.vkRechnungen.gesamtBetrag.toFixed(2)}€
                    </div>
                  </div>
                </div>
              </div>

              {/* Zahlungen Eingang */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Zahlungseingänge</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {summary.zahlungen.positiv}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-600">Gesamt:</div>
                  <div className="text-xl font-bold text-green-600">
                    +{summary.zahlungen.positiverBetrag.toFixed(2)}€
                  </div>
                </div>
              </div>

              {/* Zahlungen Ausgang */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Zahlungsausgänge</h3>
                  <span className="text-2xl">💳</span>
                </div>
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {summary.zahlungen.negativ}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-600">Gesamt:</div>
                  <div className="text-xl font-bold text-red-600">
                    {summary.zahlungen.negativerBetrag.toFixed(2)}€
                  </div>
                  <div className="text-xs text-orange-600 font-medium mt-2">
                    ⚠️ Müssen Konten zugeordnet werden
                  </div>
                </div>
              </div>
            </div>

            {/* Zahlungsanbieter Übersicht */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Zahlungen nach Anbieter</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(summary.zahlungen.byAnbieter).map(([anbieter, stats]) => (
                  <div key={anbieter} className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2 truncate" title={anbieter}>
                      {anbieter}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{stats.count} Zahlungen</div>
                    <div className={`text-lg font-bold ${stats.betrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.betrag.toFixed(2)}€
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EK Tab */}
        {activeTab === 'ek' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📥 EK-Rechnungen ohne Betrag ({details.ekOhneBetrag.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieferant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RgNr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grund</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.ekOhneBetrag.slice(0, 20).map((rechnung, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{rechnung.lieferant}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rechnung.rechnungsNr}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(rechnung.datum).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3 text-sm text-orange-600">{rechnung.grund}</td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-blue-600 hover:text-blue-800">Bearbeiten</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📥 EK-Rechnungen ohne Kreditor ({details.ekOhneKreditor.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieferant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RgNr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.ekOhneKreditor.slice(0, 20).map((rechnung, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{rechnung.lieferant}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rechnung.rechnungsNr}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{rechnung.betrag?.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(rechnung.datum).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-blue-600 hover:text-blue-800">Kreditor zuordnen</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VK Tab */}
        {activeTab === 'vk' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📤 Offene VK-Rechnungen ({details.vkOffen.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RgNr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.vkOffen.map((rechnung, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{rechnung.rechnungsNr}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{rechnung.kunde}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{rechnung.betrag?.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(rechnung.datum).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                            {rechnung.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-blue-600 hover:text-blue-800">Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Zahlungen Tab */}
        {activeTab === 'zahlungen' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Zahlungsausgänge ohne Zuordnung (Top 30)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anbieter</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hinweis</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.zahlungenNegativ.map((zahlung, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(zahlung.datum).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{zahlung.anbieter}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">{zahlung.betrag?.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={zahlung.hinweis}>
                          {zahlung.hinweis}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                            {zahlung.typ}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-blue-600 hover:text-blue-800">Konto zuordnen</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
