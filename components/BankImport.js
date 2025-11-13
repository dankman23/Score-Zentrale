'use client'

import { useState } from 'react'

export default function BankImport({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  async function handleUpload() {
    if (!file) return
    
    setUploading(true)
    setResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/fibu/bank-import', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (data.ok) {
        setResult({
          success: true,
          imported: data.imported,
          total: data.total,
          format: data.format
        })
        
        if (onSuccess) onSuccess()
      } else {
        setResult({ success: false, error: data.error })
      }
    } catch (error) {
      setResult({ success: false, error: error.message })
    }
    
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Postbank CSV Import</h2>
        <p className="text-sm text-gray-600 mt-1">
          Lade Postbank-Kontoauszüge hoch, um Transaktionen zu importieren
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV-Datei auswählen
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
          </div>

          {file && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{file.name}</div>
                  <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-xs text-blue-800">
                <strong>Hinweis:</strong> Unterstützte Formate:
                <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
                  <li>Postbank CSV (Buchungstag, Verwendungszweck, Betrag)</li>
                  <li>Commerzbank CSV (Buchungstag, Umsatzart, Betrag)</li>
                </ul>
                <div className="mt-2">
                  Duplikate werden automatisch erkannt und übersprungen.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importiere...
              </>
            ) : (
              <>
                📤 CSV importieren
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 ${
          result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          {result.success ? (
            <div className="flex items-start">
              <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  ✅ Import erfolgreich!
                </h3>
                <div className="text-sm text-green-800 space-y-1">
                  <div>• <strong>{result.imported}</strong> neue Transaktionen importiert</div>
                  <div>• <strong>{result.total - result.imported}</strong> Duplikate übersprungen</div>
                  <div>• Format: <strong>{result.format}</strong></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  ❌ Fehler beim Import
                </h3>
                <div className="text-sm text-red-800">
                  {result.error}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Importierte Transaktionen anzeigen */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Letzte Importe</h3>
        <TransactionsList />
      </div>
    </div>
  )
}

function TransactionsList() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    loadTransactions()
  }, [])

  async function loadTransactions() {
    try {
      const res = await fetch('/api/fibu/bank-import?limit=20')
      const data = await res.json()
      if (data.ok) {
        setTransactions(data.transaktionen || [])
      }
    } catch (error) {
      console.error('Fehler:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Lade...</div>
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Noch keine Transaktionen importiert</p>
        <p className="text-sm mt-1">Lade eine CSV-Datei hoch, um zu beginnen</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verwendungszweck</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quelle</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((tx, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(tx.datum).toLocaleDateString('de-DE')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {tx.verwendungszweck.substring(0, 60)}{tx.verwendungszweck.length > 60 ? '...' : ''}
              </td>
              <td className={`px-4 py-3 text-sm font-medium ${
                tx.betrag >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {tx.betrag.toFixed(2)}€
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{tx.quelle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
