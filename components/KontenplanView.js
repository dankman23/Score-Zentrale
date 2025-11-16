'use client'

import { useState, useEffect } from 'react'
import KreditorenManagement from './KreditorenManagement'
import ZahlungsEinstellungen from './ZahlungsEinstellungen'

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
  
  // Haupt-Tab-Navigation
  const [activeMainTab, setActiveMainTab] = useState('kontenplan')
  
  useEffect(() => {
    loadKontenplan()
  }, [])
  
  async function loadKontenplan() {
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
  }
  
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
          <h2 className="text-2xl font-bold text-gray-900">📋 Kontenplan & Stammdaten</h2>
          <p className="text-sm text-gray-600 mt-1">
            SKR04 Abschlussgliederungsprinzip
          </p>
        </div>
        
        {activeMainTab === 'kontenplan' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Neues Konto
          </button>
        )}
      </div>
      
      {/* Haupt-Tab-Navigation - KOMPAKT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveMainTab('kontenplan')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'kontenplan'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              📊 Kontenplan ({konten.length})
            </button>
            
            <button
              onClick={() => setActiveMainTab('kreditoren')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'kreditoren'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              🏢 Kreditoren
            </button>
            
            <button
              onClick={() => setActiveMainTab('debitoren')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'debitoren'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              👥 Debitoren
            </button>
            
            <button
              onClick={() => setActiveMainTab('kostenarten')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'kostenarten'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              💰 Kostenarten
            </button>
            
            <button
              onClick={() => setActiveMainTab('kostenstellen')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'kostenstellen'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              🏭 Kostenstellen
            </button>
            
            <button
              onClick={() => setActiveMainTab('einstellungen')}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeMainTab === 'einstellungen'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              ⚙️ Einstellungen
            </button>
          </div>
        </div>
      </div>
      
      {/* Content: Kontenplan */}
      {activeMainTab === 'kontenplan' && (
        <>
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
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {grouped.map((klasseData) => (
              <button
                key={klasseData.klasse}
                onClick={() => setSelectedKlasse(klasseData.klasse)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  selectedKlasse === klasseData.klasse
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{klasseData.klasse}</span>
                  <span>{klasseData.bezeichnung}</span>
                  <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {klasseData.konten.length}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="p-6">
          {grouped.filter(k => k.klasse === selectedKlasse).map((klasseData) => (
            <div key={klasseData.klasse}>
              {/* Klassen-Info */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Klasse {klasseData.klasse}: {klasseData.bezeichnung}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {klasseData.typ}
                  </span>
                  <span>
                    {klasseData.konten.length} Konten
                  </span>
                </div>
              </div>
              
              {/* Konten-Tabelle */}
              {klasseData.konten.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                        <th className="pb-3 pr-4">Konto</th>
                        <th className="pb-3 pr-4">Bezeichnung</th>
                        <th className="pb-3 pr-4">Gruppe</th>
                        <th className="pb-3 pr-4">Steuer</th>
                        <th className="pb-3 pr-4 text-center">Status</th>
                        <th className="pb-3 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {klasseData.konten.map((konto) => (
                        <tr key={konto.kontonummer} className="hover:bg-gray-50">
                          <td className="py-4 pr-4">
                            <span className="font-mono text-sm font-bold text-blue-600">
                              {konto.kontonummer}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="text-sm text-gray-900 font-medium">{konto.bezeichnung}</div>
                            {konto.beschreibung && (
                              <div className="text-xs text-gray-500 mt-1">{konto.beschreibung}</div>
                            )}
                          </td>
                          <td className="py-4 pr-4">
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {konto.kontengruppe}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            {konto.steuerrelevant && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                {konto.steuersatz ? `${konto.steuersatz}%` : 'VSt'}
                              </span>
                            )}
                          </td>
                          <td className="py-4 pr-4 text-center">
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-medium ${
                                konto.istAktiv
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {konto.istAktiv ? '✓ Aktiv' : '○ Inaktiv'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => setEditingKonto(konto)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                ✏️ Bearbeiten
                              </button>
                              {!konto.istSystemkonto && (
                                <button
                                  onClick={() => deleteKonto(konto.kontonummer)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  🗑️ Löschen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Keine Konten in dieser Klasse
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
        </>
      )}
      
      {/* Content: Kreditoren */}
      {activeMainTab === 'kreditoren' && (
        <KreditorenManagement />
      )}
      
      {/* Content: Debitoren */}
      {activeMainTab === 'debitoren' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">👥 Sammel-Debitorenkonten</h3>
          <p className="text-sm text-gray-600 mb-4">
            Debitorenkonten werden nach Zahlungsart gruppiert (siehe Einstellungen)
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              💡 Wie funktionieren Sammel-Debitorenkonten?
            </p>
            <p className="text-sm text-blue-800 mb-3">
              Anstatt für jeden Kunden ein eigenes Debitorenkonto anzulegen, werden Kunden nach <strong>Zahlungsart gruppiert</strong>. 
              Dies vereinfacht die Buchhaltung erheblich, besonders bei vielen Marketplace-Transaktionen.
            </p>
            <div className="bg-blue-100 rounded p-3 text-xs text-blue-900">
              <strong>Beispiel:</strong><br/>
              • Alle Amazon-Kunden → Debitor 69002<br/>
              • Alle PayPal-Kunden → Debitor 69001<br/>
              • Alle eBay-Kunden → Debitor 69003
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Konfigurierte Debitorenkonten:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-mono text-lg font-bold text-blue-600">69001</div>
                <div className="text-sm text-gray-700 font-medium">PayPal-Kunden</div>
                <div className="text-xs text-gray-500 mt-1">Zahlungsart: Paypal</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-mono text-lg font-bold text-blue-600">69002</div>
                <div className="text-sm text-gray-700 font-medium">Amazon-Kunden</div>
                <div className="text-xs text-gray-500 mt-1">Zahlungsart: Amazon Payment</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-mono text-lg font-bold text-blue-600">69003</div>
                <div className="text-sm text-gray-700 font-medium">eBay-Kunden</div>
                <div className="text-xs text-gray-500 mt-1">Zahlungsart: eBay Managed Payments</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-mono text-lg font-bold text-blue-600">69015</div>
                <div className="text-sm text-gray-700 font-medium">Mollie-Kunden</div>
                <div className="text-xs text-gray-500 mt-1">Zahlungsart: Mollie</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-mono text-lg font-bold text-blue-600">69050</div>
                <div className="text-sm text-gray-700 font-medium">Vorkasse-Kunden</div>
                <div className="text-xs text-gray-500 mt-1">Zahlungsart: Überweisung / Vorkasse</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              → Debitorenkonten werden in den <strong>Einstellungen</strong> konfiguriert und sind mit den Zahlungsarten aus JTL verknüpft.
            </p>
          </div>
        </div>
      )}
      
      {/* Content: Kostenarten */}
      {activeMainTab === 'kostenarten' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kostenarten-Verwaltung</h3>
            <p className="text-sm text-gray-600 mb-4">
              Kostenarten für detaillierte Kostenanalyse und Controlling
            </p>
            <div className="bg-yellow-50 border border-yellow-200 p-4 max-w-2xl mx-auto text-left rounded mb-4">
              <p className="text-xs text-yellow-900 font-semibold mb-2">
                💡 Was sind Kostenarten?
              </p>
              <p className="text-xs text-yellow-800 mb-3">
                Kostenarten ermöglichen eine detaillierte Kostenanalyse und Zuordnung zu verschiedenen Kostenkategorien.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-yellow-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-yellow-900">
                  👤 Personalkosten
                </div>
                <div className="bg-yellow-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-yellow-900">
                  📦 Materialkosten
                </div>
                <div className="bg-yellow-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-yellow-900">
                  📢 Vertriebskosten
                </div>
              </div>
            </div>
            <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium">
              + Neue Kostenart anlegen
            </button>
          </div>
        </div>
      )}
      
      {/* Content: Kostenstellen */}
      {activeMainTab === 'kostenstellen' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🏭</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kostenstellen-Verwaltung</h3>
            <p className="text-sm text-gray-600 mb-4">
              Zuordnung von Kosten zu Abteilungen und Bereichen
            </p>
            <div className="bg-purple-50 border border-purple-200 p-4 max-w-2xl mx-auto text-left rounded mb-4">
              <p className="text-xs text-purple-900 font-semibold mb-2">
                💡 Was sind Kostenstellen?
              </p>
              <p className="text-xs text-purple-800 mb-3">
                Kostenstellen ermöglichen die Zuordnung von Kosten zu verschiedenen Abteilungen oder Geschäftsbereichen.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-purple-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-purple-900">
                  📊 Vertrieb
                </div>
                <div className="bg-purple-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-purple-900">
                  📢 Marketing
                </div>
                <div className="bg-purple-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-purple-900">
                  🏢 Verwaltung
                </div>
                <div className="bg-purple-100 px-2 py-1.5 rounded text-center text-xs font-semibold text-purple-900">
                  🏭 Produktion
                </div>
              </div>
            </div>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              + Neue Kostenstelle anlegen
            </button>
          </div>
        </div>
      )}
      
      {/* Content: Einstellungen */}
      {activeMainTab === 'einstellungen' && (
        <ZahlungsEinstellungen />
      )}
      
      {/* Edit/Create Modal - only for kontenplan */}
      {activeMainTab === 'kontenplan' && (editingKonto || showCreateForm) && (
        <KontoFormModal
          konto={editingKonto}
          onSave={saveKonto}
          onClose={() => {
            setEditingKonto(null)
            setShowCreateForm(false)
          }}
        />
      )}
    </div>
  )
}

// Konto Form Modal
function KontoFormModal({ konto, onSave, onClose }) {
  const [formData, setFormData] = useState(konto || {
    kontonummer: '',
    bezeichnung: '',
    beschreibung: '',
    steuersatz: undefined,
    vorsteuer: false,
    istAktiv: true
  })
  
  function handleSubmit(e) {
    e.preventDefault()
    onSave(formData)
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {konto ? 'Konto bearbeiten' : 'Neues Konto anlegen'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontonummer (4-stellig) *
              </label>
              <input
                type="text"
                value={formData.kontonummer}
                onChange={(e) => setFormData({ ...formData, kontonummer: e.target.value })}
                placeholder="z.B. 1802"
                maxLength={4}
                required
                disabled={!!konto}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bezeichnung *
              </label>
              <input
                type="text"
                value={formData.bezeichnung}
                onChange={(e) => setFormData({ ...formData, bezeichnung: e.target.value })}
                placeholder="z.B. Postbank"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                value={formData.beschreibung || ''}
                onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                placeholder="Zusätzliche Informationen..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Steuersatz
                </label>
                <select
                  value={formData.steuersatz || ''}
                  onChange={(e) => setFormData({ ...formData, steuersatz: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keine USt</option>
                  <option value="7">7%</option>
                  <option value="19">19%</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.vorsteuer || false}
                    onChange={(e) => setFormData({ ...formData, vorsteuer: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Vorsteuer</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.istAktiv}
                  onChange={(e) => setFormData({ ...formData, istAktiv: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Konto ist aktiv</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
