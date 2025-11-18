'use client'

import { useState } from 'react'

/**
 * Intelligenter Zeitraum-Navigator für FIBU
 * Unterstützt: Tag, Woche, Monat, Jahr, Frei
 * Mit Vor/Zurück Navigation
 */
export default function DateRangeNavigator({ value, onChange, className = '' }) {
  const [mode, setMode] = useState('monat') // 'tag', 'woche', 'monat', 'jahr', 'frei'
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  // Parse current value
  const [currentFrom, currentTo] = value ? value.split('_') : ['', '']

  // Format date for display
  const formatDisplayDate = () => {
    if (!currentFrom || !currentTo) return 'Kein Zeitraum'

    const from = new Date(currentFrom)
    const to = new Date(currentTo)

    if (mode === 'tag') {
      return from.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    if (mode === 'woche') {
      return `KW ${getWeekNumber(from)} (${from.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - ${to.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })})`
    }
    if (mode === 'monat') {
      return from.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    }
    if (mode === 'jahr') {
      return from.getFullYear().toString()
    }
    if (mode === 'frei') {
      return `${from.toLocaleDateString('de-DE')} - ${to.toLocaleDateString('de-DE')}`
    }
  }

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1))
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7)
  }

  // Navigate prev/next
  const navigate = (direction) => {
    const from = new Date(currentFrom)
    const to = new Date(currentTo)

    if (mode === 'tag') {
      from.setDate(from.getDate() + direction)
      onChange(`${from.toISOString().split('T')[0]}_${from.toISOString().split('T')[0]}`)
    } else if (mode === 'woche') {
      from.setDate(from.getDate() + (direction * 7))
      to.setDate(to.getDate() + (direction * 7))
      onChange(`${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}`)
    } else if (mode === 'monat') {
      // Wichtig: Setze auf den 1. des Monats, bevor wir navigieren!
      from.setDate(1) // Erster Tag des aktuellen Monats
      from.setMonth(from.getMonth() + direction) // Navigiere zum Vormonat/Nächsten
      const newTo = new Date(from.getFullYear(), from.getMonth() + 1, 0) // Letzter Tag des Monats
      onChange(`${from.toISOString().split('T')[0]}_${newTo.toISOString().split('T')[0]}`)
    } else if (mode === 'jahr') {
      // Wichtig: Setze auf den 1. Januar, bevor wir navigieren!
      from.setMonth(0) // Januar
      from.setDate(1) // 1. Januar
      from.setFullYear(from.getFullYear() + direction)
      const newTo = new Date(from.getFullYear(), 11, 31) // 31. Dezember
      onChange(`${from.toISOString().split('T')[0]}_${newTo.toISOString().split('T')[0]}`)
    }
  }

  // Set date range based on mode
  const setDateRange = (newMode) => {
    setMode(newMode)

    const today = new Date()
    let from, to

    if (newMode === 'tag') {
      from = to = today
    } else if (newMode === 'woche') {
      // Letzte 7 Tage
      from = new Date()
      from.setDate(today.getDate() - 6)
      to = today
    } else if (newMode === 'monat') {
      // Aktueller Kalendermonat
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    } else if (newMode === 'jahr') {
      // Aktuelles Kalenderjahr
      from = new Date(today.getFullYear(), 0, 1)
      to = new Date(today.getFullYear(), 11, 31)
    } else if (newMode === 'frei') {
      setShowCustomPicker(true)
      return
    }

    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]
    onChange(`${fromStr}_${toStr}`)
    setShowCustomPicker(false)
  }

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      onChange(`${customFrom}_${customTo}`)
      setShowCustomPicker(false)
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Mode Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          📅 {formatDisplayDate()}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showCustomPicker && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4 min-w-[280px]">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Zeitraum wählen:</div>
              
              <button
                onClick={() => setDateRange('tag')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${mode === 'tag' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
              >
                Tag
              </button>
              <button
                onClick={() => setDateRange('woche')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${mode === 'woche' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
              >
                Woche (letzte 7 Tage)
              </button>
              <button
                onClick={() => setDateRange('monat')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${mode === 'monat' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
              >
                Monat
              </button>
              <button
                onClick={() => setDateRange('jahr')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${mode === 'jahr' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
              >
                Jahr
              </button>
              
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Freie Auswahl:</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Von:</label>
                    <input
                      type="date"
                      value={customFrom || currentFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Bis:</label>
                    <input
                      type="date"
                      value={customTo || currentTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setMode('frei')
                      applyCustomRange()
                    }}
                    className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 font-medium"
                  >
                    Anwenden
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Arrows (only for Tag, Woche, Monat, Jahr) */}
      {mode !== 'frei' && (
        <>
          <button
            onClick={() => navigate(-1)}
            className="bg-white border border-gray-300 rounded-lg p-2 hover:bg-gray-50"
            title="Zurück"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="bg-white border border-gray-300 rounded-lg p-2 hover:bg-gray-50"
            title="Vor"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
