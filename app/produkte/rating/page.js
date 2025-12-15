'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ArtikelRatingPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('2024-11-01')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [includeAvailability, setIncludeAvailability] = useState(false)
  const [filterHersteller, setFilterHersteller] = useState('')
  const [sortBy, setSortBy] = useState('ratingScore')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    const authStatus = localStorage.getItem('authenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
      loadArticles()
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === 'Score2025!') {
      localStorage.setItem('authenticated', 'true')
      setIsAuthenticated(true)
      loadArticles()
    } else {
      alert('Falsches Passwort!')
    }
  }

  const loadArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        includeAvailability: includeAvailability.toString()
      })
      
      const res = await fetch(`/api/jtl/articles/rating?${params}`)
      const data = await res.json()
      
      if (data.ok) {
        setArticles(data.articles)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Error loading articles:', error)
      alert('Fehler beim Laden der Artikel')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getSortedArticles = () => {
    let filtered = articles

    if (filterHersteller) {
      filtered = filtered.filter(a => 
        a.cHersteller.toLowerCase().includes(filterHersteller.toLowerCase())
      )
    }

    return filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      if (sortBy === 'cArtNr' || sortBy === 'cName' || sortBy === 'cHersteller') {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6">Artikelrating - Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded mb-4"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-semibold"
            >
              Einloggen
            </button>
          </form>
        </div>
      </div>
    )
  }

  const sortedArticles = getSortedArticles()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">📊 Artikelrating</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
          >
            ← Zurück
          </button>
        </div>

        {/* Filter */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Von Datum</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-gray-700 rounded"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Bis Datum</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-gray-700 rounded"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Hersteller Filter</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-700 rounded"
                placeholder="z.B. Klingspor"
                value={filterHersteller}
                onChange={(e) => setFilterHersteller(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2 w-5 h-5"
                  checked={includeAvailability}
                  onChange={(e) => setIncludeAvailability(e.target.checked)}
                />
                <span className="text-sm">Verfügbarkeits-Faktor</span>
              </label>
            </div>
          </div>
          <button
            onClick={loadArticles}
            disabled={loading}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? 'Lädt...' : 'Daten laden'}
          </button>
        </div>

        {/* Stats */}
        {articles.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">{sortedArticles.length}</div>
                <div className="text-sm text-gray-400">Artikel</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {sortedArticles.reduce((sum, a) => sum + a.totalMarge, 0).toFixed(0)}€
                </div>
                <div className="text-sm text-gray-400">Gesamt-Marge</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  {sortedArticles.reduce((sum, a) => sum + a.margeProMonat, 0).toFixed(0)}€
                </div>
                <div className="text-sm text-gray-400">Marge/Monat</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabelle */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-600" onClick={() => handleSort('cArtNr')}>
                    Artikelnr {sortBy === 'cArtNr' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-600" onClick={() => handleSort('cName')}>
                    Name {sortBy === 'cName' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-600" onClick={() => handleSort('cHersteller')}>
                    Hersteller {sortBy === 'cHersteller' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-600" onClick={() => handleSort('totalMenge')}>
                    Menge {sortBy === 'totalMenge' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-600" onClick={() => handleSort('totalMarge')}>
                    Marge € {sortBy === 'totalMarge' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-600" onClick={() => handleSort('margeProMonat')}>
                    Marge/Monat {sortBy === 'margeProMonat' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-600 font-bold text-yellow-400" onClick={() => handleSort('ratingScore')}>
                    Rating {sortBy === 'ratingScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400">
                      Lädt...
                    </td>
                  </tr>
                ) : sortedArticles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400">
                      Keine Artikel gefunden. Bitte Daten laden.
                    </td>
                  </tr>
                ) : (
                  sortedArticles.map((article, idx) => (
                    <tr key={idx} className="border-t border-gray-700 hover:bg-gray-700">
                      <td className="p-3 font-mono text-blue-300">{article.cArtNr}</td>
                      <td className="p-3">{article.cName}</td>
                      <td className="p-3 text-gray-400">{article.cHersteller || '-'}</td>
                      <td className="p-3 text-right">{article.totalMenge}</td>
                      <td className="p-3 text-right text-green-400">{article.totalMarge.toFixed(2)}€</td>
                      <td className="p-3 text-right font-semibold">{article.margeProMonat.toFixed(2)}€</td>
                      <td className="p-3 text-right font-bold text-yellow-400">{article.ratingScore.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
