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
import DateRangePicker from './DateRangePicker'

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
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('2025-10-01_2025-11-30')
  const [activeTab, setActiveTab] = useState('overview')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [tabFilters, setTabFilters] = useState({}) // Store filters per tab
  const [quote] = useState(() => getRandomQuote())

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

  useEffect(() => {
    loadData()
  }, [selectedPeriod])

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

  if (!data || !data.ok) {
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

  const { summary, details } = data
  const issues = summary.issues

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900">FIBU Dashboard</h1>
              <div className="flex items-center gap-4">
                <DateRangePicker 
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                />
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                >
                  📥 Export
                </button>
                <button
                  onClick={() => loadData(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  title="Daten neu aus Datenbank laden"
                >
                  🔄 Aktualisieren
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 italic">
              {quote}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-t border-gray-100">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Übersicht
            </button>
            <button
              onClick={() => setActiveTab('ek')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'ek'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📥 EK-Rechnungen
            </button>
            <button
              onClick={() => setActiveTab('zuordnung')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition relative ${
                activeTab === 'zuordnung'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔗 Kreditor-Zuordnung
              {issues.ekOhneKreditor > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {issues.ekOhneKreditor}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vk')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'vk'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📤 VK-Rechnungen
            </button>
            <button
              onClick={() => setActiveTab('zahlungen')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'zahlungen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💳 Zahlungen
            </button>
            <button
              onClick={() => setActiveTab('bank-import')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'bank-import'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏦 Bank-Import
            </button>
            <button
              onClick={() => setActiveTab('kontenplan')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'kontenplan'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 Kontenplan + Einstellungen
            </button>
            <button
              onClick={() => setActiveTab('fuzzy-matching')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'fuzzy-matching'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔍 Auto-Zuordnung
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'overview' && (
          <FibuMonatsUebersicht selectedPeriod={selectedPeriod} summaryData={summary} />
        )}

        {activeTab === 'ek' && (
          <EKRechnungenView zeitraum={selectedPeriod} initialFilter={tabFilters['ek']} />
        )}

        {activeTab === 'zuordnung' && (
          <KreditorZuordnung zeitraum={selectedPeriod} />
        )}

        {activeTab === 'vk' && (
          <VKRechnungenView zeitraum={selectedPeriod} initialFilter={tabFilters['vk']} />
        )}

        {activeTab === 'zahlungen' && (
          <ZahlungenView zeitraum={selectedPeriod} initialFilter={tabFilters['zahlungen']} />
        )}

        {activeTab === 'bank-import' && (
          <BankImport />
        )}

        {activeTab === 'kontenplan' && (
          <div className="space-y-6">
            <KreditorenManagement />
            <KontenplanView />
            <ZahlungsEinstellungen />
          </div>
        )}

        {activeTab === 'fuzzy-matching' && (
          <FuzzyMatchingView zeitraum={selectedPeriod} />
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
