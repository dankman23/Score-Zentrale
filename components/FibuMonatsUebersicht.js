'use client'

import { useState, useEffect } from 'react'

export default function FibuMonatsUebersicht({ selectedPeriod }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [monat, setMonat] = useState('Oktober 2025')

  useEffect(() => {
    loadMonatsStats()
  }, [selectedPeriod])

  async function loadMonatsStats() {
    setLoading(true)
    try {
      // Ermittle Monat aus selectedPeriod
      const [from, to] = selectedPeriod.split('_')
      const fromDate = new Date(from)
      const monatName = fromDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      setMonat(monatName)

      // Lade alle FIBU-Daten für den Monat
      const res = await fetch(`/api/fibu/monatsuebersicht?from=${from}&to=${to}`)
      const data = await res.json()
      
      if (data.ok) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-gray-500">
        Keine Daten verfügbar
      </div>
    )
  }

  // Berechne Fortschritt
  const gesamtfortschritt = stats.gesamtRechnungen > 0 
    ? Math.round((stats.vollstaendigZugeordnet / stats.gesamtRechnungen) * 100)
    : 0

  const istMonatAbschließbar = 
    stats.ekRechnungenOhneKreditor === 0 &&
    stats.vkRechnungenOhneBezahlung === 0 &&
    stats.zahlungenNichtZugeordnet === 0

  return (
    <div className="space-y-6">
      {/* Header mit Monatsname */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">📊 Monats-Übersicht: {monat}</h2>
        <p className="text-blue-100">Status der Buchführung und offene Aufgaben</p>
      </div>

      {/* Monat abschließbar? */}
      <div className={`rounded-lg p-6 border-2 ${
        istMonatAbschließbar 
          ? 'bg-green-50 border-green-500' 
          : 'bg-yellow-50 border-yellow-500'
      }`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">
            {istMonatAbschließbar ? '✅' : '⏳'}
          </div>
          <div className="flex-1">
            <h3 className={`text-2xl font-bold ${
              istMonatAbschließbar ? 'text-green-900' : 'text-yellow-900'
            }`}>
              {istMonatAbschließbar 
                ? 'Monat kann abgeschlossen werden!' 
                : 'Monat noch nicht abschließbar'}
            </h3>
            <p className={istMonatAbschließbar ? 'text-green-700' : 'text-yellow-700'}>
              {istMonatAbschließbar 
                ? 'Alle Rechnungen zugeordnet, alle Zahlungen erfasst. Export für 10it ist möglich.' 
                : 'Es gibt noch offene Zuordnungen oder fehlende Daten.'}
            </p>
          </div>
          {istMonatAbschließbar && (
            <button
              onClick={() => window.location.href = `/api/fibu/export/10it?from=${selectedPeriod.split('_')[0]}&to=${selectedPeriod.split('_')[1]}&type=alle`}
              className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 font-bold text-lg"
            >
              📥 10it Export herunterladen
            </button>
          )}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Gesamt-Fortschritt</h3>
          <span className="text-2xl font-bold text-blue-600">{gesamtfortschritt}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className="bg-blue-600 h-6 rounded-full transition-all duration-500"
            style={{ width: `${gesamtfortschritt}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {stats.vollstaendigZugeordnet} von {stats.gesamtRechnungen} Rechnungen vollständig verarbeitet
        </p>
      </div>

      {/* Kritische Probleme */}
      {!istMonatAbschließbar && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
          <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
            ⚠️ Offene Aufgaben (Kritisch)
          </h3>
          <div className="space-y-3">
            {stats.ekRechnungenOhneKreditor > 0 && (
              <div className="flex items-center justify-between bg-white p-3 rounded">
                <div>
                  <span className="font-medium text-red-900">EK-Rechnungen ohne Kreditor</span>
                  <p className="text-sm text-gray-600">Lieferantenrechnungen müssen zugeordnet werden</p>
                </div>
                <span className="bg-red-600 text-white px-4 py-2 rounded-full font-bold">
                  {stats.ekRechnungenOhneKreditor}
                </span>
              </div>
            )}
            
            {stats.vkRechnungenOhneBezahlung > 0 && (
              <div className="flex items-center justify-between bg-white p-3 rounded">
                <div>
                  <span className="font-medium text-yellow-900">VK-Rechnungen ohne Zahlung</span>
                  <p className="text-sm text-gray-600">Offene Forderungen (noch nicht bezahlt)</p>
                </div>
                <span className="bg-yellow-600 text-white px-4 py-2 rounded-full font-bold">
                  {stats.vkRechnungenOhneBezahlung}
                </span>
              </div>
            )}
            
            {stats.zahlungenNichtZugeordnet > 0 && (
              <div className="flex items-center justify-between bg-white p-3 rounded">
                <div>
                  <span className="font-medium text-orange-900">Zahlungen ohne Zuordnung</span>
                  <p className="text-sm text-gray-600">Zahlungseingänge müssen Rechnungen zugeordnet werden</p>
                </div>
                <span className="bg-orange-600 text-white px-4 py-2 rounded-full font-bold">
                  {stats.zahlungenNichtZugeordnet}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistik-Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* VK-Rechnungen */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl">🧾</div>
            <span className={`text-xs px-2 py-1 rounded ${
              stats.vkRechnungenOhneDebitor === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {stats.vkRechnungenOhneDebitor === 0 ? '✓' : `${stats.vkRechnungenOhneDebitor} offen`}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.vkRechnungenGesamt}</div>
          <div className="text-sm text-gray-600">VK-Rechnungen</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.vkRechnungenBezahlt} bezahlt
          </div>
        </div>

        {/* EK-Rechnungen */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl">📄</div>
            <span className={`text-xs px-2 py-1 rounded ${
              stats.ekRechnungenOhneKreditor === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {stats.ekRechnungenOhneKreditor === 0 ? '✓' : `${stats.ekRechnungenOhneKreditor} offen`}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.ekRechnungenGesamt}</div>
          <div className="text-sm text-gray-600">EK-Rechnungen</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.ekRechnungenZugeordnet} zugeordnet
          </div>
        </div>

        {/* Zahlungen */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl">💰</div>
            <span className={`text-xs px-2 py-1 rounded ${
              stats.zahlungenNichtZugeordnet === 0 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
            }`}>
              {stats.zahlungenNichtZugeordnet === 0 ? '✓' : `${stats.zahlungenNichtZugeordnet} offen`}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.zahlungenGesamt}</div>
          <div className="text-sm text-gray-600">Zahlungen</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.zahlungenZugeordnet} zugeordnet
          </div>
        </div>

        {/* Umsatz */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm border border-green-200 p-6">
          <div className="text-3xl mb-2">📈</div>
          <div className="text-2xl font-bold text-green-900">
            {stats.gesamtUmsatz?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <div className="text-sm text-green-700">Gesamtumsatz</div>
          <div className="mt-2 text-xs text-green-600">
            Netto: {stats.nettoUmsatz?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
          </div>
        </div>
      </div>

      {/* Detail-Liste: Was fehlt noch? */}
      {!istMonatAbschließbar && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Detaillierte Checkliste</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stats.ekRechnungenOhneKreditor === 0 ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {stats.ekRechnungenOhneKreditor === 0 ? '✓' : '✗'}
              </div>
              <span className="text-gray-700">Alle EK-Rechnungen haben Kreditoren</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stats.vkRechnungenOhneDebitor === 0 ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {stats.vkRechnungenOhneDebitor === 0 ? '✓' : '!'}
              </div>
              <span className="text-gray-700">Alle VK-Rechnungen haben Debitoren</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stats.zahlungenNichtZugeordnet === 0 ? 'bg-green-500' : 'bg-orange-500'
              }`}>
                {stats.zahlungenNichtZugeordnet === 0 ? '✓' : '✗'}
              </div>
              <span className="text-gray-700">Alle Zahlungen sind Rechnungen zugeordnet</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                stats.vkRechnungenOhneBezahlung === 0 ? 'bg-green-500' : 'bg-blue-500'
              }`}>
                {stats.vkRechnungenOhneBezahlung === 0 ? '✓' : 'i'}
              </div>
              <span className="text-gray-700">
                Alle Rechnungen bezahlt 
                {stats.vkRechnungenOhneBezahlung > 0 && (
                  <span className="text-gray-500 text-sm"> (Info: {stats.vkRechnungenOhneBezahlung} noch offen - ist OK am Monatsende)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
