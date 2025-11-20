/**
 * Verifiziere neue E-Mail-Signatur
 */

const fs = require('fs')

console.log('📧 Verifizierung: E-Mail-Signatur Update\n')
console.log('=' .repeat(80))

const emailerCode = fs.readFileSync('/app/app/services/coldleads/emailer-v3.ts', 'utf8')

// Prüfe alte E-Mail-Adresse
const hasOldEmail = emailerCode.includes('leismann@score-schleifwerkzeuge.de')
console.log('\n❌ Alte E-Mail (leismann@):', hasOldEmail ? '❌ NOCH VORHANDEN' : '✅ ENTFERNT')

// Prüfe neue E-Mail-Adresse
const hasNewEmail = emailerCode.includes('daniel@score-schleifwerkzeuge.de')
console.log('✅ Neue E-Mail (daniel@):', hasNewEmail ? '✅ VORHANDEN' : '❌ FEHLT')

// Zähle Vorkommen
const newEmailCount = (emailerCode.match(/daniel@score-schleifwerkzeuge\.de/g) || []).length
console.log(`   → Vorkommen: ${newEmailCount}x (erwartet: mindestens 4)`)

// Prüfe Formatierung
const hasNewFormat = emailerCode.includes('Viele Grüße\nDaniel Leismann\n\nScore Schleifwerkzeuge')
console.log('\n✅ Neue Formatierung:', hasNewFormat ? '✅ KORREKT' : '❌ FEHLT')

// Prüfe ob Bold-Tags entfernt wurden
const hasBoldDaniel = emailerCode.includes('<b>Daniel Leismann</b>')
console.log('✅ Bold-Tags entfernt:', !hasBoldDaniel ? '✅ JA' : '❌ NEIN (noch vorhanden)')

// Prüfe neue Zeitangabe
const hasNewTime = emailerCode.includes('Mo-Fr 10-18 Uhr')
console.log('✅ Zeitangabe "Mo-Fr 10-18 Uhr":', hasNewTime ? '✅ VORHANDEN' : '❌ FEHLT')

console.log('\n' + '='.repeat(80))
console.log('\n🎉 ZUSAMMENFASSUNG:')

if (!hasOldEmail && hasNewEmail && newEmailCount >= 4 && hasNewFormat && !hasBoldDaniel && hasNewTime) {
  console.log('   ✅ Alle Änderungen erfolgreich implementiert!')
  console.log('   ✅ E-Mail-Adresse: daniel@score-schleifwerkzeuge.de')
  console.log('   ✅ Formatierung: Verbessert mit Absätzen')
  console.log('   ✅ Bold-Tags: Entfernt')
  console.log('   ✅ Zeitangabe: Mo-Fr 10-18 Uhr')
} else {
  console.log('   ⚠️  Einige Änderungen sind noch nicht vollständig')
  if (hasOldEmail) console.log('   - Alte E-Mail noch vorhanden')
  if (!hasNewEmail) console.log('   - Neue E-Mail fehlt')
  if (newEmailCount < 4) console.log('   - Zu wenige Vorkommen der neuen E-Mail')
  if (!hasNewFormat) console.log('   - Neue Formatierung fehlt')
  if (hasBoldDaniel) console.log('   - Bold-Tags noch vorhanden')
  if (!hasNewTime) console.log('   - Zeitangabe fehlt')
}

console.log('\n   Nächste versendete E-Mails enthalten die neue Signatur!')
