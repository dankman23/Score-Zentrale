'use client'

import { useState, useEffect } from 'react'
import KreditorZuordnung from './KreditorZuordnung'
import ExportDialog from './ExportDialog'
import BankImport from './BankImport'
import KontenplanView from './KontenplanView'
import KreditorenManagement from './KreditorenManagement'
import VKRechnungenView from './VKRechnungenView'
import EKRechnungenView from './EKRechnungenView'
import ZahlungenView from './ZahlungenView'
import ZahlungsEinstellungen from './ZahlungsEinstellungen'
import FibuMonatsUebersicht from './FibuMonatsUebersicht'
import FuzzyMatchingView from './FuzzyMatchingView'
import DateRangeNavigator from './DateRangeNavigator'

// Groteske Zitate
const QUOTES = [
  '"Wer seine Zahlen kennt, braucht keine Glaskugel." - Aristoteles feat. Dieter Bohlen',
  '"Das ungeprüfte Konto ist nicht wert, gebucht zu werden." - Sokrates feat. Daniela Katzenberger',
  '"Ich denke, also buche ich." - René Descartes feat. Claudia Obert',
  '"In der Buchhaltung liegt die wahre Weisheit." - Konfuzius feat. Dschungelcamp-Gina Lisa',
  '"Ein Beleg ist mehr wert als tausend Worte." - Laozi feat. Michael Wendler',
  '"Der kategorische Imperativ der Finanzen: Buche nur, was du selbst als Gesetz wollen kannst." - Immanuel Kant feat. Willi Herren',
  '"Cogito, ergo sum solvent." - Descartes feat. Sarah Lombardi',
  '"Das Sein bestimmt das Bankkonto." - Karl Marx feat. Carmen Geiss',
  '"Alles fließt - auch das Geld." - Heraklit feat. Sophia Vegas',
  '"Der Mensch ist die Summe seiner Rechnungen." - Jean-Paul Sartre feat. Natascha Ochsenknecht',
  '"Geld verdirbt den Charakter - aber fehlende Buchungen noch mehr!" - Nietzsche feat. Micaela Schäfer',
  '"Was du nicht willst, dass man dir tu, das buche auf Konto 42." - Goldene Regel feat. Iris Klein',
  '"Ich weiß, dass ich nichts weiß - außer meinen Kontostand." - Sokrates feat. Evelyn Burdecki',
  '"Zeit ist Geld, Buchhaltung ist beides." - Benjamin Franklin feat. Ennesto Monté',
  '"Der Rubel muss rollen - und zwar SKR04-konform!" - Lenin feat. Katja Krasavice',
  '"Erkenne dich selbst - und deine Verbindlichkeiten!" - Orakel von Delphi feat. Giulia Siegel',
  '"Alles hat seinen Preis, auch die Steuerberatung." - Thomas von Aquin feat. Jenny Frankhauser',
  '"Das Leben ist ein Cashflow-Problem." - Buddha feat. Bachelorette-Jessica',
  '"Dubium sapientiae initium - Zweifel ist der Anfang der Weisheit, Buchung das Ende." - Cicero feat. Pietro Lombardi',
  '"Carpe Diem, aber vergiss nicht den Jahresabschluss!" - Horaz feat. Matthias Mangiapane'
]

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}

