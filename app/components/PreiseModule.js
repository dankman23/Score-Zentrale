'use client'

import { useState, useEffect } from 'react'
import PreiseG2Module from './PreiseG2Module'

export default function PreiseModule() {
  const [tab, setTab] = useState('alte_pb')
  const [sheet, setSheet] = useState('lagerware')
  
  // Historie-Tab
  const [historieSku, setHistorieSku] = useState('122112')
  const [historieData, setHistorieData] = useState(null)
  const [historieLoading, setHistorieLoading] = useState(false)
  const [formeln, setFormeln] = useState([])
  const [currentFormel, setCurrentFormel] = useState(null)
  const [ek, setEk] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [loading, setLoading] = useState(false)
  const [reglerEdited, setReglerEdited] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  
  // Chart für Alte PB
  const [chartData, setChartData] = useState(null)
  const [uploadedData, setUploadedData] = useState(null)
  
  // Vergleich-Tab
  const [vergleichEk, setVergleichEk] = useState('10')
  const [selectedFormeln, setSelectedFormeln] = useState(['lagerware', 'klingspor_fremdlager'])
  const [vergleichData, setVergleichData] = useState([])
  const [vergleichModus, setVergleichModus] = useState('plattform') // 'plattform' oder 'shop'
  const [vergleichG2Enabled, setVergleichG2Enabled] = useState(false)
  const [vergleichG2Warengruppe, setVergleichG2Warengruppe] = useState('lagerware')
  const [vergleichLoading, setVergleichLoading] = useState(false)
  const [vergleichUploadedData, setVergleichUploadedData] = useState(null)

  // Staffelgrenzen-Tab
  const [staffelVE, setStaffelVE] = useState(1)
  const [staffelAbnahmeintervall, setStaffelAbnahmeintervall] = useState(1) // NEU: Abnahmeintervall Lieferant
  const [staffelMindestWert, setStaffelMindestWert] = useState('2') // Standard: 2€ EK
  const [staffelSchwellen, setStaffelSchwellen] = useState([
    { wert: '25' },
    { wert: '50' },
    { wert: '100' },
    { wert: '250' }
  ]) // Nur EK-Schwellen
  const [staffelRundung, setStaffelRundung] = useState('3,5,10,15,20,25,30,40,50,75,100,150,200,300')
  const [staffelGrenzen, setStaffelGrenzen] = useState([])
  const [staffelAuswahlMenge, setStaffelAuswahlMenge] = useState(null) // Gewählte Menge in der Ausgabe
  const [staffelLoading, setStaffelLoading] = useState(false)
  const [staffelG2EK, setStaffelG2EK] = useState('5')
  const [staffelG2Warengruppe, setStaffelG2Warengruppe] = useState('lagerware')

  const sheets = [
    { id: 'lagerware', name: 'Lagerware' },
    { id: 'klingspor_fremdlager', name: 'Klingspor Fremdlager' },
    { id: 'abverkauf', name: 'Abverkauf' },
    { id: 'lagerware_guenstiger_ek', name: 'Lagerware günstiger EK' },
    { id: 'pferd_fremdlager', name: 'Pferd Fremdlager' },
    { id: 'plastimex_fremdlager', name: 'Plastimex Fremdlager' },
    { id: 'alle_konfektion', name: 'Alle Konfektion' }
  ]

  // Formeln beim ersten Laden abrufen
  useEffect(() => {
    loadFormeln()
    
    // Staffelgrenzen-Config laden
    const savedConfig = localStorage.getItem('staffelgrenzen_config')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        setStaffelVE(config.ve || 1)
        setStaffelAbnahmeintervall(config.abnahmeintervall || 1)
        setStaffelMindestWert(config.mindestWert || '2')
        setStaffelSchwellen(config.schwellen || [{ wert: '25' }, { wert: '50' }, { wert: '100' }, { wert: '250' }])
        setStaffelRundung(config.rundung || '3,5,10,15,20,25,30,40,50,75,100,150,200,300')
        setStaffelG2EK(config.ek || '5')
        setStaffelG2Warengruppe(config.warengruppe || 'lagerware')
      } catch (e) {
        console.error('Fehler beim Laden der Staffelgrenzen-Config:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (formeln.length > 0) {
      const formel = formeln.find(f => f.sheet === sheet)
      setCurrentFormel(formel)
      setErgebnisse([])
      setEk('')
      setReglerEdited(false)
    }
  }, [sheet, formeln])

  // Chart für Alte PB rendern
  useEffect(() => {
    if ((chartData || uploadedData) && typeof window !== 'undefined' && window.Chart) {
      const ctx = document.getElementById('altePbChart')
      if (!ctx) return

      const existingChart = window.Chart.getChart('altePbChart')
      if (existingChart) existingChart.destroy()

      const datasets = []
      
      // Berechnete Daten
      if (chartData) {
        datasets.push({
          label: 'Plattformpreis (berechnet)',
          data: chartData.map(d => ({ x: d.ek, y: d.plattform })),
          borderColor: '#F6B10A',
          backgroundColor: '#F6B10A20',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2
        })
        
        datasets.push({
          label: 'Shop-Preis (berechnet)',
          data: chartData.map(d => ({ x: d.ek, y: d.shop })),
          borderColor: '#2fb97f',
          backgroundColor: '#2fb97f20',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2
        })
      }
      
      // Hochgeladene Daten als Scatter
      if (uploadedData) {
        datasets.push({
          label: 'Hochgeladene Preise',
          data: uploadedData.map(d => ({ x: d.ek, y: d.vk })),
          type: 'scatter',
          borderColor: '#e44c4c',
          backgroundColor: '#e44c4c',
          pointRadius: 5,
          pointStyle: 'circle',
          showLine: false
        })
      }

      const labels = chartData ? chartData.map(d => d.ek + '€') : []

      new window.Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { font: { size: 9 }, boxWidth: 15, padding: 8 } },
            title: { display: true, text: 'Preisverlauf', font: { size: 13 } }
          },
          scales: {
            x: { 
              type: 'linear',
              title: { display: true, text: 'EK (€)', font: { size: 11 } }, 
              ticks: { font: { size: 9 } },
              min: 0,
              max: 300
            },
            y: { title: { display: true, text: 'VK (€)', font: { size: 11 } }, beginAtZero: true, ticks: { font: { size: 9 } } }
          }
        }
      })
    }
  }, [chartData, uploadedData])

  // Vergleichs-Diagramm rendern
  useEffect(() => {
    if ((vergleichData.length > 0 || vergleichUploadedData) && typeof window !== 'undefined' && window.Chart) {
      const ctx = document.getElementById('vergleichChart')
      if (!ctx) return

      const existingChart = window.Chart.getChart('vergleichChart')
      if (existingChart) existingChart.destroy()

      // Datasets - ECHTE Kurvendaten aus vergleichData
      const datasets = []
      const colors = ['#F6B10A', '#2fb97f', '#17a2b8', '#e44c4c', '#667eea', '#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#16a085', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f']
      
      vergleichData.forEach((d, idx) => {
        // Nutze die echten Kurvendaten
        const data = d.kurve.map(point => ({ 
          x: point.ek, 
          y: vergleichModus === 'plattform' ? point.plattform : point.shop 
        }))
        
        datasets.push({
          label: d.name,
          data,
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 1
        })
      })
      
      // Hochgeladene Daten als Scatter hinzufügen
      if (vergleichUploadedData) {
        datasets.push({
          label: 'Hochgeladene Preise',
          data: vergleichUploadedData.map(d => ({ x: d.ek, y: d.vk })),
          type: 'scatter',
          borderColor: '#dc3545',
          backgroundColor: '#dc3545',
          pointRadius: 5,
          pointStyle: 'circle',
          showLine: false
        })
      }

      // Labels aus erster Kurve
      const labels = vergleichData.length > 0 
        ? vergleichData[0].kurve.map(point => point.ek + '€')
        : []

      new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { font: { size: 9 }, boxWidth: 15, padding: 8 } },
            title: { 
              display: true, 
              text: `VK (${vergleichModus === 'plattform' ? 'Plattform' : 'Shop'}) in Abhängigkeit vom EK`,
              font: { size: 13 }
            }
          },
          scales: {
            x: { 
              type: 'linear',
              title: { display: true, text: 'EK (€)', font: { size: 11 } },
              ticks: { font: { size: 9 } },
              min: 0,
              max: 300
            },
            y: { 
              title: { display: true, text: 'VK (€)', font: { size: 11 } }, 
              beginAtZero: true,
              ticks: { font: { size: 9 } }
            }
          }
        }
      })
    }
  }, [vergleichData, vergleichModus, vergleichUploadedData])

  const loadFormeln = async () => {
    try {
      const res = await fetch('/api/preise/formeln')
      const data = await res.json()
      if (data.ok) {
        setFormeln(data.formeln)
      }
    } catch (e) {
      console.error('Fehler beim Laden der Formeln:', e)
    }
  }

  const berechnePreise = async () => {
    if (!ek || !currentFormel) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/preise/berechnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ek: parseFloat(ek),
          regler: currentFormel.regler,
          ve_staffeln: currentFormel.ve_staffeln
        })
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      const text = await res.text()
      const data = JSON.parse(text)
      
      if (data.ok) {
        setErgebnisse(data.ergebnisse)
        
        // Generiere Chart-Daten
        if (data.ergebnisse.length > 0) {
          const firstResult = data.ergebnisse[0]
          const ekVal = parseFloat(ek)
          const chartPoints = []
          
          // 16 Punkte von 0 bis 300€
          for (let i = 0; i <= 300; i += 20) {
            const ratio = i / ekVal
            chartPoints.push({
              ek: i,
              plattform: firstResult.vk_netto * ratio,
              shop: firstResult.vk_shop_netto * ratio
            })
          }
          
          setChartData(chartPoints)
        }
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (e) {
      console.error('Berechnung Fehler:', e)
      alert('Fehler bei der Berechnung: ' + e.message)
    }
    setLoading(false)
  }
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      const { parsePreisFile, intelligentSample } = await import('../lib/preis-utils')
      const preise = await parsePreisFile(file)
      
      // Filtere auf relevanten EK-Bereich (0-300€)
      const filtered = preise.filter(p => p.ek >= 0 && p.ek <= 300)
      
      // Intelligentes Sampling auf 200 Punkte
      const sampled = intelligentSample(filtered, 200)
      
      setUploadedData(sampled)
      alert(`✅ ${preise.length} Preise geladen, ${filtered.length} im Bereich 0-300€, ${sampled.length} Punkte angezeigt`)
    } catch (e) {
      alert('Fehler beim Laden der Datei: ' + e.message)
    }
  }
  
  const handleVergleichFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      const { parsePreisFile, intelligentSample } = await import('../lib/preis-utils')
      const preise = await parsePreisFile(file)
      
      // Filtere auf relevanten EK-Bereich (0-300€)
      const filtered = preise.filter(p => p.ek >= 0 && p.ek <= 300)
      
      // Intelligentes Sampling auf 200 Punkte
      const sampled = intelligentSample(filtered, 200)
      
      setVergleichUploadedData(sampled)
      alert(`✅ ${preise.length} Preise geladen, ${filtered.length} im Bereich 0-300€, ${sampled.length} Punkte angezeigt`)
    } catch (e) {
      alert('Fehler beim Laden der Datei: ' + e.message)
    }
  }
  
  // Lade Preis-Historie
  const loadHistorie = async () => {
    if (!historieSku) return
    
    setHistorieLoading(true)
    try {
      const res = await fetch(`/api/preise/historie?sku=${historieSku}`)
      const data = await res.json()
      if (data.ok) {
        setHistorieData(data)
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (e) {
      alert('Fehler beim Laden der Historie: ' + e.message)
    }
    setHistorieLoading(false)
  }

  const updateRegler = (key, value) => {
    if (!currentFormel) return
    const updated = {
      ...currentFormel,
      regler: {
        ...currentFormel.regler,
        [key]: parseFloat(value) || 0
      }
    }
    setCurrentFormel(updated)
    setReglerEdited(true)
  }

  const speichernRegler = async () => {
    if (!confirm('Möchten Sie die geänderten Regler wirklich speichern?')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/preise/formeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: currentFormel.sheet,
          warengruppe: currentFormel.warengruppen[0].id,
          regler: currentFormel.regler
        })
      })
      const data = await res.json()
      if (data.ok) {
        alert('✅ Regler gespeichert!')
        setReglerEdited(false)
        await loadFormeln()
      }
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message)
    }
    setLoading(false)
  }

  if (tab === 'alte_pb' && !currentFormel) {
    return <div className="text-center py-5"><div className="spinner-border"/></div>
  }

  return (
    <div className="card">
      <div className="card-header py-1">
        <h6 className="mb-0"><i className="bi bi-calculator mr-2"/>Preisberechnung</h6>
      </div>
      <div className="card-body py-2" style={{fontSize: '0.9rem'}}>
        {/* Haupt-Tabs */}
        <div className="btn-group btn-group-sm mb-2 w-100">
          <button 
            className={`btn btn-sm ${tab === 'alte_pb' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('alte_pb')}
            style={{fontSize: '0.85rem'}}
          >
            Alte PB
          </button>
          <button 
            className={`btn btn-sm ${tab === 'neue_2025' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('neue_2025')}
            style={{fontSize: '0.85rem'}}
          >
            Neue ab 2025-11 (g2)
          </button>
          <button 
            className={`btn btn-sm ${tab === 'vergleich' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('vergleich')}
            style={{fontSize: '0.85rem'}}
          >
            <i className="bi bi-bar-chart mr-1"/>Vergleich
          </button>
          <button 
            className={`btn btn-sm ${tab === 'staffelgrenzen' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('staffelgrenzen')}
            style={{fontSize: '0.85rem'}}
          >
            <i className="bi bi-layers mr-1"/>Staffelgrenzen
          </button>
          <button 
            className={`btn btn-sm ${tab === 'historie' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('historie')}
            style={{fontSize: '0.85rem'}}
          >
            <i className="bi bi-clock-history mr-1"/>Historie
          </button>
        </div>

        {tab === 'alte_pb' && (
          <>
            {/* Sheet-Tabs - kompakter */}
            <div className="mb-2">
              <div className="btn-group btn-group-sm d-flex flex-wrap">
                {sheets.map(s => (
                  <button
                    key={s.id}
                    className={`btn btn-sm ${sheet === s.id ? 'btn-warning' : 'btn-outline-secondary'}`}
                    onClick={() => setSheet(s.id)}
                    style={{fontSize: '0.75rem', padding: '0.25rem 0.5rem', flex: '1 1 auto', minWidth: '120px'}}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Warengruppen - kompakter */}
            <div className="alert alert-info mb-2 py-1">
              <small style={{fontSize: '0.8rem'}}><strong>Warengruppen:</strong> {currentFormel.warengruppen.map(w => w.name).join(', ')}</small>
            </div>

            {/* Regler */}
            <div className="card mb-2">
              <div className="card-header py-1 d-flex justify-content-between align-items-center" style={{cursor: 'pointer'}} onClick={() => setConfigExpanded(!configExpanded)}>
                <small className="mb-0 font-weight-bold">
                  <i className={`bi bi-chevron-${configExpanded ? 'up' : 'down'} mr-2`}/>
                  Konfiguration {!configExpanded && '(klicken zum Ausklappen)'}
                </small>
                {reglerEdited && (
                  <button className="btn btn-xs btn-warning py-0 px-2" onClick={(e) => { e.stopPropagation(); speichernRegler(); }}>
                    <i className="bi bi-save mr-1"/>Speichern
                  </button>
                )}
              </div>
              {configExpanded && (
                <div className="card-body py-2">
                {/* Kosten - variabel */}
                <div className="mb-2">
                  <div className="bg-warning text-dark font-weight-bold px-2 py-1 mb-1" style={{fontSize: '0.85rem'}}>
                    Kosten - variabel
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.8rem'}}>Ebay/Amazon</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control form-control-sm" 
                          value={(currentFormel.regler.ebay_amazon * 100).toFixed(2)}
                          onChange={(e) => updateRegler('ebay_amazon', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.8rem'}}>Paypal</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control form-control-sm" 
                          value={(currentFormel.regler.paypal * 100).toFixed(2)}
                          onChange={(e) => updateRegler('paypal', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kosten - statisch */}
                <div className="mb-2">
                  <div className="bg-warning text-dark font-weight-bold px-2 py-1 mb-1" style={{fontSize: '0.85rem'}}>
                    Kosten - statisch
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.8rem'}}>Paypal Fix</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.paypal_fix}
                        onChange={(e) => updateRegler('paypal_fix', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.8rem'}}>Fixkosten Beitrag</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.fixkosten_beitrag}
                        onChange={(e) => updateRegler('fixkosten_beitrag', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Regler */}
                <div className="mb-2">
                  <div className="bg-light text-dark font-weight-bold px-2 py-1 mb-1" style={{fontSize: '0.85rem'}}>
                    Regler
                  </div>
                  <div className="row">
                    <div className="col mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.75rem'}}>Gewinn Regler 1 a</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_1a}
                        onChange={(e) => updateRegler('gewinn_regler_1a', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.75rem'}}>Gewinn Regler 2 c</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_2c}
                        onChange={(e) => updateRegler('gewinn_regler_2c', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.75rem'}}>Gewinn Regler 3 e</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_3e}
                        onChange={(e) => updateRegler('gewinn_regler_3e', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.75rem'}}>Prozent Aufschlag</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control form-control-sm" 
                          value={(currentFormel.regler.prozent_aufschlag * 100).toFixed(2)}
                          onChange={(e) => updateRegler('prozent_aufschlag', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold" style={{fontSize: '0.75rem'}}>A.A. Threshold</label>
                      <input 
                        type="number" 
                        step="1"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.aa_threshold}
                        onChange={(e) => updateRegler('aa_threshold', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* EK-Eingabe */}
            <div className="card mb-2 border-primary">
              <div className="card-header bg-primary text-white py-1">
                <small className="mb-0 font-weight-bold">EK-Eingabe</small>
              </div>
              <div className="card-body py-2">
                <div className="row align-items-end">
                  <div className="col-md-8">
                    <label className="font-weight-bold" style={{fontSize: '0.85rem'}}>EK-Stück netto (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control form-control-sm" 
                      placeholder="z.B. 10.50"
                      value={ek}
                      onChange={(e) => setEk(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && berechnePreise()}
                    />
                  </div>
                  <div className="col-md-4">
                    <button 
                      className="btn btn-warning btn-sm btn-block font-weight-bold" 
                      onClick={berechnePreise}
                      disabled={loading || !ek}
                    >
                      {loading ? <span className="spinner-border spinner-border-sm mr-1"/> : <i className="bi bi-calculator mr-1"/>}
                      Berechnen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* VK-Ergebnisse - kompakter */}
            {ergebnisse.length > 0 && (
              <div>
                {/* Plattformpreis */}
                <div className="card border-primary mb-2">
                  <div className="card-header bg-primary text-white py-1">
                    <small className="mb-0 font-weight-bold" style={{fontSize: '0.85rem'}}>Netto Plattformpreis (eBay/Amazon)</small>
                  </div>
                  <div className="card-body text-center py-2">
                    <div className="h4 font-weight-bold text-primary mb-0">
                      {(ergebnisse[0]?.vk_netto || 0).toFixed(2)} €
                    </div>
                    <small className="text-muted" style={{fontSize: '0.7rem'}}>pro Stück (netto)</small>
                  </div>
                </div>

                {/* Shop-Staffelpreise */}
                <div className="card border-success">
                  <div className="card-header bg-success text-white py-1">
                    <small className="mb-0 font-weight-bold" style={{fontSize: '0.85rem'}}>Netto Shop Staffelpreise (SHOP - 8%)</small>
                  </div>
                  <div className="card-body py-2">
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.85rem'}}>
                        <thead className="thead-light">
                          <tr className="font-weight-bold" style={{fontSize: '0.75rem'}}>
                            {ergebnisse.map(e => (
                              <th key={e.ve} className="py-1 px-1">{e.ve}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {ergebnisse.map(e => (
                              <td key={e.ve} className="font-weight-bold text-success py-1 px-1">
                                {(e.vk_shop_netto || 0).toFixed(2)} €
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Excel/CSV Upload */}
            <div className="card mb-2 border-secondary">
              <div className="card-header bg-secondary text-white py-1">
                <small className="mb-0 font-weight-bold">
                  <i className="bi bi-upload mr-1"/>Excel/CSV Upload (EK/VK)
                </small>
              </div>
              <div className="card-body py-2">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  className="form-control form-control-sm"
                  onChange={handleFileUpload}
                  style={{fontSize: '0.85rem'}}
                />
                <small className="text-muted d-block mt-1" style={{fontSize: '0.75rem'}}>
                  Erste Spalte: EK, Zweite Spalte: VK
                </small>
              </div>
            </div>

            {/* Chart anzeigen */}
            {(chartData || uploadedData) && (
              <div className="card border-info">
                <div className="card-header bg-info text-white py-2">
                  <strong style={{fontSize: '0.95rem'}}>Preisverlauf</strong>
                </div>
                <div className="card-body py-2">
                  <div style={{height: '600px'}}>
                    <canvas id="altePbChart"></canvas>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'neue_2025' && (
          <PreiseG2Module formeln={formeln} />
        )}

        {/* Historie Tab */}
        {tab === 'historie' && (
          <div>
            {/* SKU-Eingabe */}
            <div className="card mb-2 border-primary">
              <div className="card-header bg-primary text-white py-1">
                <small className="font-weight-bold">Artikel-Suche</small>
              </div>
              <div className="card-body py-2">
                <div className="row">
                  <div className="col-md-8">
                    <input 
                      type="text" 
                      className="form-control form-control-sm"
                      placeholder="SKU / Artikelnummer"
                      value={historieSku}
                      onChange={e => setHistorieSku(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && loadHistorie()}
                    />
                  </div>
                  <div className="col-md-4">
                    <button 
                      className="btn btn-sm btn-primary w-100"
                      onClick={loadHistorie}
                      disabled={historieLoading}
                    >
                      {historieLoading ? (
                        <><span className="spinner-border spinner-border-sm mr-1"/>Laden...</>
                      ) : (
                        <><i className="bi bi-search mr-1"/>Suchen</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Historie-Daten */}
            {historieData && (
              <div>
                {/* Artikel-Info */}
                <div className="card mb-2 border-info">
                  <div className="card-header bg-info text-white py-1">
                    <small className="font-weight-bold">Artikel-Info</small>
                  </div>
                  <div className="card-body py-2">
                    <div className="row">
                      <div className="col-md-4">
                        <small className="text-muted">SKU:</small>
                        <div className="font-weight-bold">{historieData.artikel.cArtNr}</div>
                      </div>
                      <div className="col-md-4">
                        <small className="text-muted">Aktueller VK (netto):</small>
                        <div className="font-weight-bold text-success">{historieData.artikel.fVKNetto?.toFixed(2)} €</div>
                      </div>
                      <div className="col-md-4">
                        <small className="text-muted">Lagerbestand:</small>
                        <div className="font-weight-bold">{historieData.artikel.nLagerbestand || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historie-Tabelle */}
                <div className="card border-warning">
                  <div className="card-header bg-warning text-dark py-1">
                    <strong>Preis-Historie & Erfolgsmetriken</strong>
                    <span className="badge badge-light ml-2">{historieData.historie?.length || 0} Einträge</span>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0" style={{fontSize: '0.85rem'}}>
                        <thead className="thead-light">
                          <tr>
                            <th>Von</th>
                            <th>Bis</th>
                            <th>Tage</th>
                            <th className="text-right">VK Netto</th>
                            <th className="text-right">Ø EK</th>
                            <th className="text-right">Marge %</th>
                            <th className="text-right">Verkäufe</th>
                            <th className="text-right">Umsatz</th>
                            <th className="text-right">Rohertrag</th>
                            <th className="text-right bg-success text-white">€/Tag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historieData.historie?.length > 0 ? (
                            historieData.historie.map((h, idx) => (
                              <tr key={idx}>
                                <td><small>{new Date(h.von_datum).toLocaleDateString('de-DE')}</small></td>
                                <td><small>{new Date(h.bis_datum).toLocaleDateString('de-DE')}</small></td>
                                <td><small>{h.tage_aktiv}</small></td>
                                <td className="text-right font-weight-bold">{h.vk_netto?.toFixed(2)} €</td>
                                <td className="text-right">{h.durchschnitt_ek?.toFixed(2)} €</td>
                                <td className="text-right">
                                  <span className={`badge ${h.marge_prozent > 30 ? 'badge-success' : h.marge_prozent > 20 ? 'badge-warning' : 'badge-danger'}`}>
                                    {h.marge_prozent?.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="text-right">{h.anzahl_verkaufe}</td>
                                <td className="text-right">{h.umsatz?.toFixed(2)} €</td>
                                <td className="text-right font-weight-bold text-primary">{h.rohertrag?.toFixed(2)} €</td>
                                <td className="text-right font-weight-bold bg-success text-white">
                                  {h.rohertrag_pro_tag?.toFixed(2)} €
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="10" className="text-center text-muted py-3">
                                Keine Historie-Daten gefunden
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!historieData && !historieLoading && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle mr-2"/>
                Geben Sie eine SKU ein und klicken Sie auf "Suchen"
              </div>
            )}
          </div>
        )}

        {tab === 'vergleich' && (
          <div>
            {/* Einstellungen */}
            <div className="card mb-2 border-info">
              <div className="card-header bg-info text-white py-1">
                <small className="mb-0 font-weight-bold">Einstellungen</small>
              </div>
              <div className="card-body py-2">
                <div className="row align-items-end mb-1">
                  <div className="col-md-3">
                    <div className="btn-group btn-group-sm w-100">
                      <button 
                        className={`btn ${vergleichModus === 'plattform' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setVergleichModus('plattform')}
                        style={{fontSize: '0.8rem'}}
                      >
                        Plattform
                      </button>
                      <button 
                        className={`btn ${vergleichModus === 'shop' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setVergleichModus('shop')}
                        style={{fontSize: '0.8rem'}}
                      >
                        Shop
                      </button>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="small font-weight-bold">&#160;</label>
                    <button 
                      className="btn btn-info btn-block font-weight-bold" 
                      onClick={async () => {
                        if (formeln.length === 0) return
                        
                        setVergleichLoading(true)
                        const comparisons = []
                        
                        // EK-Range: 0 bis 300€ in 20€ Schritten (Performance-Optimierung)
                        const ekRange = []
                        for (let i = 0; i <= 300; i += 20) {
                          ekRange.push(i)
                        }
                        
                        // Alte Formeln berechnen
                        for (const formel of formeln) {
                          if (selectedFormeln.includes(formel.sheet)) {
                            const kurve = []
                            
                            // Für jeden EK-Wert echte Berechnung
                            for (const ek of ekRange) {
                              if (ek === 0) {
                                kurve.push({ ek: 0, plattform: 0, shop: 0 })
                              } else {
                                const res = await fetch('/api/preise/berechnen', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    ek,
                                    regler: formel.regler,
                                    ve_staffeln: [1]
                                  })
                                })
                                const data = await res.json()
                                if (data.ok && data.ergebnisse.length > 0) {
                                  kurve.push({
                                    ek,
                                    plattform: data.ergebnisse[0].vk_netto,
                                    shop: data.ergebnisse[0].vk_shop_netto
                                  })
                                }
                              }
                            }
                            
                            comparisons.push({
                              name: formel.name,
                              sheet: formel.sheet,
                              type: 'alt',
                              kurve
                            })
                          }
                        }
                        
                        // g2 wenn aktiviert
                        if (vergleichG2Enabled) {
                          const selectedFormel = formeln.find(f => f.sheet === vergleichG2Warengruppe)
                          if (selectedFormel) {
                            // Lade aktuelle g2-Config
                            const configRes = await fetch('/api/preise/g2/config')
                            const configData = await configRes.json()
                            let g2Config = {
                              gstart_ek: 12,
                              gneu_ek: 100,
                              gneu_vk: 189,
                              fixcost1: 0.35,
                              fixcost2: 1.4,
                              varpct1: 0.25,
                              varpct2: 0.02,
                              aufschlag: 1.08,
                              shp_fac: 0.92,
                              aa_threshold: 18
                            }
                            
                            // Verwende gespeicherte Config falls vorhanden
                            if (configData.ok && configData.configs && configData.configs.length > 0) {
                              const savedConfig = configData.configs.find(c => c.warengruppe === vergleichG2Warengruppe) || configData.configs[0]
                              g2Config = { ...g2Config, ...savedConfig }
                            }
                            
                            const kurve = []
                            
                            for (const ek of ekRange) {
                              if (ek === 0) {
                                kurve.push({ ek: 0, plattform: 0, shop: 0 })
                              } else {
                                const res = await fetch('/api/preise/g2/berechnen', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    ek,
                                    warengruppe_regler: selectedFormel.regler,
                                    g2_params: g2Config,
                                    staffel_mengen: [1]
                                  })
                                })
                                const data = await res.json()
                                if (data.ok) {
                                  kurve.push({
                                    ek,
                                    plattform: data.plattform_unit,
                                    shop: data.shop_unit
                                  })
                                }
                              }
                            }
                            
                            comparisons.push({
                              name: selectedFormel.name + ' (g2)',
                              sheet: 'g2_' + vergleichG2Warengruppe,
                              type: 'g2',
                              kurve
                            })
                          }
                        }
                        
                        setVergleichData(comparisons)
                        setVergleichLoading(false)
                      }}
                      disabled={vergleichLoading}
                    >
                      {vergleichLoading ? (
                        <><span className="spinner-border spinner-border-sm mr-2"/>Berechne Kurven...</>
                      ) : (
                        <><i className="bi bi-calculator mr-2"/>Vergleich berechnen</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Formeln auswählen */}
            <div className="card mb-2">
              <div className="card-header py-1 d-flex justify-content-between align-items-center">
                <small className="mb-0 font-weight-bold">Formeln für Vergleich auswählen</small>
                <div className="btn-group btn-group-sm">
                  <button 
                    className="btn btn-xs btn-outline-primary py-0 px-2"
                    onClick={() => setSelectedFormeln(formeln.map(f => f.sheet))}
                    style={{fontSize: '0.75rem'}}
                  >
                    Alle
                  </button>
                  <button 
                    className="btn btn-xs btn-outline-secondary py-0 px-2"
                    onClick={() => setSelectedFormeln([])}
                    style={{fontSize: '0.75rem'}}
                  >
                    Keine
                  </button>
                </div>
              </div>
              <div className="card-body py-2">
                <div className="row mb-2">
                  {formeln.map(f => (
                    <div className="col-md-3 mb-1" key={f.sheet}>
                      <div className="custom-control custom-checkbox">
                        <input 
                          type="checkbox" 
                          className="custom-control-input" 
                          id={`check_${f.sheet}`}
                          checked={selectedFormeln.includes(f.sheet)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedFormeln([...selectedFormeln, f.sheet])
                            } else {
                              setSelectedFormeln(selectedFormeln.filter(s => s !== f.sheet))
                            }
                          }}
                        />
                        <label className="custom-control-label" htmlFor={`check_${f.sheet}`} style={{fontSize: '0.85rem'}}>
                          {f.name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* g2-Option */}
                <div className="border-top pt-2">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="custom-control custom-checkbox">
                        <input 
                          type="checkbox" 
                          className="custom-control-input" 
                          id="check_g2"
                          checked={vergleichG2Enabled}
                          onChange={e => setVergleichG2Enabled(e.target.checked)}
                        />
                        <label className="custom-control-label font-weight-bold text-success" htmlFor="check_g2">
                          Neue Preisberechnung (g2)
                        </label>
                      </div>
                    </div>
                    {vergleichG2Enabled && (
                      <div className="col-md-8">
                        <label className="small">Warengruppe für g2:</label>
                        <select 
                          className="form-control form-control-sm" 
                          value={vergleichG2Warengruppe}
                          onChange={e => setVergleichG2Warengruppe(e.target.value)}
                        >
                          <option value="lagerware">Lagerware</option>
                          <option value="klingspor_fremdlager">Klingspor Fremdlager</option>
                          <option value="abverkauf">Abverkauf</option>
                          <option value="lagerware_guenstiger_ek">Lagerware günstiger EK</option>
                          <option value="pferd_fremdlager">Pferd Fremdlager</option>
                          <option value="plastimex_fremdlager">Plastimex Fremdlager</option>
                          <option value="alle_konfektion">Alle Konfektion</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Excel/CSV Upload */}
            <div className="card mb-2 border-secondary">
              <div className="card-header bg-secondary text-white py-1">
                <small className="mb-0 font-weight-bold">
                  <i className="bi bi-upload mr-1"/>Excel/CSV Upload (EK/VK)
                </small>
              </div>
              <div className="card-body py-2">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  className="form-control form-control-sm"
                  onChange={handleVergleichFileUpload}
                  style={{fontSize: '0.85rem'}}
                />
                <small className="text-muted d-block mt-1" style={{fontSize: '0.75rem'}}>
                  Erste Spalte: EK, Zweite Spalte: VK
                </small>
              </div>
            </div>

            {/* Liniendiagramm */}
            {(vergleichData.length > 0 || vergleichUploadedData) && (
              <div className="card border-info">
                <div className="card-header bg-info text-white py-2">
                  <strong style={{fontSize: '0.95rem'}}>Preisverlauf (EK 0-300€ → VK)</strong>
                  <small className="ml-3 text-white-50" style={{fontSize: '0.8rem'}}>
                    {vergleichData.length} Formel{vergleichData.length > 1 ? 'n' : ''} im Vergleich
                  </small>
                </div>
                <div className="card-body py-2">
                  <div style={{height: '600px'}}>
                    <canvas id="vergleichChart"></canvas>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staffelgrenzen Tab */}
        {tab === 'staffelgrenzen' && (
          <div>
            <div className="alert alert-info mb-4">
              <i className="bi bi-info-circle me-2"/>
              Staffelgrenzen berechnen basierend auf VE, Abnahmeintervall und EK-Schwellen. 
              Die Staffelgrenzen werden auf schöne Zahlen gerundet.
            </div>

            <div className="row">
              {/* Linke Spalte: Eingaben */}
              <div className="col-md-5">
                <div className="card bg-dark border-secondary">
                  <div className="card-header bg-secondary">
                    <strong><i className="bi bi-sliders me-2"/>Eingabeparameter</strong>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {/* VE (Lieferumfang) */}
                      <div className="col-md-6">
                        <label className="form-label text-white fw-bold">
                          VE (Lieferumfang)
                        </label>
                        <input 
                          type="number"
                          className="form-control form-control-lg"
                          min="1"
                          step="1"
                          value={staffelVE}
                          onChange={(e) => setStaffelVE(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057', fontSize: '1.2rem'}}
                        />
                        <small className="text-muted">Stück pro Verpackung</small>
                      </div>

                      {/* Abnahmeintervall Lieferant */}
                      <div className="col-md-6">
                        <label className="form-label text-white fw-bold">
                          Abnahmeintervall Lieferant
                        </label>
                        <input 
                          type="number"
                          className="form-control form-control-lg"
                          min="1"
                          step="1"
                          value={staffelAbnahmeintervall}
                          onChange={(e) => setStaffelAbnahmeintervall(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057', fontSize: '1.2rem'}}
                        />
                        <small className="text-muted">Stück (Mindestbestellmenge Lieferant)</small>
                      </div>

                      {/* EK pro Stück */}
                      <div className="col-md-6">
                        <label className="form-label text-white fw-bold">
                          EK / Stück (netto)
                        </label>
                        <div className="input-group input-group-lg">
                          <input 
                            type="number"
                            className="form-control"
                            min="0.01"
                            step="0.01"
                            value={staffelG2EK}
                            onChange={(e) => setStaffelG2EK(e.target.value)}
                            style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057', fontSize: '1.2rem'}}
                          />
                          <span className="input-group-text" style={{backgroundColor: '#495057', color: '#fff'}}>€</span>
                        </div>
                      </div>

                      {/* Mindest-EK */}
                      <div className="col-md-6">
                        <label className="form-label text-white fw-bold">
                          Mindest-EK (Erstbestellung)
                        </label>
                        <div className="input-group input-group-lg">
                          <input 
                            type="number"
                            className="form-control"
                            min="0.01"
                            step="0.01"
                            value={staffelMindestWert}
                            onChange={(e) => setStaffelMindestWert(e.target.value)}
                            style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057', fontSize: '1.2rem'}}
                          />
                          <span className="input-group-text" style={{backgroundColor: '#495057', color: '#fff'}}>€</span>
                        </div>
                        <small className="text-muted">Mindestwarenwert EK für erste Staffel</small>
                      </div>

                      {/* Warengruppe */}
                      <div className="col-md-12">
                        <label className="form-label text-white fw-bold">
                          Warengruppe
                        </label>
                        <select 
                          className="form-control form-control-lg"
                          value={staffelG2Warengruppe}
                          onChange={(e) => setStaffelG2Warengruppe(e.target.value)}
                          style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057', fontSize: '1.1rem'}}
                        >
                          {sheets.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <hr className="my-4" style={{borderColor: '#495057'}}/>

                    {/* Schwellen (EK) */}
                    <div className="mb-3">
                      <label className="form-label text-white fw-bold">
                        <i className="bi bi-graph-up-arrow me-2"/>
                        EK-Schwellen für Staffelgrenzen
                      </label>
                      <div className="d-flex flex-wrap gap-2">
                        {staffelSchwellen.map((s, idx) => (
                          <div key={idx} className="input-group" style={{width: 'auto'}}>
                            <span className="input-group-text" style={{backgroundColor: '#495057', color: '#fff'}}>EK €</span>
                            <input 
                              type="number"
                              className="form-control"
                              value={s.wert}
                              onChange={(e) => {
                                const newSchwellen = [...staffelSchwellen]
                                newSchwellen[idx].wert = e.target.value
                                setStaffelSchwellen(newSchwellen)
                              }}
                              style={{width: '80px', backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057'}}
                            />
                            <button 
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => {
                                const newSchwellen = staffelSchwellen.filter((_, i) => i !== idx)
                                setStaffelSchwellen(newSchwellen)
                              }}
                            >
                              <i className="bi bi-x"/>
                            </button>
                          </div>
                        ))}
                        {staffelSchwellen.length < 7 && (
                          <button 
                            className="btn btn-outline-success"
                            onClick={() => setStaffelSchwellen([...staffelSchwellen, { wert: '' }])}
                          >
                            <i className="bi bi-plus"/> Schwelle
                          </button>
                        )}
                      </div>
                      <small className="text-muted">EK-Werte bei denen neue Staffelstufen erstellt werden (max. 7)</small>
                    </div>

                    {/* Rundung */}
                    <div className="mb-3">
                      <label className="form-label text-white fw-bold">
                        Rundung (Schöne Zahlen)
                      </label>
                      <textarea 
                        className="form-control"
                        rows="2"
                        value={staffelRundung}
                        onChange={(e) => setStaffelRundung(e.target.value)}
                        placeholder="3,5,10,15,20,25,30,40,50,75,100..."
                        style={{backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057'}}
                      />
                      <small className="text-muted">Kommagetrennte Werte für Mengenrundung</small>
                    </div>

                    {/* Berechnen Button */}
                    <button 
                      className="btn btn-primary btn-lg w-100 mt-3"
                      disabled={staffelLoading}
                      onClick={async () => {
                        setStaffelLoading(true)
                        try {
                          const ek = parseFloat(staffelG2EK) || 1
                          const ve = parseInt(staffelVE) || 1
                          const abnahme = parseInt(staffelAbnahmeintervall) || 1
                          const mindestEK = parseFloat(staffelMindestWert) || 2
                          
                          // Parse Rundungswerte
                          const rundungswerte = staffelRundung.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0).sort((a,b) => a - b)
                          
                          // Hilfsfunktion: Auf schöne Zahl AUFRUNDEN (für Mindestmenge)
                          const rundeAufSchoeneAuf = (menge) => {
                            if (rundungswerte.length === 0) return menge
                            for (const r of rundungswerte) {
                              if (r >= menge) return r
                            }
                            // Größer als alle → auf nächstes Vielfaches des größten runden
                            const max = rundungswerte[rundungswerte.length - 1]
                            return Math.ceil(menge / max) * max
                          }
                          
                          // Hilfsfunktion: Auf NÄCHSTE schöne Zahl runden (für weitere Staffeln)
                          const rundeAufSchoeneNaechste = (menge) => {
                            if (rundungswerte.length === 0) return menge
                            // Finde die beiden nächsten schönen Zahlen (unter und über)
                            let unter = null
                            let ueber = null
                            for (const r of rundungswerte) {
                              if (r <= menge) unter = r
                              if (r >= menge && ueber === null) ueber = r
                            }
                            // Falls größer als alle: auf Vielfaches runden
                            if (ueber === null) {
                              const max = rundungswerte[rundungswerte.length - 1]
                              return Math.round(menge / max) * max
                            }
                            // Falls kleiner als alle: aufrunden
                            if (unter === null) return ueber
                            // Wähle die nähere
                            const distUnter = menge - unter
                            const distUeber = ueber - menge
                            return distUnter <= distUeber ? unter : ueber
                          }
                          
                          // Hilfsfunktion: Auf VE und Abnahmeintervall runden
                          const rundeAufVielfaches = (menge) => {
                            // Muss Vielfaches von VE sein
                            let gerundet = Math.ceil(menge / ve) * ve
                            // Muss auch Vielfaches von Abnahmeintervall sein
                            gerundet = Math.ceil(gerundet / abnahme) * abnahme
                            return gerundet
                          }
                          
                          // 1. Mindestbestellmenge berechnen (IMMER AUFRUNDEN)
                          // Berechne die Menge, die mindestens benötigt wird für MindestEK
                          const mindestMengeAusEK = Math.ceil(mindestEK / ek)
                          
                          // Mindestmenge ist das MAXIMUM von VE oder der berechneten Menge
                          let mindestMenge = Math.max(ve, mindestMengeAusEK)
                          
                          // Auf schöne Zahl AUFRUNDEN
                          mindestMenge = rundeAufSchoeneAuf(mindestMenge)
                          
                          // Muss Vielfaches des Abnahmeintervalls sein
                          mindestMenge = Math.ceil(mindestMenge / abnahme) * abnahme
                          
                          // 2. Staffeln berechnen
                          const staffeln = [{
                            ab: mindestMenge,
                            ekGesamt: mindestMenge * ek,
                            label: 'Mindestmenge'
                          }]
                          
                          // Parse Schwellen und sortieren
                          const schwellenWerte = staffelSchwellen
                            .map(s => parseFloat(s.wert))
                            .filter(w => !isNaN(w) && w > 0)
                            .sort((a, b) => a - b)
                          
                          // Mindestabstand zwischen Staffeln (20% der vorherigen Menge)
                          const MINDEST_ABSTAND_FAKTOR = 1.3
                          
                          // Für jede Schwelle: Menge berechnen
                          for (const schwelle of schwellenWerte) {
                            const mengeRoh = schwelle / ek
                            let menge = rundeAufVielfaches(Math.ceil(mengeRoh))
                            menge = rundeAufSchoeneNaechste(menge) // Auf NÄCHSTE schöne Zahl
                            
                            // Muss Vielfaches von VE und Abnahme sein
                            menge = rundeAufVielfaches(menge)
                            
                            // Nur hinzufügen wenn deutlich größer als letzte Staffel
                            const letzteStaffel = staffeln[staffeln.length - 1]
                            if (menge > letzteStaffel.ab * MINDEST_ABSTAND_FAKTOR) {
                              staffeln.push({
                                ab: menge,
                                ekGesamt: menge * ek,
                                label: `ab ${schwelle}€ EK`
                              })
                            }
                          }
                          
                          // g2-Preise berechnen für jede Staffel
                          // Lade zuerst die g2-Config und Formeln
                          const configRes = await fetch('/api/preise/g2/config')
                          const configData = await configRes.json()
                          let g2Config = {
                            gstart_ek: 12,
                            gneu_ek: 100,
                            gneu_vk: 189,
                            fixcost1: 0.35,
                            fixcost2: 1.4,
                            varpct1: 0.25,
                            varpct2: 0.02,
                            aufschlag: 1.08,
                            shp_fac: 0.92
                          }
                          if (configData.ok && configData.configs?.length > 0) {
                            const savedConfig = configData.configs.find(c => c.warengruppe === staffelG2Warengruppe) || configData.configs[0]
                            g2Config = { ...g2Config, ...savedConfig }
                          }
                          
                          // Lade Formel-Regler
                          const formelRes = await fetch('/api/preise/formeln')
                          const formelData = await formelRes.json()
                          const selectedFormel = (formelData.formeln || []).find(s => s.sheet === staffelG2Warengruppe) || formelData.formeln?.[0]
                          
                          if (!selectedFormel?.regler) {
                            throw new Error('Keine Preisformel für Warengruppe gefunden')
                          }
                          
                          const staffelnMitPreis = await Promise.all(staffeln.map(async (s, idx) => {
                            try {
                              // Paket-EK für die Staffelmenge
                              const paketEK = ek * s.ab
                              
                              const res = await fetch('/api/preise/g2/berechnen', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  ek: paketEK,
                                  warengruppe_regler: selectedFormel.regler,
                                  g2_params: g2Config,
                                  staffel_mengen: [1]
                                })
                              })
                              const data = await res.json()
                              
                              // shop_unit ist der VK pro Stück (Paket-VK / Menge)
                              const vkProStueck = data.ok ? (data.shop_unit || data.plattform_unit || 0) : 0
                              
                              return {
                                ...s,
                                vkProStueck: parseFloat(vkProStueck.toFixed(2)),
                                vkGesamt: parseFloat((vkProStueck * s.ab).toFixed(2)),
                                rabatt: idx > 0 ? (idx * 3) : 0
                              }
                            } catch (e) {
                              console.error('Preisberechnung Fehler:', e)
                              return { ...s, vkProStueck: 0, vkGesamt: 0, rabatt: 0 }
                            }
                          }))
                          
                          setStaffelGrenzen(staffelnMitPreis)
                          setStaffelAuswahlMenge(staffelnMitPreis[0]?.ab || mindestMenge)
                          
                        } catch (e) {
                          console.error('Fehler bei Staffelberechnung:', e)
                          alert('Fehler: ' + e.message)
                        }
                        setStaffelLoading(false)
                      }}
                    >
                      {staffelLoading ? (
                        <><span className="spinner-border spinner-border-sm me-2"/>Berechne...</>
                      ) : (
                        <><i className="bi bi-calculator me-2"/>Staffelgrenzen berechnen</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Rechte Spalte: Ausgabe */}
              <div className="col-md-7">
                {staffelGrenzen.length > 0 ? (
                  <div className="card bg-dark border-success">
                    <div className="card-header bg-success text-white">
                      <strong><i className="bi bi-table me-2"/>Berechnete Staffeltabelle</strong>
                    </div>
                    <div className="card-body">
                      {/* Staffeltabelle im Shop-Style */}
                      <div className="table-responsive">
                        <table className="table table-dark table-hover mb-0" style={{fontSize: '1.1rem'}}>
                          <thead>
                            <tr className="bg-secondary">
                              <th className="text-center" style={{width: '80px'}}>Auswahl</th>
                              <th>Menge</th>
                              <th className="text-end">Preis/Stück</th>
                              <th className="text-end">Gesamt VK</th>
                              <th className="text-end">Gesamt EK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffelGrenzen.map((s, idx) => (
                              <tr 
                                key={idx} 
                                className={staffelAuswahlMenge === s.ab ? 'table-success' : ''}
                                style={{cursor: 'pointer'}}
                                onClick={() => setStaffelAuswahlMenge(s.ab)}
                              >
                                <td className="text-center">
                                  <input 
                                    type="radio" 
                                    name="staffelAuswahl"
                                    checked={staffelAuswahlMenge === s.ab}
                                    onChange={() => setStaffelAuswahlMenge(s.ab)}
                                    style={{width: '20px', height: '20px'}}
                                  />
                                </td>
                                <td>
                                  <strong>{s.ab} Stück</strong>
                                  {idx === 0 && <span className="badge bg-info ms-2">Mindestmenge</span>}
                                </td>
                                <td className="text-end">
                                  <strong>{s.vkProStueck?.toFixed(2)} €</strong>
                                </td>
                                <td className="text-end">
                                  {s.vkGesamt?.toFixed(2)} €
                                </td>
                                <td className="text-end text-muted">
                                  ({s.ekGesamt?.toFixed(2)} € EK)
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <hr className="my-4" style={{borderColor: '#495057'}}/>

                      {/* Mengen-Anpassung */}
                      <div className="bg-dark p-4 rounded border border-secondary">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0 text-white">
                            <i className="bi bi-cart3 me-2"/>
                            Bestellmenge anpassen
                          </h5>
                        </div>
                        
                        <div className="d-flex align-items-center justify-content-center gap-3 mb-4">
                          <button 
                            className="btn btn-outline-secondary btn-lg"
                            onClick={() => {
                              const ve = parseInt(staffelVE) || 1
                              const newMenge = Math.max(staffelGrenzen[0]?.ab || ve, (staffelAuswahlMenge || 0) - ve)
                              setStaffelAuswahlMenge(newMenge)
                            }}
                          >
                            <i className="bi bi-dash-lg"/>
                          </button>
                          
                          <div className="text-center">
                            <input 
                              type="number"
                              className="form-control form-control-lg text-center"
                              style={{width: '150px', fontSize: '1.5rem', backgroundColor: '#2b3035', color: '#fff', borderColor: '#495057'}}
                              value={staffelAuswahlMenge || ''}
                              onChange={(e) => setStaffelAuswahlMenge(parseInt(e.target.value) || 0)}
                            />
                            <small className="text-muted">Stück</small>
                          </div>
                          
                          <button 
                            className="btn btn-outline-secondary btn-lg"
                            onClick={() => {
                              const ve = parseInt(staffelVE) || 1
                              setStaffelAuswahlMenge((staffelAuswahlMenge || 0) + ve)
                            }}
                          >
                            <i className="bi bi-plus-lg"/>
                          </button>
                        </div>

                        {/* Warenkorbwert */}
                        {(() => {
                          const menge = staffelAuswahlMenge || 0
                          const staffel = [...staffelGrenzen].reverse().find(s => menge >= s.ab) || staffelGrenzen[0]
                          const gesamtVK = staffel ? (staffel.vkProStueck * menge) : 0
                          const gesamtEK = menge * (parseFloat(staffelG2EK) || 0)
                          
                          return (
                            <div className="text-center">
                              <div className="display-6 text-success mb-2">
                                {gesamtVK.toFixed(2)} € <small className="text-muted fs-5">inkl. MwSt.</small>
                              </div>
                              <div className="text-muted">
                                ({(gesamtVK / 1.19).toFixed(2)} € netto | EK: {gesamtEK.toFixed(2)} €)
                              </div>
                              <div className="text-muted small mt-1">
                                Preis/Stück: {staffel?.vkProStueck?.toFixed(2) || '0.00'} €
                              </div>
                              
                              <button className="btn btn-success btn-lg mt-4 px-5">
                                <i className="bi bi-cart-plus me-2"/>
                                In den Warenkorb
                              </button>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card bg-dark border-secondary h-100">
                    <div className="card-body d-flex align-items-center justify-content-center">
                      <div className="text-center text-muted">
                        <i className="bi bi-table display-1 mb-3"/>
                        <p className="mb-0">
                          Klicke auf <strong>"Staffelgrenzen berechnen"</strong> um die Mengenstaffeln zu generieren.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
