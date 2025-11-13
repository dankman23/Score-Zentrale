'use client'

import { useState, useEffect } from 'react'

export default function KontenplanView() {
  const [kontenplan, setKontenplan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sachkonten')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadKontenplan()
  }, [])

  async function loadKontenplan() {
    try {
      const res = await fetch('/api/fibu/kontenplan')
      const data = await res.json()
      if (data.ok) {
        setKontenplan(data.kontenplan)
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Lade Kontenplan...</p>
        </div>
      </div>
    )
  }

  if (!kontenplan) {
    return <div className="p-8 text-center text-red-600">Fehler beim Laden des Kontenplans</div>
  }

  const filteredSachkonten = kontenplan.sachkonten.filter(k =>
    k.konto.includes(searchTerm) || k.bezeichnung.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredKreditoren = kontenplan.kreditoren_aktiv.filter(k =>
    k.konto.includes(searchTerm) || k.bezeichnung.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Kontenplan</h2>
        <p className="text-sm text-gray-600 mt-1">
          Vollständiger Kontenplan für die Buchhaltung (SKR03-ähnlich)
        </p>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Suche Konto oder Bezeichnung..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {[
            { id: 'sachkonten', label: '📊 Sachkonten', count: kontenplan.sachkonten.length },
            { id: 'kreditoren', label: '🏭 Kreditoren', count: kontenplan.kreditoren_aktiv.length },
            { id: 'debitoren', label: '👥 Debitoren', count: kontenplan.debitoren.length },
            { id: 'kasse_bank', label: '🏦 Kasse/Bank', count: kontenplan.kasse_bank.length },
            { id: 'steuer', label: '📄 Steuerkonten', count: kontenplan.steuer.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        
        {/* Sachkonten */}
        {activeTab === 'sachkonten' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bezeichnung</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSachkonten.map((konto, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {konto.konto}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{konto.bezeichnung}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        konto.typ === 'Erlöse' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {konto.typ}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {konto.kategorie}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kreditoren */}
        {activeTab === 'kreditoren' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kreditor-Nr</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standard-Konto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredKreditoren.map((kreditor, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {kreditor.konto}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{kreditor.bezeichnung}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {kreditor.standardKonto}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
              <p className="text-sm text-blue-800">
                💡 <strong>Hinweis:</strong> Kreditoren-Nummern 70000-79999 sind für Lieferanten reserviert. 
                Neue Kreditoren können über "Kreditor-Zuordnung" → "Neuer Kreditor" angelegt werden.
              </p>
            </div>
          </div>
        )}

        {/* Debitoren */}
        {activeTab === 'debitoren' && (
          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-2">Bereich 10000-19999: Debitoren (Kunden)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Forderungen aus Lieferungen und Leistungen
                </p>
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Konto</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Bezeichnung</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Beispiel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kontenplan.debitoren.map((deb, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 text-sm font-medium text-blue-600">{deb.konto || deb.bereich}</td>
                        <td className="py-2 text-sm text-gray-900">{deb.bezeichnung}</td>
                        <td className="py-2 text-sm text-gray-600">{deb.beispiel || deb.beschreibung}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Automatisch:</strong> VK-Rechnungen aus JTL werden automatisch Debitoren-Konten zugeordnet.
                  Marketplace-Kunden (Amazon, eBay, Otto) laufen über Sammelkonten (z.B. 99012594).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Kasse/Bank */}
        {activeTab === 'kasse_bank' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bezeichnung</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kontenplan.kasse_bank.map((konto, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {konto.konto}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{konto.bezeichnung}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        konto.typ === 'Bank' ? 'bg-blue-100 text-blue-800' : 
                        konto.typ === 'Kasse' ? 'bg-green-100 text-green-800' : 
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {konto.typ}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Steuer */}
        {activeTab === 'steuer' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bezeichnung</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Art</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kontenplan.steuer.map((konto, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {konto.konto}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{konto.bezeichnung}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        konto.typ === 'VSt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {konto.typ}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
