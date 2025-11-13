'use client'

import { useState } from 'react'

export default function ExportDialog({ onClose, period }) {
  const [exportType, setExportType] = useState('alle')
  const [loading, setLoading] = useState(false)
  
  const [from, to] = period.split('_')

  async function handleExport() {
    setLoading(true)
    try {
      let url = `/api/fibu/export/10it?from=${from}&to=${to}`
      
      if (exportType !== 'alle') {
        url += `&type=${exportType}`
      }
      
      // Download File
      window.location.href = url
      
      // Warte kurz und schließe Dialog
      setTimeout(() => {
        setLoading(false)
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Export Fehler:', error)
      alert('Fehler beim Export: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">📥 Export für Tennet</h3>
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

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zeitraum
            </label>
            <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-gray-700">
              {new Date(from).toLocaleDateString('de-DE')} - {new Date(to).toLocaleDateString('de-DE')}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export-Typ
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="alle"
                  checked={exportType === 'alle'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Alle Buchungen</span>
                  <span className="text-gray-500 ml-2">(VK + EK)</span>
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="vk"
                  checked={exportType === 'vk'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Nur VK-Rechnungen</span>
                  <span className="text-gray-500 ml-2">(Verkauf)</span>
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="ek"
                  checked={exportType === 'ek'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Nur EK-Rechnungen</span>
                  <span className="text-gray-500 ml-2">(Einkauf)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-xs text-blue-800">
                <strong>Hinweis:</strong> Die CSV-Datei kann direkt in Tennet importiert werden.
                Format: 10it-kompatibel mit allen Buchungsdaten.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exportiere...
              </>
            ) : (
              <>
                📥 CSV Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