export default function FibuCompleteDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false) // Changed to false - no initial load
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // FIBU-Standard: Oktober 2025 (erste Daten im System)
    return '2025-10-01_2025-10-31'
  })
  const [activeTab, setActiveTab] = useState('uebersicht') // Start with overview
  const [einstellungenSubTab, setEinstellungenSubTab] = useState('bank-import') // Sub-tab für Einstellungen
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [tabFilters, setTabFilters] = useState({}) // Store filters per tab
  const [quote] = useState(() => getRandomQuote())
  const [showRefreshMenu, setShowRefreshMenu] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Parse URL parameters on mount and URL changes
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.split('?')[1])
      
      const tab = params.get('tab')
      const filter = params.get('filter')
      
      if (tab) {
        setActiveTab(tab)
      }
      
      if (filter) {
        setTabFilters(prev => ({
          ...prev,
          [tab || activeTab]: filter
        }))
      }
    }
    
    // Check on mount
    handleHashChange()
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Lazy Loading - lade nur Overview-Daten wenn Übersicht-Tab aktiv ist
  useEffect(() => {
    if (activeTab === 'uebersicht') {
      loadData()
    }
  }, [selectedPeriod, activeTab])

  async function loadData(forceReload = false) {
    setLoading(true)
    try {
      const [from, to] = selectedPeriod.split('_')
      const forceParam = forceReload ? '&force=true' : ''
      const res = await fetch(`/api/fibu/uebersicht/complete?from=${from}&to=${to}${forceParam}`)
      const json = await res.json()
      setData(json)
      
      if (json.cached) {
        console.log(`✅ Daten aus Cache geladen (${json.cacheAge}s alt)`)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }

  async function runAutoMatch() {
    setShowRefreshMenu(false)
    
    if (!confirm('Auto-Zuordnung für den gewählten Zeitraum starten?\n\nDies ordnet Zahlungen automatisch Rechnungen und Konten zu.')) {
      return
    }
    
    setRefreshing(true)
    
    try {
      console.log('🤖 Starte Auto-Matching...')
      
      const res = await fetch('/api/fibu/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zeitraum: selectedPeriod,
          dryRun: false 
        })
      })
      
      const data = await res.json()
      
      if (data.ok) {
        const { matched, stats } = data
        
        alert(`✅ Auto-Zuordnung abgeschlossen!\n\n` +
          `📊 Ergebnis:\n` +
          `• ${stats.matched} von ${stats.totalZahlungen} Zahlungen zugeordnet\n\n` +
          `📝 Details:\n` +
          `• ${stats.byMethod.auNummer} über AU-Nummer\n` +
          `• ${stats.byMethod.reNummer} über RE-Nummer\n` +
          `• ${stats.byMethod.betragDatum} über Betrag+Datum\n` +
          `• ${stats.byMethod.kategorie} über Kategorie (Gebühren)\n\n` +
          `👉 ${stats.totalZahlungen - stats.matched} Zahlungen benötigen manuelle Zuordnung`
        )
        
        // Reload data
        await loadData(true)
      } else {
        alert('❌ Fehler beim Auto-Matching:\n' + data.error)
      }
      
    } catch (error) {
      console.error('Fehler beim Auto-Matching:', error)
      alert('❌ Fehler beim Auto-Matching:\n' + error.message)
    }
    
    setRefreshing(false)
  }
  
  async function refreshData(type = 'all') {
    setRefreshing(true)
    setShowRefreshMenu(false)
    
    try {
      const [from, to] = selectedPeriod.split('_')
      
      if (type === 'all' || type === 'zahlungen') {
        console.log('🔄 Aktualisiere Zahlungen von allen Quellen...')
        
        // PayPal (max 31 Tage, daher aufteilen wenn nötig)
        const fromDate = new Date(from)
        const toDate = new Date(to)
        const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24))
        
        if (daysDiff <= 31) {
          await fetch(`/api/fibu/zahlungen/paypal?from=${from}&to=${to}&refresh=true`)
        } else {
          // Monat für Monat
          let currentDate = new Date(fromDate)
          while (currentDate <= toDate) {
            const monthStart = currentDate.toISOString().split('T')[0]
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
            const effectiveEnd = monthEnd < to ? monthEnd : to
            
            await fetch(`/api/fibu/zahlungen/paypal?from=${monthStart}&to=${effectiveEnd}&refresh=true`)
            
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
          }
        }
        
        // Commerzbank & Postbank
        await fetch(`/api/fibu/zahlungen/banks?bank=all&from=${from}&to=${to}&refresh=true`)
        
        // Mollie
        await fetch(`/api/fibu/zahlungen/mollie?from=${from}&to=${to}&refresh=true`)
        
        // Amazon Settlements
        await fetch(`/api/fibu/zahlungen/amazon-settlements?from=${from}&to=${to}&refresh=true`)
        
        console.log('✅ Zahlungen aktualisiert')
      }
      
      if (type === 'all' || type === 'vk') {
        console.log('🔄 Aktualisiere VK-Rechnungen...')
        // VK-Rechnungen werden aus JTL geholt, kein spezifisches Refresh nötig
        console.log('✅ VK-Rechnungen aktualisiert')
      }
      
      // Reload data
      await loadData(true)
      
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error)
    }
    
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade FIBU-Daten...</p>
        </div>
      </div>
    )
  }

  // Only show error if we're on overview tab and data failed to load
  if (activeTab === 'overview' && (!data || !data.ok)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600 mb-4">Die FIBU-Daten konnten nicht geladen werden.</p>
          <button 
            onClick={loadData}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  // Only destructure data if it exists (for overview tab)
  const summary = data?.summary || null
  const details = data?.details || null
  const issues = summary?.issues || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900">FIBU Dashboard</h1>
              <div className="flex items-center gap-4">
                <DateRangeNavigator 
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                />
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                >
                  📥 Export
                </button>
                
                {/* Refresh Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowRefreshMenu(!showRefreshMenu)}
                    disabled={refreshing}
                    className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Daten aktualisieren"
                  >
                    {refreshing ? '⏳' : '🔄'} Aktualisieren
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRefreshMenu && !refreshing && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2 min-w-[220px]">
                      <button
                        onClick={() => refreshData('all')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                      >
                        🔄 Alles aktualisieren
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={runAutoMatch}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 text-green-700 font-medium"
                      >
                        🤖 Auto-Zuordnung starten
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => refreshData('zahlungen')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                      >
                        💳 Zahlungen
                      </button>
                      <button
                        onClick={() => refreshData('vk')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                      >
                        📄 VK-Rechnungen
                      </button>
                      <div className="border-t border-gray-200 my-2"></div>
                      <button
                        onClick={() => {
                          setShowRefreshMenu(false)
                          loadData(true)
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500"
                      >
                        🗄️ Nur aus Cache neu laden
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 italic">
              {quote}
            </p>
          </div>

          {/* Tabs - Neue 6-Tab-Struktur */}
          <div className="flex gap-6 border-t border-gray-100">
            <button
              onClick={() => setActiveTab('uebersicht')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'uebersicht'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Übersicht
            </button>
            <button
              onClick={() => setActiveTab('ek-belege')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition relative ${
                activeTab === 'ek-belege'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📥 EK-Belege
              {issues?.ekOhneKreditor > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {issues.ekOhneKreditor}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vk-belege')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'vk-belege'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📤 VK-Belege
            </button>
            <button
              onClick={() => setActiveTab('umsaetze')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'umsaetze'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💰 Umsätze
            </button>
            <button
              onClick={() => setActiveTab('einstellungen')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'einstellungen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚙️ Einstellungen
            </button>
            <button
              onClick={() => setActiveTab('zuordnung')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition relative ${
                activeTab === 'zuordnung'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔗 Zuordnung
              {(issues?.zahlungenOhneZuordnung > 0 || issues?.ekOhneKreditor > 0) && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {(issues?.zahlungenOhneZuordnung || 0) + (issues?.ekOhneKreditor || 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 1. Übersicht */}
        {activeTab === 'uebersicht' && (
          <FibuMonatsUebersicht selectedPeriod={selectedPeriod} summaryData={summary} />
        )}

        {/* 2. EK-Belege (EK-Rechnungen + Kreditor-Zuordnung zusammengeführt) */}
        {activeTab === 'ek-belege' && (
          <div>
            <EKRechnungenView zeitraum={selectedPeriod} initialFilter={tabFilters['ek-belege']} />
          </div>
        )}

        {/* 3. VK-Belege */}
        {activeTab === 'vk-belege' && (
          <VKRechnungenView zeitraum={selectedPeriod} initialFilter={tabFilters['vk-belege']} />
        )}

        {/* 4. Umsätze (ehemals Zahlungen) */}
        {activeTab === 'umsaetze' && (
          <ZahlungenView zeitraum={selectedPeriod} initialFilter={tabFilters['umsaetze']} />
        )}

        {/* 5. Einstellungen (Bank-Import, Kontenplan, Fuzzy-Matching) */}
        {activeTab === 'einstellungen' && (
          <div>
            {/* Sub-Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setEinstellungenSubTab('bank-import')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'bank-import'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🏦 Bank-Import
              </button>
              <button
                onClick={() => setEinstellungenSubTab('kontenplan')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'kontenplan'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Kontenplan
              </button>
              <button
                onClick={() => setEinstellungenSubTab('auto-zuordnung')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'auto-zuordnung'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔍 Auto-Zuordnung
              </button>
              <button
                onClick={() => setEinstellungenSubTab('kreditoren')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'kreditoren'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🏢 Kreditoren
              </button>
              <button
                onClick={() => setEinstellungenSubTab('export')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'export'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📤 10it Export
              </button>
            </div>

            {/* Sub-Tab Content */}
            {einstellungenSubTab === 'bank-import' && <BankImport />}
            {einstellungenSubTab === 'kontenplan' && <KontenplanView />}
            {einstellungenSubTab === 'auto-zuordnung' && <FuzzyMatchingView zeitraum={selectedPeriod} />}
            {einstellungenSubTab === 'kreditoren' && <KreditorenManagement />}
            {einstellungenSubTab === 'export' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">10it / DATEV Export</h3>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  📥 Export starten
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. Zuordnung (Unzugeordnete Items auf einen Blick) */}
        {activeTab === 'zuordnung' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">🔗 Zuordnung - Unzugeordnete Items</h2>
            <p className="text-gray-600 mb-4">
              Hier sehen Sie alle Transaktionen und Belege, die noch nicht zugeordnet sind, 
              inklusive automatischer Vorschläge vom Dual-Matcher.
            </p>
            
            {/* Verwende bestehende Kreditor-Zuordnung Component */}
            <KreditorZuordnung zeitraum={selectedPeriod} />
            
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>💡 Tipp:</strong> Nutzen Sie die Auto-Zuordnung in den Einstellungen, 
                um automatisch passende Rechnungen und Konten für Zahlungen zu finden.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog 
          onClose={() => setShowExportDialog(false)}
          selectedPeriod={selectedPeriod}
        />
      )}
    </div>
  )
}
