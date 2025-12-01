'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface KonfiguratorResult {
  manufacturer: string
  type: string
  grit: string | number
  widthMm: number
  lengthMm: number
  backingType: string
  listPrice: number
  stueckEk: number
  minOrderQty: number
  ekGesamtMbm: number
  vkStueckNetto: number
  vkStueckBrutto: number
  vkMbmNetto: number
  vkMbmBrutto: number
  staffelPreise: any[]
  debug?: any
}

export default function KlingsporKonfigurator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<KonfiguratorResult | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Formular-State
  const [manufacturer] = useState('Klingspor')
  const [type, setType] = useState('')
  const [grit, setGrit] = useState('')
  const [widthMm, setWidthMm] = useState<number>(100)
  const [lengthMm, setLengthMm] = useState<number>(1000)

  // Verfügbare Typen & Körnungen
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [availableGrits, setAvailableGrits] = useState<number[]>([])

  // Lade verfügbare Typen
  useEffect(() => {
    fetch('/data/klingspor/valid_entries.json')
      .then(res => res.json())
      .then(data => {
        const uniqueTypes = new Set(data.map((e: any) => e['SaU Type']))
        const types = Array.from(uniqueTypes).sort()
        setAvailableTypes(types as string[])
      })
      .catch(console.error)
  }, [])

  // Lade Körnungen für Typ
  useEffect(() => {
    if (!type) {
      setAvailableGrits([])
      setGrit('')
      return
    }

    fetch('/data/klingspor/available_grits.json')
      .then(res => res.json())
      .then(data => {
        const grits = data
          .filter((g: any) => g['SaU Type'] === type)
          .map((g: any) => g.Korn)
          .filter((v: number, i: number, a: number[]) => a.indexOf(v) === i)
          .sort((a: number, b: number) => a - b)
        setAvailableGrits(grits)
        if (grits.length > 0) setGrit(grits[0].toString())
      })
      .catch(console.error)
  }, [type])

  const handleBerechnen = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/pricing/konfigurator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer,
          type,
          grit: parseInt(grit),
          widthMm,
          lengthMm
        })
      })

      const data = await response.json()

      if (!data.ok) {
        setError(data.error || 'Berechnung fehlgeschlagen')
        return
      }

      setResult(data.result)
    } catch (err: any) {
      setError(err.message || 'Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Eingabe-Formular */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Klingspor-Konfiguration</CardTitle>
          <CardDescription>
            Konfigurieren Sie Ihr Schleifband und erhalten Sie Preis und MBM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Hersteller */}
            <div className="space-y-2">
              <Label className="text-white">Hersteller</Label>
              <Input value="Klingspor" disabled className="bg-muted" />
            </div>

            {/* Typ */}
            <div className="space-y-2">
              <Label className="text-white">Typ *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Typ wählen..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Körnung */}
            <div className="space-y-2">
              <Label className="text-white">Körnung *</Label>
              <Select value={grit} onValueChange={setGrit} disabled={!type}>
                <SelectTrigger>
                  <SelectValue placeholder="Körnung wählen..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableGrits.map(g => (
                    <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breite */}
            <div className="space-y-2">
              <Label className="text-white">Breite (mm) *</Label>
              <Input
                type="number"
                min={3}
                max={2000}
                value={widthMm}
                onChange={e => setWidthMm(parseInt(e.target.value) || 0)}
              />
            </div>

            {/* Länge */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-white">Länge (mm) *</Label>
              <Input
                type="number"
                min={100}
                max={10000}
                value={lengthMm}
                onChange={e => setLengthMm(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleBerechnen}
              disabled={!type || !grit || loading}
              className="w-full md:w-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Berechnen
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Ergebnis */}
      {result && (
        <>
          {/* Kompakte Ergebnisanzeige */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">📊 Klingspor-Basisdaten</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 md:grid-cols-3 mb-3">
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">Stück-EK (Score)</div>
                  <div className="text-lg font-bold text-white">{formatEuro(result.stueckEk)}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">MBM (Stück)</div>
                  <div className="text-lg font-bold text-white">{result.minOrderQty}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">Gesamt-EK für MBM</div>
                  <div className="text-lg font-bold text-white">{formatEuro(result.ekGesamtMbm)}</div>
                </div>
              </div>

              <div className="text-xs text-gray-400 border-t pt-2">
                <p className="text-gray-300"><strong>Typ:</strong> {result.type} | <strong>Körnung:</strong> {result.grit} | <strong>Unterlagenart:</strong> {result.backingType}</p>
                <p className="text-gray-300"><strong>Maße:</strong> {result.widthMm} mm × {result.lengthMm} mm | <strong>Listenpreis:</strong> {formatEuro(result.listPrice)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Score-VK kompakt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">💰 Score-Verkaufspreise</CardTitle>
              <CardDescription className="text-xs">
                Berechnet mit "Alte PB - Alle Konfektionen"
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 md:grid-cols-4 mb-3">
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">VK/Stück netto</div>
                  <div className="text-base font-bold text-blue-400">{formatEuro(result.vkStueckNetto)}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">VK/Stück brutto</div>
                  <div className="text-base font-bold text-green-400">{formatEuro(result.vkStueckBrutto)}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">VK MBM netto</div>
                  <div className="text-base font-bold text-blue-400">{formatEuro(result.vkMbmNetto)}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-400">VK MBM brutto</div>
                  <div className="text-base font-bold text-green-400">{formatEuro(result.vkMbmBrutto)}</div>
                </div>
              </div>

              {/* Staffelpreise */}
              <div className="border-t pt-3">
                <h3 className="font-semibold mb-2 text-white text-sm">Staffelpreise (Shop) - VE={result.minOrderQty} Stück</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 text-white font-semibold">VE</th>
                        <th className="text-right py-1 text-white font-semibold bg-blue-900/30">Gesamt-EK</th>
                        <th className="text-right py-1 text-white font-semibold">VK/Stück netto</th>
                        <th className="text-right py-1 text-white font-semibold">VK Shop netto</th>
                        <th className="text-right py-1 text-white font-semibold">VK Shop brutto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.staffelPreise.map((staffel: any) => (
                        <tr key={staffel.ve} className="border-b border-gray-700">
                          <td className="py-1 text-white">{staffel.ve}</td>
                          <td className="text-right text-white font-bold bg-blue-900/20">{formatEuro(result.ekGesamtMbm * staffel.ve)}</td>
                          <td className="text-right text-white">{formatEuro(staffel.vk_stueck_netto)}</td>
                          <td className="text-right text-white">{formatEuro(staffel.vk_shop_netto)}</td>
                          <td className="text-right font-semibold text-green-400">{formatEuro(staffel.vk_shop_brutto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug */}
          {result.debug && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-white">🔍 Debug-Informationen</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebug(!showDebug)}
                  >
                    {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {showDebug && (
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                    {JSON.stringify(result.debug, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
