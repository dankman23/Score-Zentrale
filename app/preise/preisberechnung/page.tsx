'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PreisberechnungPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">💰 Preisberechnung</h1>
        <p className="text-muted-foreground">
          Bestehende Preisformeln für Ihre Produkte
        </p>
      </div>

      <div className="grid gap-6">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>🚧 Preisberechnung Integration</CardTitle>
            <CardDescription>
              Die bestehende Preisberechnung von der Hauptseite
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Die vollständige Preisberechnung mit allen Formeln (Alte PB, Neue ab 2025-11, Staffelgrenzen) 
                ist derzeit noch auf der <a href="/#preise" className="text-blue-500 underline">Hauptseite unter #preise</a> verfügbar.
              </p>
              
              <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 dark:bg-blue-950 rounded">
                <p className="font-semibold mb-2">Verfügbare Funktionen auf der Hauptseite:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Alte PB - Alle Konfektionen</li>
                  <li>Neue ab 2025-11 (g2)</li>
                  <li>Staffelgrenzen-Verwaltung</li>
                  <li>Preisvergleich mit Wettbewerbern</li>
                  <li>Historie & Auswertungen</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <Button asChild>
                  <a href="/#preise">
                    <i className="bi bi-arrow-left mr-2"></i>
                    Zur Hauptseite (Preisberechnung)
                  </a>
                </Button>
                
                <Button variant="outline" asChild>
                  <a href="/preise/konfigurator">
                    <i className="bi bi-gear-fill mr-2"></i>
                    Zum Klingspor Konfigurator
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Alte PB</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bewährte Preisformel für alle Konfektionen mit Plattform- und Shop-Preisen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🆕 Neue ab 2025-11</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Neue Preisformel (g2) mit optimierten Parametern und Gewinnreglern
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📈 Staffelgrenzen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Verwaltung von Mengenstaffeln und Preisschwellen
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
