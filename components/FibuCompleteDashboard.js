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
import ZahlungenMasterDetail from './ZahlungenMasterDetail'
import EKBelegeMasterDetail from './EKBelegeMasterDetail'
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
  const [loading, setLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return '2025-10-01_2025-10-31'
  })
  const [activeTab, setActiveTab] = useState('zahlungen')
  const [einstellungenSubTab, setEinstellungenSubTab] = useState('bank-import')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [tabFilters, setTabFilters] = useState({})
  const [quote, setQuote] = useState('')
  const [showRefreshMenu, setShowRefreshMenu] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // Set quote after mount to avoid hydration mismatch
  useEffect(() => {
    setQuote(getRandomQuote())
  }, [])

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
    
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Lazy Loading - lade nur Overview-Daten wenn Overview-Tab aktiv ist
  useEffect(() => {
    if (activeTab === 'overview') {
      loadData()
    }
  }, [activeTab, selectedPeriod])

  const loadData = async (forceRefresh = false) => {
    if (activeTab !== 'overview') return
    
    setLoading(true)
    try {
      const [from, to] = selectedPeriod.split('_')
      const url = `/api/fibu/dashboard?from=${from}&to=${to}${forceRefresh ? '&refresh=true' : ''}`
      const response = await fetch(url)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
      setData({ ok: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const runAutoMatch = async () => {
    if (!confirm('Auto-Zuordnung starten? Dies kann einige Minuten dauern.')) return
    
    setRefreshing(true)
    setShowRefreshMenu(false)
    
    try {
      const [from, to] = selectedPeriod.split('_')
      const response = await fetch(`/api/fibu/auto-match?from=${from}&to=${to}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.ok) {
        alert(`✓ Auto-Zuordnung abgeschlossen!\n\nGematcht: ${data.matched || 0} Zahlungen`)
        await loadData(true)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      alert('Fehler beim Auto-Match: ' + error.message)
    }
    
    setRefreshing(false)
  }

  const refreshData = async (type) => {
    setRefreshing(true)
    setShowRefreshMenu(false)
    
    try {
      const [from, to] = selectedPeriod.split('_')
      
      if (type === 'all' || type === 'zahlungen') {
        console.log('🔄 Aktualisiere Zahlungen...')
        
        // PayPal
        const paypalRes = await fetch(`/api/fibu/zahlungen/paypal?from=${from}&to=${to}&refresh=true`)
        if (paypalRes.ok) {
          const paypalData = await paypalRes.json()
          console.log(`✓ PayPal: ${paypalData.count || 0} Transaktionen`)
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
        console.log('✅ VK-Rechnungen aktualisiert')
      }
      
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

  const summary = data?.summary || null
  const details = data?.details || null
  const issues = summary?.issues || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - VOLLE BREITE */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 lg:px-8">
          <div className="py-3">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-gray-900">FIBU Dashboard</h1>
              <div className="flex items-center gap-3">
                <DateRangeNavigator 
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                />
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-xs font-medium flex items-center gap-1.5"
                >
                  📥 Export
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => setShowRefreshMenu(!showRefreshMenu)}
                    disabled={refreshing}
                    className={`bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 text-xs font-medium flex items-center gap-1.5 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {refreshing ? '⏳' : '🔄'} Aktualisieren
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRefreshMenu && !refreshing && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1.5 min-w-[200px]">
                      <button
                        onClick={() => refreshData('all')}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                      >
                        🔄 Alles aktualisieren
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={runAutoMatch}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-50 text-green-700 font-medium"
                      >
                        🤖 Auto-Zuordnung starten
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => refreshData('zahlungen')}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                      >
                        💳 Zahlungen
                      </button>
                      <button
                        onClick={() => refreshData('vk')}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                      >
                        📄 VK-Rechnungen
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          setShowRefreshMenu(false)
                          loadData(true)
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-500"
                      >
                        🗄️ Nur aus Cache neu laden
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 italic">
              {quote}
            </p>
          </div>

          {/* Tabs - Kompakt */}
          <div className="flex gap-4 border-t border-gray-100">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Übersicht
            </button>
            <button
              onClick={() => setActiveTab('ek-belege')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition relative ${
                activeTab === 'ek-belege'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📥 EK-Belege
              {issues?.ekOhneKreditor > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {issues.ekOhneKreditor}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vk-belege')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'vk-belege'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📤 VK-Belege
            </button>
            <button
              onClick={() => setActiveTab('zahlungen')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'zahlungen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💰 Umsätze
            </button>
            <button
              onClick={() => setActiveTab('zuordnung')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition relative ${
                activeTab === 'zuordnung'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔗 Zuordnung
              {(issues?.zahlungenOhneZuordnung > 0 || issues?.ekOhneKreditor > 0) && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {(issues?.zahlungenOhneZuordnung || 0) + (issues?.ekOhneKreditor || 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('einstellungen')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'einstellungen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚙️ Einstellungen
            </button>
          </div>
        </div>
      </div>

      {/* Content - VOLLE BREITE */}
      <div className="px-6 lg:px-8 py-6">
        
        {activeTab === 'overview' && (
          <FibuMonatsUebersicht selectedPeriod={selectedPeriod} summaryData={summary} />
        )}

        {activeTab === 'ek-belege' && (
          <EKBelegeMasterDetail zeitraum={selectedPeriod} />
        )}

        {activeTab === 'vk-belege' && (
          <VKRechnungenView zeitraum={selectedPeriod} initialFilter={tabFilters['vk']} />
        )}

        {activeTab === 'zahlungen' && (
          <ZahlungenMasterDetail zeitraum={selectedPeriod} />
        )}

        {activeTab === 'zuordnung' && (
          <div>
            <KreditorZuordnung zeitraum={selectedPeriod} />
            <div className="mt-6">
              <FuzzyMatchingView zeitraum={selectedPeriod} />
            </div>
          </div>
        )}

        {activeTab === 'einstellungen' && (
          <div>
            <div className="mb-4 flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setEinstellungenSubTab('bank-import')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'bank-import'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🏦 Bank-Import
              </button>
              <button
                onClick={() => setEinstellungenSubTab('kontenplan')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'kontenplan'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Kontenplan
              </button>
              <button
                onClick={() => setEinstellungenSubTab('kreditoren')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'kreditoren'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🏢 Kreditoren
              </button>
              <button
                onClick={() => setEinstellungenSubTab('zahlungen')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  einstellungenSubTab === 'zahlungen'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                💳 Zahlungen
              </button>
            </div>

            {einstellungenSubTab === 'bank-import' && <BankImport />}
            {einstellungenSubTab === 'kontenplan' && <KontenplanView />}
            {einstellungenSubTab === 'kreditoren' && <KreditorenManagement />}
            {einstellungenSubTab === 'zahlungen' && <ZahlungsEinstellungen />}
          </div>
        )}
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog 
          zeitraum={selectedPeriod}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  )
}
