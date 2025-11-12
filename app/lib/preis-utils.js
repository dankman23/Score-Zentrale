/**
 * Intelligentes Sampling von Datenpunkten für Chart-Anzeige
 * Wählt maximal `targetCount` Punkte aus, die den gesamten Bereich gut abdecken
 */
export function intelligentSample(data, targetCount = 30) {
  if (!data || data.length === 0) return []
  if (data.length <= targetCount) return data

  // Sortiere nach EK
  const sorted = [...data].sort((a, b) => a.ek - b.ek)
  
  const result = []
  const step = (sorted.length - 1) / (targetCount - 1)
  
  // Ersten Punkt immer nehmen
  result.push(sorted[0])
  
  // Gleichmäßig verteilte Punkte
  for (let i = 1; i < targetCount - 1; i++) {
    const index = Math.round(i * step)
    result.push(sorted[index])
  }
  
  // Letzten Punkt immer nehmen
  if (sorted.length > 1) {
    result.push(sorted[sorted.length - 1])
  }
  
  return result
}

/**
 * Generiert Datenpunkte für berechnete Preise (für Chart-Anzeige)
 * @param {number} ek - Der eingegebene EK-Wert
 * @param {number} plattform - Berechneter Plattformpreis
 * @param {number} shop - Berechneter Shop-Preis (erste Staffel)
 * @param {number} maxEk - Maximaler EK für Range (default: 300)
 * @param {number} points - Anzahl Datenpunkte (default: 16)
 */
export function generateChartDataForSingleEk(ek, plattform, shop, maxEk = 300, points = 16) {
  const data = []
  const step = maxEk / (points - 1)
  
  // Verhältnis berechnen
  const plattformRatio = plattform / ek
  const shopRatio = shop / ek
  
  for (let i = 0; i < points; i++) {
    const currentEk = i * step
    data.push({
      ek: currentEk,
      plattform: currentEk * plattformRatio,
      shop: currentEk * shopRatio
    })
  }
  
  return data
}

/**
 * Parsed Excel/CSV Datei und extrahiert EK/VK Paare
 */
export async function parsePreisFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Erste Sheet nehmen
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        
        // Zu JSON konvertieren
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        
        // Extrahiere EK/VK Paare (erste zwei Spalten)
        const preise = []
        for (let i = 1; i < jsonData.length; i++) { // Skip header
          const row = jsonData[i]
          if (row && row[0] && row[1]) {
            const ek = parseFloat(row[0])
            const vk = parseFloat(row[1])
            if (!isNaN(ek) && !isNaN(vk)) {
              preise.push({ ek, vk })
            }
          }
        }
        
        resolve(preise)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'))
    reader.readAsArrayBuffer(file)
  })
}
