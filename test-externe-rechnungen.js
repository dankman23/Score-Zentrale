/**
 * Test-Script für externe Amazon Rechnungen mit Zahlungszuordnung
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function testExterneRechnungen() {
  console.log('🧪 Teste externe Amazon Rechnungen mit Zahlungszuordnung...\n')
  
  // Zeitraum: Oktober 2025
  const from = '2025-10-01'
  const to = '2025-10-31'
  
  try {
    const response = await fetch(`${baseUrl}/api/fibu/rechnungen/extern?from=${from}&to=${to}&limit=50`)
    const data = await response.json()
    
    if (!data.ok) {
      console.error('❌ API Fehler:', data.error)
      return
    }
    
    console.log(`✅ ${data.total} externe Rechnungen geladen\n`)
    
    // Statistiken
    const mitZahlung = data.rechnungen.filter(r => r.zahlungId)
    const ohneZahlung = data.rechnungen.filter(r => !r.zahlungId)
    const vollstaendigBezahlt = data.rechnungen.filter(r => r.vollstaendigBezahlt)
    
    console.log('📊 Statistiken:')
    console.log(`   - Mit Zahlung zugeordnet: ${mitZahlung.length}`)
    console.log(`   - Ohne Zahlung: ${ohneZahlung.length}`)
    console.log(`   - Vollständig bezahlt: ${vollstaendigBezahlt.length}`)
    console.log(`   - Status "Bezahlt": ${data.rechnungen.filter(r => r.status === 'Bezahlt').length}`)
    console.log(`   - Status "Offen": ${data.rechnungen.filter(r => r.status === 'Offen').length}\n`)
    
    // Beispiel-Rechnungen mit Zahlung
    if (mitZahlung.length > 0) {
      console.log('📄 Beispiele MIT Zahlung:')
      mitZahlung.slice(0, 3).forEach(r => {
        console.log(`   ${r.rechnungsNr} - ${r.kunde}`)
        console.log(`      Rechnung: ${r.betrag.toFixed(2)} EUR am ${new Date(r.datum).toLocaleDateString('de-DE')}`)
        console.log(`      Zahlung:  ${r.zahlungsBetrag.toFixed(2)} EUR am ${new Date(r.zahlungsdatum).toLocaleDateString('de-DE')}`)
        console.log(`      Bestellung: ${r.bestellnummer}`)
        console.log(`      Status: ${r.status} ${r.vollstaendigBezahlt ? '✅' : '⚠️ Differenz: ' + r.betragDifferenz.toFixed(2) + ' EUR'}`)
        console.log('')
      })
    }
    
    // Beispiel-Rechnungen ohne Zahlung
    if (ohneZahlung.length > 0) {
      console.log('📄 Beispiele OHNE Zahlung:')
      ohneZahlung.slice(0, 3).forEach(r => {
        console.log(`   ${r.rechnungsNr} - ${r.kunde}`)
        console.log(`      Betrag: ${r.betrag.toFixed(2)} EUR`)
        console.log(`      Datum: ${new Date(r.datum).toLocaleDateString('de-DE')}`)
        console.log(`      Status: ${r.status} ⚠️`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
  }
}

testExterneRechnungen()
