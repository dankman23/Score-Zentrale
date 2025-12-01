'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PreisberechnungPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to main page with #preise hash
    window.location.href = '/#preise'
  }, [])
  
  return (
    <div className="container mx-auto p-6">
      <div className="text-center py-12">
        <div className="animate-pulse">
          <p className="text-lg text-muted-foreground">Weiterleitung zur Preisberechnung...</p>
        </div>
      </div>
    </div>
  )
}
