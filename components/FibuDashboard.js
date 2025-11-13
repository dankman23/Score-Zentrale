'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { 
  FileText, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Calendar,
  Users,
  RefreshCw
} from 'lucide-react'

export default function FibuDashboard() {
  const [stats, setStats] = useState(null)
  const [rechnungen, setRechnungen] = useState([])
  const [topLieferanten, setTopLieferanten] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoMatchResult, setAutoMatchResult] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    try {
      // Lade EK-Rechnungen
      const ekRes = await fetch('/api/fibu/rechnungen/ek?from=2025-10-01&to=2025-11-13&limit=500')
      const ekData = await ekRes.json()
      const rechnungen = ekData.rechnungen || []
      
      setRechnungen(rechnungen)
      
      // Berechne Statistiken
      const withBetrag = rechnungen.filter(r => r.gesamtBetrag > 0)
      const withKreditor = rechnungen.filter(r => r.kreditorKonto)
      const needsReview = rechnungen.filter(r => r.needsManualReview)
      
      const totalAmount = withBetrag.reduce((sum, r) => sum + r.gesamtBetrag, 0)
      
      // Parsing-Methoden
      const pythonParsed = rechnungen.filter(r => r.parsing?.method?.includes('python'))
      const geminiParsed = rechnungen.filter(r => r.parsing?.method?.includes('gemini'))
      
      // Top Lieferanten
      const lieferantenMap = {}
      withBetrag.forEach(r => {
        const name = r.lieferantName || 'Unbekannt'
        if (!lieferantenMap[name]) {
          lieferantenMap[name] = { count: 0, amount: 0 }
        }
        lieferantenMap[name].count++
        lieferantenMap[name].amount += r.gesamtBetrag
      })
      
      const topLief = Object.entries(lieferantenMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
      
      setTopLieferanten(topLief)
      
      setStats({
        totalRechnungen: rechnungen.length,
        withBetrag: withBetrag.length,
        withBetragPercent: ((withBetrag.length / rechnungen.length) * 100).toFixed(1),
        withKreditor: withKreditor.length,
        withKreditorPercent: ((withKreditor.length / rechnungen.length) * 100).toFixed(1),
        needsReview: needsReview.length,
        totalAmount: totalAmount.toFixed(2),
        pythonParsed: pythonParsed.length,
        geminiParsed: geminiParsed.length,
        avgBetrag: (totalAmount / withBetrag.length).toFixed(2)
      })
      
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }

  async function runAutoMatch() {
    setLoading(true)
    try {
      const res = await fetch('/api/fibu/auto-match-ek-zahlungen', { method: 'POST' })
      const data = await res.json()
      setAutoMatchResult(data)
      
      // Reload nach matching
      setTimeout(() => loadDashboardData(), 1000)
    } catch (error) {
      console.error('Auto-Match Fehler:', error)
    }
    setLoading(false)
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="animate-spin h-8 w-8 text-primary" />
        <span className="ml-2">Lade Daten...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FIBU Dashboard</h1>
          <p className="text-muted-foreground">Übersicht aller EK-Rechnungen und Automatisierung</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Rechnungen</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRechnungen || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.withBetrag || 0} mit Betrag ({stats?.withBetragPercent}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gesamt-Betrag</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAmount || 0}€</div>
            <p className="text-xs text-muted-foreground">
              Ø {stats?.avgBetrag || 0}€ pro Rechnung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mit Kreditor</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.withKreditor || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.withKreditorPercent}% zugeordnet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Benötigt Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.needsReview || 0}</div>
            <p className="text-xs text-muted-foreground">
              Manuelle Zuordnung nötig
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Parsing-Methoden & Auto-Matching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Parsing-Methoden</CardTitle>
            <CardDescription>Wie wurden die Rechnungen verarbeitet?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Python-Parser</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{stats?.pythonParsed || 0}</span>
                  <Badge variant="secondary">
                    {stats?.totalRechnungen > 0 
                      ? ((stats?.pythonParsed / stats?.totalRechnungen) * 100).toFixed(0)
                      : 0}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Emergent Gemini</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{stats?.geminiParsed || 0}</span>
                  <Badge variant="secondary">
                    {stats?.totalRechnungen > 0 
                      ? ((stats?.geminiParsed / stats?.totalRechnungen) * 100).toFixed(0)
                      : 0}%
                  </Badge>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Hybrid-Ansatz: Python für bekannte Lieferanten, Gemini für neue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-Matching</CardTitle>
            <CardDescription>Automatische Zahlung-zu-Rechnung Zuordnung</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {autoMatchResult ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Match-Rate</span>
                      <Badge variant="default" className="text-lg">
                        {autoMatchResult.matchRate}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gefundene Matches</span>
                      <span className="font-bold">{autoMatchResult.matches}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Analysierte Zahlungen</span>
                      <span>{autoMatchResult.analyzed?.negativeZahlungen}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Analysierte Rechnungen</span>
                      <span>{autoMatchResult.analyzed?.ekRechnungen}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Klicken Sie auf "Auto-Match starten", um Zahlungen automatisch zuzuordnen
                </div>
              )}
              
              <Button 
                onClick={runAutoMatch} 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Läuft...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Auto-Match starten
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Lieferanten */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Lieferanten</CardTitle>
          <CardDescription>Nach Rechnungsbetrag sortiert</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topLieferanten.map((lieferant, index) => (
              <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{lieferant.name}</div>
                    <div className="text-xs text-muted-foreground">{lieferant.count} Rechnungen</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{lieferant.amount.toFixed(2)}€</div>
                  <div className="text-xs text-muted-foreground">
                    Ø {(lieferant.amount / lieferant.count).toFixed(2)}€
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Letzte Rechnungen */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte 10 Rechnungen</CardTitle>
          <CardDescription>Kürzlich verarbeitete EK-Rechnungen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rechnungen.slice(0, 10).map((rechnung, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <div className="font-medium">{rechnung.lieferantName}</div>
                  <div className="text-xs text-muted-foreground">
                    RgNr: {rechnung.rechnungsNummer} • {new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold">{rechnung.gesamtBetrag?.toFixed(2) || 0}€</div>
                    {rechnung.kreditorKonto && (
                      <Badge variant="secondary" className="text-xs">{rechnung.kreditorKonto}</Badge>
                    )}
                  </div>
                  {rechnung.parsing?.method && (
                    <Badge variant={rechnung.parsing.method.includes('python') ? 'default' : 'outline'}>
                      {rechnung.parsing.method.includes('python') ? 'Python' : 'Gemini'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
