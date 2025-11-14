'use client'

import { useState } from 'react'

export default function DateRangePicker({ value, onChange, label = 'Zeitraum' }) {
  const [mode, setMode] = useState('preset') // 'preset' or 'custom'
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function handlePresetChange(preset) {
    setMode('preset')
    onChange(preset)
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      const newValue = `${customFrom}_${customTo}`
      setMode('custom')
      onChange(newValue)
    }
  }

  const [from, to] = value.split('_')

  return (
    <div className="flex items-center gap-2">
      {mode === 'preset' && (
        <>
          <select 
            value={value}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="2025-10-01_2025-10-31">Oktober 2025</option>
            <option value="2025-11-01_2025-11-30">November 2025</option>
            <option value="2025-10-01_2025-11-30">Okt + Nov 2025</option>
            <option value="2025-01-01_2025-12-31">Gesamtes Jahr 2025</option>
            <option value="2024-01-01_2024-12-31">Gesamtes Jahr 2024</option>
          </select>
          <button
            onClick={() => {
              setMode('custom')
              setCustomFrom(from)
              setCustomTo(to)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
            title="Benutzerdefinierter Zeitraum"
          >
            📅
          </button>
        </>
      )}
      
      {mode === 'custom' && (
        <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
          <span className="text-xs font-medium text-blue-900">Von:</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <span className="text-xs font-medium text-blue-900">Bis:</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={handleCustomApply}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm font-medium"
          >
            ✓
          </button>
          <button
            onClick={() => {
              setMode('preset')
              onChange('2025-10-01_2025-11-30')
            }}
            className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400 text-sm font-medium"
          >
            ✗
          </button>
        </div>
      )}
    </div>
  )
}
