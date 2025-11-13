'use client'

export default function EKManagerPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">FIBU Dashboard</h1>
      <p>Dashboard wird neu geladen...</p>
      <a href="/api/fibu/uebersicht/complete?from=2025-10-01&to=2025-11-30" className="text-blue-500 underline">
        API Testen
      </a>
    </div>
  )
}
