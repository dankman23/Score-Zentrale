'use client'

/**
 * Intelligentes Sampling mit Fokus auf lokale Variationen
 * Wählt Punkte basierend auf:
 * 1. Gleichmäßige Verteilung über EK-Bereich
 * 2. Große VK-Variationen bei ähnlichem EK
 */
export function intelligentSample(data, targetCount = 100) {
  if (!data || data.length === 0) return []
  if (data.length <= targetCount) return data

  // Sortiere nach EK
  const sorted = [...data].sort((a, b) => a.ek - b.ek)
  
  const result = []
  const ekInterval = 5 // Intervall für lokale Variation
  
  // Ersten und letzten Punkt immer nehmen
  result.push(sorted[0])
  
  // Gruppiere nach EK-Intervallen und finde Ausreißer
  const groups = {}
  sorted.forEach(point => {
    const groupKey = Math.floor(point.ek / ekInterval)
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(point)
  })
  
  // Für jede Gruppe: Min, Max und Median VK finden
  const importantPoints = []
  Object.values(groups).forEach(group => {
    if (group.length === 0) return
    
    const sortedByVk = [...group].sort((a, b) => a.vk - b.vk)
    const minVk = sortedByVk[0]
    const maxVk = sortedByVk[sortedByVk.length - 1]
    const medianVk = sortedByVk[Math.floor(sortedByVk.length / 2)]
    
    // Wenn große Spanne, nehme min und max
    const vkRange = maxVk.vk - minVk.vk
    if (vkRange > 5) { // Signifikante Variation
      importantPoints.push({ point: minVk, priority: 10 })
      importantPoints.push({ point: maxVk, priority: 10 })
      importantPoints.push({ point: medianVk, priority: 5 })
    } else {
      importantPoints.push({ point: medianVk, priority: 1 })
    }
  })
  
  // Sortiere nach EK und Priorität
  importantPoints.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.point.ek - b.point.ek
  })
  
  // Entferne Duplikate
  const seen = new Set()
  importantPoints.forEach(({point}) => {
    const key = `${point.ek}_${point.vk}`
    if (!seen.has(key) && result.length < targetCount - 1) {
      seen.add(key)
      result.push(point)
    }
  })
  
  // Letzten Punkt hinzufügen
  if (sorted.length > 1) {
    result.push(sorted[sorted.length - 1])
  }
  
  // Nach EK sortieren für Chart
  return result.sort((a, b) => a.ek - b.ek)
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
