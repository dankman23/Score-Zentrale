'use client'
import { useState, useEffect } from 'react'

export default function PreiseG2Module({ formeln }) {
  const [warengruppe, setWarengruppe] = useState('lagerware')
  const [ekInput, setEkInput] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [plattformpreis, setPlattformpreis] = useState(0)
  
  // Alle Staffelsystem-Ergebnisse
  const [ergebnisseStandard, setErgebnisseStandard] = useState([])
  const [ergebnisseKategorie, setErgebnisseKategorie] = useState([])
  const [ergebnisseGerundet, setErgebnisseGerundet] = useState([])
  const [loading, setLoading] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  const [g2ParamsEdited, setG2ParamsEdited] = useState(false)
  
  // Staffelsystem-Auswahl
  const [staffelSystem, setStaffelSystem] = useState('standard') // 'standard', 'kategorie', 'kategorie_gerundet'
  
  // Chart und Upload
  const [chartData, setChartData] = useState(null)
  const [uploadedData, setUploadedData] = useState(null)

  const [g2Params, setG2Params] = useState({
    gstart_ek: 12, gneu_ek: 100, gneu_vk: 189,
    fixcost1: 0.35, fixcost2: 1.4,
    varpct1: 0.25, varpct2: 0.02,
    aufschlag: 1.08, shp_fac: 0.92
  })
  
  // Lade g2-Konfiguration beim Start
  useEffect(() => {
    loadG2Config()
  }, [warengruppe])
  
  const loadG2Config = async () => {
    try {
      const res = await fetch('/api/preise/g2/config')
      const data = await res.json()
      if (data.ok && data.configs && data.configs.length > 0) {
        // Finde Config für aktuelle Warengruppe oder verwende erste
        const config = data.configs.find(c => c.warengruppe === warengruppe) || data.configs[0]
        setG2Params({
          gstart_ek: config.gstart_ek,
          gneu_ek: config.gneu_ek,
          gneu_vk: config.gneu_vk,
          fixcost1: config.fixcost1,
          fixcost2: config.fixcost2,
          varpct1: config.varpct1,
          varpct2: config.varpct2,
          aufschlag: config.aufschlag,
          shp_fac: config.shp_fac
        })
      }
    } catch (e) {
      console.error('Fehler beim Laden der g2-Konfiguration:', e)
    }
  }
  
  const speichernG2Config = async () => {
    if (!confirm('Möchten Sie die g2-Parameter wirklich speichern?')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/preise/g2/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warengruppe,
          params: g2Params
        })
      })
      const data = await res.json()
      if (data.ok) {
        alert('✅ G2-Parameter gespeichert!')
        setG2ParamsEdited(false)
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message)
    }
    setLoading(false)
  }
  
  const updateG2Param = (key, value) => {
    setG2Params(prev => ({ ...prev, [key]: parseFloat(value) || 0 }))
    setG2ParamsEdited(true)
  }
  
  // Berechne Staffelgrenzen basierend auf System und EK
  const berechneStaffelgrenzen = (ek, system) => {
    if (system === 'standard') {
      // Standard: Feste Grenzen
      return [1, 3, 5, 10, 25, 50, 100, 300]
    }
    
    // Kategorie-basiert - Schwellen bis ca. 5000€ Warenkorb
    let schwellen = []
    if (ek <= 30) {
      // Basis (EK ≤ 30€) - 8 Stufen bis ~5000€
      schwellen = [40, 120, 250, 450, 800, 1400, 2200, 3500]
    } else if (ek <= 150) {
      // Standard (EK 30-150€) - 8 Stufen bis ~5000€
      schwellen = [60, 180, 400, 800, 1400, 2200, 3500, 5000]
    } else {
      // High Price (EK >150€) - 6 Stufen bis ~5000€
      schwellen = [250, 600, 1200, 2000, 3500, 5000]
    }
    
    // Berechne VE-Anzahl für jede Schwelle
    let staffeln = schwellen.map(schwelle => {
      const ve = Math.ceil(schwelle / ek)
      return ve
    })
    
    // WICHTIG: Immer VE=1 am Anfang hinzufügen
    if (!staffeln.includes(1)) {
      staffeln = [1, ...staffeln]
    }
    
    // Entferne Duplikate und sortiere
    staffeln = [...new Set(staffeln)].sort((a, b) => a - b)
    
    // Begrenze auf max. 8 Staffeln
    if (staffeln.length > 8) {
      staffeln = staffeln.slice(0, 8)
    }
    
    if (system === 'kategorie_gerundet') {
      // Runde auf "schöne" Zahlen - aber behalte VE=1
      const schoeneZahlen = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1200, 1500, 2000, 2500, 3000]
      
      const gerundet = staffeln.map(ve => {
        // VE=1 immer beibehalten
        if (ve === 1) return 1
        
        // Für kleine Werte (< 10): Nächste schöne Zahl
        // Für größere Werte: Aggressive Rundung
        if (ve < 10) {
          const schoene = schoeneZahlen.find(z => z >= ve)
          return schoene || ve
        } else {
          // Bei größeren Werten: Springe zu nächster schöner Zahl (kann größer sein)
          const idx = schoeneZahlen.findIndex(z => z >= ve)
          return schoeneZahlen[idx + 1] || schoeneZahlen[idx] || ve
        }
      })
      
      // Entferne Duplikate und begrenze auf 8
      const unique = [...new Set(gerundet)].sort((a, b) => a - b).slice(0, 8)
      return unique
    }
    
    return staffeln
  }

  const berechne = async () => {
    if (!ekInput || !formeln) return
    const sel = formeln.find(f => f.sheet === warengruppe)
    if (!sel) return

    setLoading(true)
    
    const ek = parseFloat(ekInput)
    
    try {
      // Berechne immer alle drei Systeme
      const systeme = ['standard', 'kategorie', 'kategorie_gerundet']
      const results = []
      
      for (const system of systeme) {
        const staffelMengen = berechneStaffelgrenzen(ek, system)
        
        const res = await fetch('/api/preise/g2/berechnen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ek,
            warengruppe_regler: sel.regler,
            g2_params: g2Params,
            staffel_mengen: staffelMengen
          })
        })
        const data = await res.json()
        if (data.ok) {
          results.push({
            system,
            ergebnisse: data.ergebnisse || [],
            plattform: data.plattform_unit || 0,
            shop: data.shop_unit || 0
          })
        }
      }
      
      // Speichere Ergebnisse getrennt
      setErgebnisseStandard(results.find(r => r.system === 'standard')?.ergebnisse || [])
      setErgebnisseKategorie(results.find(r => r.system === 'kategorie')?.ergebnisse || [])
      setErgebnisseGerundet(results.find(r => r.system === 'kategorie_gerundet')?.ergebnisse || [])
      
      // Für Chart: Verwende ausgewähltes System
      const selected = results.find(r => r.system === staffelSystem)
      if (selected) {
        setErgebnisse(selected.ergebnisse)
        setPlattformpreis(selected.plattform)
        
        // Generiere ECHTE Chart-Daten mit API-Calls
        const chartPoints = []
        
        // 16 Punkte von 0 bis 300€ - ECHTE Berechnungen
        for (let i = 0; i <= 300; i += 20) {
          if (i === 0) {
            chartPoints.push({ ek: 0, plattform: 0, shop: 0 })
          } else {
            const res = await fetch('/api/preise/g2/berechnen', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ek: i,
                warengruppe_regler: selectedFormel.regler,
                g2_params: g2Params,
                staffel_mengen: [1]
              })
            })
            const data = await res.json()
            if (data.ok) {
              chartPoints.push({
                ek: i,
                plattform: data.plattform_unit || 0,
                shop: data.shop_unit || 0
              })
            }
          }
        }
        
        setChartData(chartPoints)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setLoading(false)
  }
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      const { parsePreisFile, intelligentSample } = await import('../app/lib/preis-utils')
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
  
  // Chart rendern
  useEffect(() => {
    if ((chartData || uploadedData) && typeof window !== 'undefined' && window.Chart) {
      const ctx = document.getElementById('g2Chart')
      if (!ctx) return

      const existingChart = window.Chart.getChart('g2Chart')
      if (existingChart) existingChart.destroy()

      const datasets = []
      
      // Berechnete Daten
      if (chartData) {
        datasets.push({
          label: 'Plattformpreis (g2)',
          data: chartData.map(d => ({ x: d.ek, y: d.plattform })),
          borderColor: '#F6B10A',
          backgroundColor: '#F6B10A20',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2
        })
        
        datasets.push({
          label: 'Shop-Preis (g2)',
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
            title: { display: true, text: 'Preisverlauf (g2)', font: { size: 13 } }
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

  return (
    <div>
      {/* Kompaktere Warengruppen-Auswahl */}
      <div className="card mb-2 border-warning">
        <div className="card-header bg-warning text-dark py-1">
          <small className="font-weight-bold" style={{fontSize: '0.85rem'}}>Warengruppe (Regler 1a, 2c, 3e)</small>
        </div>
        <div className="card-body py-1">
          <select className="form-control form-control-sm" value={warengruppe} onChange={e => setWarengruppe(e.target.value)} style={{fontSize: '0.85rem'}}>
            <option value="lagerware">Lagerware</option>
            <option value="klingspor_fremdlager">Klingspor Fremdlager</option>
            <option value="abverkauf">Abverkauf</option>
            <option value="lagerware_guenstiger_ek">Lagerware günstiger EK</option>
            <option value="pferd_fremdlager">Pferd Fremdlager</option>
            <option value="plastimex_fremdlager">Plastimex Fremdlager</option>
            <option value="alle_konfektion">Alle Konfektion</option>
          </select>
        </div>
      </div>

      {/* Staffelsystem-Auswahl */}
      <div className="card mb-2 border-info">
        <div className="card-header bg-info text-white py-1">
          <small className="font-weight-bold" style={{fontSize: '0.85rem'}}>Staffelsystem</small>
        </div>
        <div className="card-body py-1">
          <div className="btn-group btn-group-sm w-100 mb-2">
            <button 
              className={`btn ${staffelSystem === 'standard' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStaffelSystem('standard')}
              style={{fontSize: '0.75rem'}}
            >
              Standard
            </button>
            <button 
              className={`btn ${staffelSystem === 'kategorie' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStaffelSystem('kategorie')}
              style={{fontSize: '0.75rem'}}
            >
              Kategorie-basiert
            </button>
            <button 
              className={`btn ${staffelSystem === 'kategorie_gerundet' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStaffelSystem('kategorie_gerundet')}
              style={{fontSize: '0.75rem'}}
            >
              Gerundet
            </button>
          </div>
          <small className="text-muted d-block" style={{fontSize: '0.7rem'}}>
            {staffelSystem === 'standard' && '📌 Feste Grenzen: 1, 3, 5, 10, 25, 50, 100, 300'}
            {staffelSystem === 'kategorie' && '🔢 Dynamisch nach EK: Basis (≤30€), Standard (≤150€), High Price (>150€)'}
            {staffelSystem === 'kategorie_gerundet' && '✨ Wie Kategorie, aber auf schöne Zahlen gerundet'}
          </small>
        </div>
      </div>

      {/* G2-Parameter Konfiguration */}
      <div className="card mb-2">
        <div className="card-header py-1 d-flex justify-content-between align-items-center">
          <small className="mb-0 font-weight-bold" style={{cursor: 'pointer'}} onClick={() => setConfigExpanded(!configExpanded)}>
            <i className={`bi bi-chevron-${configExpanded ? 'up' : 'down'} mr-2`}/>
            G2-Konfiguration {!configExpanded && '(klicken zum Ausklappen)'}
          </small>
          {g2ParamsEdited && (
            <button 
              className="btn btn-xs btn-warning py-0 px-2" 
              onClick={speichernG2Config}
              disabled={loading}
              style={{fontSize: '0.75rem'}}
            >
              <i className="bi bi-save mr-1"/>Speichern
            </button>
          )}
        </div>
        {configExpanded && (
          <div className="card-body py-2" style={{fontSize: '0.85rem'}}>
            <div className="row mb-2">
              <div className="col-md-4">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>gstart_ek (€)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.gstart_ek} onChange={e => updateG2Param('gstart_ek', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>gneu_ek (€)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.gneu_ek} onChange={e => updateG2Param('gneu_ek', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>gneu_vk (€)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.gneu_vk} onChange={e => updateG2Param('gneu_vk', e.target.value)} />
              </div>
            </div>
            <div className="row mb-2">
              <div className="col-md-3">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>fixcost1 (€)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.fixcost1} onChange={e => updateG2Param('fixcost1', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>fixcost2 (€)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.fixcost2} onChange={e => updateG2Param('fixcost2', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>varpct1</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.varpct1} onChange={e => updateG2Param('varpct1', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>varpct2</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.varpct2} onChange={e => updateG2Param('varpct2', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-4">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>aufschlag</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.aufschlag} onChange={e => updateG2Param('aufschlag', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="font-weight-bold mb-1" style={{fontSize: '0.75rem'}}>shp_fac</label>
                <input type="number" step="0.01" className="form-control form-control-sm" 
                  value={g2Params.shp_fac} onChange={e => updateG2Param('shp_fac', e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="card mb-2 border-primary">
        <div className="card-header bg-primary text-white py-1">
          <small className="font-weight-bold" style={{fontSize: '0.85rem'}}>EK-Eingabe (pro Stück)</small>
        </div>
        <div className="card-body py-2">
          <div className="row align-items-end">
            <div className="col-md-8">
              <input 
                type="number" 
                step="0.01"
                className="form-control form-control-sm" 
                placeholder="z.B. 10.50"
                value={ekInput}
                onChange={e => setEkInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && berechne()}
                style={{fontSize: '0.9rem'}}
              />
            </div>
            <div className="col-md-4">
              <button className="btn btn-warning btn-sm btn-block font-weight-bold" onClick={berechne} disabled={loading || !ekInput} style={{fontSize: '0.85rem'}}>
                {loading ? <span className="spinner-border spinner-border-sm mr-1"/> : <i className="bi bi-calculator mr-1"/>}
                Berechnen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Glossar */}
      {ergebnisseStandard.length > 0 && (
        <div className="alert alert-info py-2 mb-2" style={{backgroundColor: '#d1ecf1', color: '#0c5460'}}>
          <strong style={{fontSize: '0.85rem', color: '#0c5460'}}>📖 Staffelsystem-Glossar:</strong>
          <ul className="mb-0 mt-1" style={{fontSize: '0.75rem', color: '#0c5460'}}>
            <li><strong>Standard:</strong> Feste VE-Mengen: 1, 3, 5, 10, 25, 50, 100, 300</li>
            <li><strong>Kategorie-basiert:</strong> VE=1 immer dabei. VE = aufrunden(Schwellenwert / EK). 
              Schwellen: Basis (≤30€): 40-3500€, Standard (30-150€): 60-5000€, High (&gt;150€): 250-5000€. Max. Warenkorbwert ~5000€.</li>
            <li><strong>Gerundet:</strong> Wie Kategorie, aber VE auf schöne Zahlen gerundet (3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100...)</li>
            <li><strong>Gesamtkosten:</strong> VE-Menge × Einzelpreis (Shop-Preis pro Stück)</li>
          </ul>
        </div>
      )}

      {/* Standard-Staffel (immer anzeigen) */}
      {ergebnisseStandard.length > 0 && (
        <div className="card border-warning mb-2">
          <div className="card-header bg-warning text-dark py-1">
            <small className="font-weight-bold">📌 Standard-Staffel (fest)</small>
          </div>
          <div className="card-body py-2 px-1">
            <div className="table-responsive">
              <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.8rem'}}>
                <thead className="thead-light">
                  <tr style={{fontSize: '0.7rem'}}>
                    <th className="py-1">VE-Menge</th>
                    {ergebnisseStandard.map(e => (
                      <th key={e.staffel} className="py-1">{e.staffel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-weight-bold">Stückpreis</td>
                    {ergebnisseStandard.map(e => (
                      <td key={e.staffel} className="text-success font-weight-bold">
                        {e.shop_unit.toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                  <tr className="table-active">
                    <td className="font-weight-bold">Gesamtkosten</td>
                    {ergebnisseStandard.map(e => (
                      <td key={e.staffel} className="text-primary font-weight-bold">
                        {(e.shop_unit * e.staffel).toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Kategorie-Staffel (wenn ausgewählt) */}
      {(staffelSystem === 'kategorie' || staffelSystem === 'kategorie_gerundet') && ergebnisseKategorie.length > 0 && (
        <div className="card border-info mb-2">
          <div className="card-header bg-info text-white py-1">
            <small className="font-weight-bold">🔢 Kategorie-basierte Staffel (dynamisch)</small>
          </div>
          <div className="card-body py-2 px-1">
            <div className="table-responsive">
              <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.8rem'}}>
                <thead className="thead-light">
                  <tr style={{fontSize: '0.7rem'}}>
                    <th className="py-1">VE-Menge</th>
                    {ergebnisseKategorie.map(e => (
                      <th key={e.staffel} className="py-1">{e.staffel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-weight-bold">Stückpreis</td>
                    {ergebnisseKategorie.map(e => (
                      <td key={e.staffel} className="text-success font-weight-bold">
                        {e.shop_unit.toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                  <tr className="table-active">
                    <td className="font-weight-bold">Gesamtkosten</td>
                    {ergebnisseKategorie.map(e => (
                      <td key={e.staffel} className="text-primary font-weight-bold">
                        {(e.shop_unit * e.staffel).toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Gerundete Staffel (nur wenn ausgewählt) */}
      {staffelSystem === 'kategorie_gerundet' && ergebnisseGerundet.length > 0 && (
        <div className="card border-success mb-2">
          <div className="card-header bg-success text-white py-1">
            <small className="font-weight-bold">✨ Gerundete Staffel (schöne Zahlen)</small>
          </div>
          <div className="card-body py-2 px-1">
            <div className="table-responsive">
              <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.8rem'}}>
                <thead className="thead-light">
                  <tr style={{fontSize: '0.7rem'}}>
                    <th className="py-1">VE-Menge</th>
                    {ergebnisseGerundet.map(e => (
                      <th key={e.staffel} className="py-1">{e.staffel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-weight-bold">Stückpreis</td>
                    {ergebnisseGerundet.map(e => (
                      <td key={e.staffel} className="text-success font-weight-bold">
                        {e.shop_unit.toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                  <tr className="table-active">
                    <td className="font-weight-bold">Gesamtkosten</td>
                    {ergebnisseGerundet.map(e => (
                      <td key={e.staffel} className="text-primary font-weight-bold">
                        {(e.shop_unit * e.staffel).toFixed(2)} €
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
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
            <strong style={{fontSize: '0.95rem'}}>Preisverlauf (g2)</strong>
          </div>
          <div className="card-body py-2">
            <div style={{height: '600px'}}>
              <canvas id="g2Chart"></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
