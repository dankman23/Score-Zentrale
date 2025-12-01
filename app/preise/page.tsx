'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KlingsporKonfigurator from '@/components/KlingsporKonfigurator'

export default function PreisePage() {
  const [activeTab, setActiveTab] = useState('konfigurator')

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">💰 Preise</h1>
        <p className="text-muted-foreground">
          Preisberechnung und Konfigurator für Schleifbänder
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="preisberechnung">Preisberechnung</TabsTrigger>
          <TabsTrigger value="konfigurator">Konfigurator</TabsTrigger>
        </TabsList>

        <TabsContent value="preisberechnung" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Preisberechnung</CardTitle>
              <CardDescription>
                Bestehende Preisformeln (Alte PB, g2, Staffelgrenzen)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-4">🚧 Bestehende Preisberechnung</p>
                <p className="text-sm">
                  Die bisherigen Preisformeln (Alte PB, Neue ab 2025-11, Staffelgrenzen)
                  <br />
                  bleiben hier unverändert und können bei Bedarf integriert werden.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="konfigurator" className="mt-6">
          <KlingsporKonfigurator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
