'use client'

import { useState, useEffect } from 'react'
import PreiseG2Module from './PreiseG2Module'

export default function PreiseModule() {
  const [tab, setTab] = useState('alte_pb')
  const [sheet, setSheet] = useState('lagerware')
  const [formeln, setFormeln] = useState([])
  const [currentFormel, setCurrentFormel] = useState(null)
  const [ek, setEk] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [loading, setLoading] = useState(false)
  const [reglerEdited, setReglerEdited] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  
  // Vergleich-Tab
  const [vergleichEk, setVergleichEk] = useState('10')
  const [selectedFormeln, setSelectedFormeln] = useState(['lagerware', 'klingspor_fremdlager'])
  const [vergleichData, setVergleichData] = useState([])
  const [vergleichModus, setVergleichModus] = useState('plattform') // 'plattform' oder 'shop'
  const [vergleichG2Enabled, setVergleichG2Enabled] = useState(false)
  const [vergleichG2Warengruppe, setVergleichG2Warengruppe] = useState('lagerware')
  const [vergleichLoading, setVergleichLoading] = useState(false)

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

  // Vergleichs-Diagramm rendern
  useEffect(() => {
    if (vergleichData.length > 0 && typeof window !== 'undefined' && window.Chart) {
      const ctx = document.getElementById('vergleichChart')
      if (!ctx) return

      const existingChart = window.Chart.getChart('vergleichChart')
      if (existingChart) existingChart.destroy()

      // Datasets - ECHTE Kurvendaten aus vergleichData
      const datasets = []
      const colors = ['#F6B10A', '#2fb97f', '#17a2b8', '#e44c4c', '#667eea', '#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#16a085', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f']
      
      vergleichData.forEach((d, idx) => {
        // Nutze die echten Kurvendaten
        const data = d.kurve.map(point => vergleichModus === 'plattform' ? point.plattform : point.shop)
        
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

      // Labels aus erster Kurve
      const labels = vergleichData[0].kurve.map(point => point.ek + '€')

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
              title: { display: true, text: 'EK (€)', font: { size: 11 } },
              ticks: { maxTicksLimit: 15, font: { size: 9 } }
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
  }, [vergleichData, vergleichModus])

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
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (e) {
      console.error('Berechnung Fehler:', e)
      alert('Fehler bei der Berechnung: ' + e.message)
    }
    setLoading(false)
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
          </>
        )}

        {tab === 'neue_2025' && (
          <PreiseG2Module formeln={formeln} />
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
                                    g2_params: {
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
                                    },
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

            {/* Liniendiagramm */}
            {vergleichData.length > 0 && (
              <div className="card border-info">
                <div className="card-header bg-info text-white py-2">
                  <strong style={{fontSize: '0.95rem'}}>Preisverlauf (EK 0-300€ → VK)</strong>
                  <small className="ml-3 text-white-50" style={{fontSize: '0.8rem'}}>
                    {vergleichData.length} Formel{vergleichData.length > 1 ? 'n' : ''} im Vergleich
                  </small>
                </div>
                <div className="card-body py-2">
                  <div style={{height: '300px'}}>
                    <canvas id="vergleichChart"></canvas>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
