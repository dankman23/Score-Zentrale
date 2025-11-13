'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function EKRechnungenManager() {
  const [pdfs, setPdfs] = useState([])
  const [ekRechnungen, setEkRechnungen] = useState([])
  const [kreditoren, setKreditoren] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('all') // all, pending, processed, matched, unmatched

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Lade PDFs aus Email-Inbox
      const pdfRes = await fetch('/api/fibu/email-inbox?limit=500')
      const pdfData = await pdfRes.json()
      
      // Lade bereits verarbeitete EK-Rechnungen
      const ekRes = await fetch('/api/fibu/rechnungen/ek?from=2025-10-01&to=2025-11-13&limit=500')
      const ekData = await ekRes.json()
      
      // Lade Kreditoren für Dropdown
      const kredRes = await fetch('/api/fibu/kreditoren?limit=500')
      const kredData = await kredRes.json()
      
      console.log('Loaded data:', { 
        pdfs: pdfData.emails?.length || 0, 
        ek: ekData.rechnungen?.length || 0,
        kreditoren: kredData.kreditoren?.length || 0 
      })
      
      setPdfs(pdfData.emails || [])
      setEkRechnungen(ekData.rechnungen || [])
      setKreditoren(kredData.kreditoren || [])
      
      // Berechne Statistiken
      calculateStats(pdfData.emails || [], ekData.rechnungen || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
    setLoading(false)
  }

  function calculateStats(pdfs, rechnungen) {
    const totalPDFs = pdfs.length
    const pending = pdfs.filter(p => p.status === 'pending').length
    const processed = pdfs.filter(p => p.status === 'processed').length
    
    // Versuche Auto-Matching zu erkennen
    let matched = 0
    let unmatched = 0
    
    pdfs.forEach(pdf => {
      const filename = pdf.filename.toLowerCase()
      if (
        filename.match(/^(70\d{3})/) ||
        filename.includes('klingspor') ||
        filename.includes('ggeberg') ||
        filename.includes('rüggeberg') ||
        filename.includes('starcke') ||
        filename.includes('vsm')
      ) {
        matched++
      } else {
        unmatched++
      }
    })
    
    setStats({
      totalPDFs,
      pending,
      processed,
      matched,
      unmatched,
      totalRechnungen: rechnungen.length
    })
  }

  function getKreditorFromFilename(filename) {
    const lower = filename.toLowerCase()
    if (filename.match(/^(70\d{3})/)) return filename.substring(0, 5)
    if (lower.includes('klingspor')) return '70004'
    if (lower.includes('ggeberg') || lower.includes('rüggeberg')) return '70005'
    if (lower.includes('starcke')) return '70006'
    if (lower.includes('vsm')) return '70009'
    return null
  }

  const filteredPdfs = pdfs.filter(pdf => {
    if (filter === 'pending') return pdf.status === 'pending'
    if (filter === 'processed') return pdf.status === 'processed'
    if (filter === 'matched') return getKreditorFromFilename(pdf.filename) !== null
    if (filter === 'unmatched') return getKreditorFromFilename(pdf.filename) === null
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">EK-Rechnungen Manager</h1>
        <Button onClick={loadData} disabled={loading}>
          {loading ? 'Laden...' : '🔄 Aktualisieren'}
        </Button>
      </div>

      {/* Statistiken */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total PDFs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalPDFs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Verarbeitet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.processed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Auto-Match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.matched}</div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Manuelle Zuordnung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.unmatched}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                EK-Rechnungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalRechnungen}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Alle ({pdfs.length})
            </Button>
            <Button 
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
            >
              Pending ({pdfs.filter(p => p.status === 'pending').length})
            </Button>
            <Button 
              variant={filter === 'processed' ? 'default' : 'outline'}
              onClick={() => setFilter('processed')}
            >
              Verarbeitet ({pdfs.filter(p => p.status === 'processed').length})
            </Button>
            <Button 
              variant={filter === 'unmatched' ? 'default' : 'outline'}
              onClick={() => setFilter('unmatched')}
              className="border-orange-500"
            >
              🔴 Manuelle Zuordnung ({pdfs.filter(p => getKreditorFromFilename(p.filename) === null).length})
            </Button>
            <Button 
              variant={filter === 'matched' ? 'default' : 'outline'}
              onClick={() => setFilter('matched')}
            >
              ✅ Auto-Match ({pdfs.filter(p => getKreditorFromFilename(p.filename) !== null).length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PDF Liste */}
      <Card>
        <CardHeader>
          <CardTitle>
            PDFs ({filteredPdfs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredPdfs.map((pdf, index) => {
              const kreditorNr = getKreditorFromFilename(pdf.filename)
              const kreditor = kreditorNr ? kreditoren.find(k => k.kreditorenNummer === kreditorNr) : null
              
              return (
                <div 
                  key={pdf._id || index}
                  className={`p-4 border rounded-lg ${
                    pdf.status === 'processed' 
                      ? 'bg-green-50 border-green-200' 
                      : kreditor 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{pdf.filename}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Von: {pdf.emailFrom} | {new Date(pdf.emailDate).toLocaleDateString('de-DE')}
                      </div>
                      {kreditor && (
                        <div className="mt-2">
                          <Badge variant="outline" className="bg-blue-100">
                            ✅ Auto-Match: {kreditor.name} ({kreditor.kreditorenNummer})
                          </Badge>
                        </div>
                      )}
                      {!kreditor && pdf.status === 'pending' && (
                        <div className="mt-2">
                          <Badge variant="outline" className="bg-orange-100">
                            🔴 Manuelle Zuordnung erforderlich
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={pdf.status === 'processed' ? 'default' : 'secondary'}>
                        {pdf.status === 'processed' ? 'Verarbeitet' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
