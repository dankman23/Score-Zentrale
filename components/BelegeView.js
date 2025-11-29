/**
 * Belege-Übersicht mit manueller Zuordnung
 */

'use client'

import { useState, useEffect } from 'react'
import BelegDetailModal from './BelegDetailModal'

export default function BelegeView() {
  const [belege, setBelege] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('alle') // 'alle' | 'offen' | 'zugeordnet'
  
  // Modal
  const [showModal, setShowModal] = useState(false)
  const [selectedBeleg, setSelectedBeleg] = useState(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  
  useEffect(() => {
    loadBelege()
  }, [page, filter])
  
  async function loadBelege() {
    setLoading(true)
    
    try {
      // TODO: API für Belege-Liste
      // Aktuell Mock-Daten
      const mockBelege = []
      
      setBelege(mockBelege)
      
    } catch (err) {
      console.error('Fehler beim Laden der Belege:', err)
    }
    
    setLoading(false)
  }
  
  const filteredBelege = belege.filter(b => {
    if (filter === 'offen') return !b.istZugeordnet
    if (filter === 'zugeordnet') return b.istZugeordnet
    return true
  })
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Belege</h2>
        
        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('alle')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'alle'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle ({belege.length})
          </button>
          <button
            onClick={() => setFilter('offen')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'offen'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Nicht zugeordnet ({belege.filter(b => !b.istZugeordnet).length})
          </button>
          <button
            onClick={() => setFilter('zugeordnet')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'zugeordnet'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Zugeordnet ({belege.filter(b => b.istZugeordnet).length})
          </button>
        </div>
      </div>
      
      {/* Tabelle */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">
          Lade Belege...
        </div>
      ) : filteredBelege.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">Keine Belege gefunden</p>
          <p className="text-sm text-gray-500 mt-2">
            {filter === 'offen' ? 'Alle Belege sind bereits zugeordnet' : 'Versuchen Sie einen anderen Filter'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Belegnummer</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBelege.map(beleg => (
                <tr key={beleg._id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">
                    {beleg.belegnummer}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    {new Date(beleg.rechnungsdatum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    {beleg.kundenname || '—'}
                  </td>
                  <td className="px-3 py-3 text-sm text-right font-medium text-gray-900">
                    {beleg.brutto?.toFixed(2)} €
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {beleg.istZugeordnet ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Zugeordnet
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Offen
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-right">
                    <button
                      onClick={() => {
                        setSelectedBeleg(beleg)
                        setShowModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Zuordnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal */}
      {showModal && selectedBeleg && (
        <BelegDetailModal
          beleg={selectedBeleg}
          onClose={() => {
            setShowModal(false)
            setSelectedBeleg(null)
          }}
          onSave={() => {
            setShowModal(false)
            setSelectedBeleg(null)
            loadBelege()
          }}
        />
      )}
    </div>
  )
}
