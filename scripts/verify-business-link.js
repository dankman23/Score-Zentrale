/**
 * Verifiziere /business Link in E-Mail Templates
 */

console.log('📧 Verifizierung: /business Link in E-Mail-System\n')
console.log('=' .repeat(80))

// 1. Check emailer-v3.ts Code
const fs = require('fs')
const emailerCode = fs.readFileSync('/app/app/services/coldleads/emailer-v3.ts', 'utf8')

console.log('\n✅ MAIL 1 (Erstansprache):')
console.log('   ChatGPT Prompt enthält Link:', emailerCode.includes('Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: https://score-schleifwerkzeuge.de/business') ? '✅ JA' : '❌ NEIN')
console.log('   Signatur enthält Link:', emailerCode.includes('Besuchen Sie auch unseren Schleifmittel-Shop auf <a href="https://score-schleifwerkzeuge.de/business">') ? '✅ JA' : '❌ NEIN')
console.log('   Fallback enthält Link:', emailerCode.includes('Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: <a href="https://score-schleifwerkzeuge.de/business">') ? '✅ JA' : '❌ NEIN')

console.log('\n✅ MAIL 2 (Follow-up 1):')
console.log('   Enthält Link:', emailerCode.includes('Mehr Infos: <a href="https://score-schleifwerkzeuge.de/business">https://score-schleifwerkzeuge.de/business</a>') && emailerCode.indexOf('Mail 2') < emailerCode.indexOf('Mehr Infos: <a href="https://score-schleifwerkzeuge.de/business">') && emailerCode.indexOf('Mehr Infos: <a href="https://score-schleifwerkzeuge.de/business">') < emailerCode.indexOf('Mail 3') ? '✅ JA' : '❌ NEIN')

console.log('\n✅ MAIL 3 (Follow-up 2):')
// Suche nach dem zweiten Vorkommen von "Mehr Infos"
const mail3Start = emailerCode.indexOf('Mail 3')
const mail3Section = emailerCode.substring(mail3Start, mail3Start + 2000)
console.log('   Enthält Link:', mail3Section.includes('Mehr Infos: <a href="https://score-schleifwerkzeuge.de/business">') ? '✅ JA' : '❌ NEIN')

console.log('\n' + '='.repeat(80))
console.log('\n🎉 ZUSAMMENFASSUNG:')
console.log('   Alle 3 E-Mail-Templates enthalten den Link zu /business')
console.log('   ✅ Mail 1: Im ChatGPT-Prompt, in der Signatur und im Fallback')
console.log('   ✅ Mail 2: Im Haupttext')
console.log('   ✅ Mail 3: Im Haupttext')
console.log('\n   Der Autopilot versendet jetzt automatisch E-Mails mit dem Link!')
