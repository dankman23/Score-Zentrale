'use client'

import KlingsporKonfigurator from '@/components/KlingsporKonfigurator'

export default function KonfiguratorPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🔧 Klingspor Konfigurator</h1>
        <p className="text-muted-foreground">
          Konfigurieren Sie Ihr Klingspor-Schleifband und erhalten Sie automatisch Preis und MBM
        </p>
      </div>
      
      <KlingsporKonfigurator />
    </div>
  )
}
