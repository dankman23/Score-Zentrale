'use client'

import { useState, useEffect } from 'react'

export default function ZahlungsEinstellungen() {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Default Einstellungen basierend auf dem Screenshot
  const defaultSettings = [
    {
      id: 'amazon_payment',
      name: 'Amazon Payment',
      zahlungsart: 'Amazon Payment',
      debitorKonto: '69002',
      erloeseKonto: '4400',
      bankKonto: '1201',
      gebuehrenKonto: '4985',
      beschreibung: 'Amazon Marketplace Zahlungen'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      zahlungsart: 'Paypal',
      debitorKonto: '69001',
      erloeseKonto: '4400',
      bankKonto: '1202',
      gebuehrenKonto: '4985',
      beschreibung: 'PayPal Zahlungen'
    },
    {
      id: 'ebay',
      name: 'eBay Managed Payments',
      zahlungsart: 'eBay Managed Payments',
      debitorKonto: '69003',
      erloeseKonto: '4400',
      bankKonto: '1203',
      gebuehrenKonto: '4985',
      beschreibung: 'eBay Zahlungen'
    },
    {
      id: 'mollie',
      name: 'Mollie',
      zahlungsart: 'Mollie',
      debitorKonto: '69015',
      erloeseKonto: '4400',
      bankKonto: '1204',
      gebuehrenKonto: '4985',
      beschreibung: 'Mollie Zahlungen (eigener Shop)'
    },
    {
      id: 'vorkasse',
      name: 'Überweisung / Vorkasse',
      zahlungsart: 'Überweisung / Vorkasse',
      debitorKonto: '69050',
      erloeseKonto: '4400',
      bankKonto: '1200',
      gebuehrenKonto: '',
      beschreibung: 'Direkte Banküberweisungen'
    },
    {
      id: 'commerzbank',
      name: 'Commerzbank',
      zahlungsart: 'Commerzbank',
      debitorKonto: '',
      erloeseKonto: '',
      bankKonto: '1200',
      gebuehrenKonto: '4985',
      beschreibung: 'Hauptbankkonto Commerzbank'
    }
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/fibu/zahlungseinstellungen')
      const data = await res.json()
      
      if (data.ok && data.settings && data.settings.length > 0) {
        setSettings(data.settings)
      } else {
        // Falls keine Einstellungen vorhanden, defaults laden
        setSettings(defaultSettings)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
      setSettings(defaultSettings)
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/fibu/zahlungseinstellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ Einstellungen gespeichert!')
        setEditingId(null)
      } else {
        alert('❌ Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    }
    setSaving(false)
  }

  function updateSetting(id, field, value) {
    setSettings(settings.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Einstellungen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">⚙️ Konten-Zuordnung</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Zuordnung von Debitorenkonten und Bankkonten zu Zahlungsarten
          </p>
        </div>
        
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {saving ? '💾 Speichert...' : '💾 Speichern'}
        </button>
      </div>

      {/* Info Box - KOMPAKT */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
        <div className="flex items-start">
          <div className="text-blue-600 text-lg mr-2 mt-0.5">ℹ️</div>
          <div>
            <p className="text-blue-900 font-semibold text-sm">Kontenplan-Referenz (SKR04)</p>
            <div className="text-blue-800 text-xs mt-1 space-y-0.5">
              <div><strong>1200-1299:</strong> Bank-Konten (Commerzbank, PayPal, Amazon, etc.)</div>
              <div><strong>69001-69999:</strong> Sammel-Debitorenkonten (pro Zahlungsart)</div>
              <div><strong>4400:</strong> Erlöse • <strong>4985:</strong> Gebühren</div>
            </div>
          </div>
        </div>
      </div>

      {/* Einstellungen-Cards - KOMPAKT */}
      <div className="space-y-2">
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow transition"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">{setting.name}</h3>
                <p className="text-xs text-gray-500">{setting.beschreibung}</p>
              </div>
              <button
                onClick={() => setEditingId(editingId === setting.id ? null : setting.id)}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium ml-4"
              >
                {editingId === setting.id ? '✓ Fertig' : '✏️ Bearbeiten'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Zahlungsart */}
              <div>
                <label className="block text-gray-600 text-xs mb-0.5 font-medium">Zahlungsart (JTL)</label>
                {editingId === setting.id ? (
                  <input
                    type="text"
                    value={setting.zahlungsart}
                    onChange={(e) => updateSetting(setting.id, 'zahlungsart', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                ) : (
                  <div className="bg-gray-50 px-2 py-1 rounded text-xs font-mono text-gray-900">
                    {setting.zahlungsart || '-'}
                  </div>
                )}
              </div>

              {/* Debitor-Konto */}
              <div>
                <label className="block text-gray-600 text-xs mb-0.5 font-medium">Debitor-Konto</label>
                {editingId === setting.id ? (
                  <input
                    type="text"
                    value={setting.debitorKonto}
                    onChange={(e) => updateSetting(setting.id, 'debitorKonto', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="69xxx"
                  />
                ) : (
                  <div className="bg-green-50 px-2 py-1 rounded text-xs font-mono text-green-900 font-bold">
                    {setting.debitorKonto || '-'}
                  </div>
                )}
              </div>

              {/* Bank-Konto */}
              <div>
                <label className="block text-gray-600 text-xs mb-0.5 font-medium">Bank-Konto</label>
                {editingId === setting.id ? (
                  <input
                    type="text"
                    value={setting.bankKonto}
                    onChange={(e) => updateSetting(setting.id, 'bankKonto', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="12xx"
                  />
                ) : (
                  <div className="bg-purple-50 px-2 py-1 rounded text-xs font-mono text-purple-900 font-bold">
                    {setting.bankKonto || '-'}
                  </div>
                )}
              </div>

              {/* Gebühren-Konto */}
              <div>
                <label className="block text-gray-600 text-xs mb-0.5 font-medium">Gebühren-Konto</label>
                {editingId === setting.id ? (
                  <input
                    type="text"
                    value={setting.gebuehrenKonto}
                    onChange={(e) => updateSetting(setting.id, 'gebuehrenKonto', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="4985"
                  />
                ) : (
                  <div className="bg-orange-50 px-2 py-1 rounded text-xs font-mono text-orange-900 font-bold">
                    {setting.gebuehrenKonto || '-'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Beispiel-Buchungssatz - KOMPAKT */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
        <div className="flex items-start">
          <div className="text-yellow-600 text-lg mr-2 mt-0.5">💡</div>
          <div className="flex-1">
            <p className="text-yellow-900 font-semibold text-xs mb-1.5">Beispiel-Buchungssatz (Amazon Payment)</p>
            <div className="bg-white rounded p-2 text-xs font-mono text-gray-800 leading-relaxed">
              <div>Soll: 1201 (Amazon Bank) • 100,00 €</div>
              <div>Soll: 4985 (Gebühren) • 15,00 €</div>
              <div className="border-t border-gray-300 my-1"></div>
              <div>Haben: 4400 (Erlöse) • 115,00 €</div>
              <div className="text-gray-500 text-xs mt-1">→ Debitor: 69002 (Amazon Sammelkonto)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
