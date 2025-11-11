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
  
  // Vergleich-Tab
  const [vergleichEk, setVergleichEk] = useState('10')
  const [selectedFormeln, setSelectedFormeln] = useState(['lagerware', 'klingspor_fremdlager'])
  const [vergleichData, setVergleichData] = useState([])

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

      // Alte Chart löschen
      const existingChart = window.Chart.getChart('vergleichChart')
      if (existingChart) existingChart.destroy()

      // EK-Range generieren (0 bis 2x vergleichEk)
      const maxEk = parseFloat(vergleichEk) * 2
      const ekRange = []
      for (let i = 0; i <= 20; i++) {
        ekRange.push((maxEk / 20) * i)
      }

      // Datasets für jede Formel
      const datasets = vergleichData.map((d, idx) => {
        const colors = ['#F6B10A', '#2fb97f', '#17a2b8', '#e44c4c', '#667eea', '#ff6b6b', '#4ecdc4']
        return {
          label: d.name + ' (Shop)',
          data: ekRange.map(ek => {
            // Berechnung simulieren (vereinfacht)
            const ratio = d.shop / parseFloat(vergleichEk)
            return ek * ratio
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.4
        }
      })

      new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ekRange.map(ek => ek.toFixed(0) + '€'),
          datasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'VK (Shop) in Abhängigkeit vom EK' }
          },
          scales: {
            x: { title: { display: true, text: 'EK (€)' } },
            y: { title: { display: true, text: 'VK (€)' }, beginAtZero: true }
          }
        }
      })
    }
  }, [vergleichData, vergleichEk])

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
      const data = await res.json()
      if (data.ok) {
        setErgebnisse(data.ergebnisse)
      }
    } catch (e) {
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
      <div className="card-header py-2">
        <h5 className="mb-0"><i className="bi bi-calculator mr-2"/>Preisberechnung</h5>
      </div>
      <div className="card-body py-2">
        {/* Haupt-Tabs */}
        <div className="btn-group btn-group-sm mb-3 w-100">
          <button 
            className={`btn ${tab === 'alte_pb' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('alte_pb')}
          >
            Alte PB
          </button>
          <button 
            className={`btn ${tab === 'neue_2025' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('neue_2025')}
          >
            Neue ab 2025-11 (g2)
          </button>
          <button 
            className={`btn ${tab === 'vergleich' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('vergleich')}
          >
            <i className="bi bi-bar-chart mr-1"/>Vergleich
          </button>
        </div>

        {tab === 'alte_pb' && (
          <>
            {/* Sheet-Tabs */}
            <div className="mb-2">
              <ul className="nav nav-pills nav-fill" style={{fontSize: '0.85rem'}}>
                {sheets.map(s => (
                  <li className="nav-item" key={s.id}>
                    <a 
                      className={`nav-link py-1 px-2 ${sheet === s.id ? 'active' : ''}`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setSheet(s.id); }}
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warengruppen */}
            <div className="alert alert-info mb-2 py-2">
              <small><strong>Warengruppen:</strong> {currentFormel.warengruppen.map(w => w.name).join(', ')}</small>
            </div>

            {/* Regler */}
            <div className="card mb-4">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Konfiguration</h5>
                {reglerEdited && (
                  <button className="btn btn-sm btn-warning" onClick={speichernRegler}>
                    <i className="bi bi-save mr-1"/>Änderungen speichern
                  </button>
                )}
              </div>
              <div className="card-body">
                {/* Kosten - variabel */}
                <div className="mb-3">
                  <div className="bg-warning text-dark font-weight-bold px-3 py-2 mb-2" style={{fontSize: '0.95rem'}}>
                    Kosten - variabel
                  </div>
                  <div className="row">
                    <div className="col-md-4 mb-2">
                      <label className="font-weight-bold small">Mwst.</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={(currentFormel.regler.mwst * 100).toFixed(2)}
                          onChange={(e) => updateRegler('mwst', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 mb-2">
                      <label className="font-weight-bold small">Ebay/Amazon</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={(currentFormel.regler.ebay_amazon * 100).toFixed(2)}
                          onChange={(e) => updateRegler('ebay_amazon', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 mb-2">
                      <label className="font-weight-bold small">Paypal</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
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
                <div className="mb-3">
                  <div className="bg-warning text-dark font-weight-bold px-3 py-2 mb-2" style={{fontSize: '0.95rem'}}>
                    Kosten - statisch
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold small">Paypal Fix</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.paypal_fix}
                        onChange={(e) => updateRegler('paypal_fix', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-2">
                      <label className="font-weight-bold small">Fixkosten Beitrag</label>
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
                <div className="mb-3">
                  <div className="bg-light text-dark font-weight-bold px-3 py-2 mb-2" style={{fontSize: '0.95rem'}}>
                    Regler
                  </div>
                  <div className="row">
                    <div className="col mb-2">
                      <label className="font-weight-bold small">Gewinn Regler 1 a</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_1a}
                        onChange={(e) => updateRegler('gewinn_regler_1a', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold small">Gewinn Regler 2 c</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_2c}
                        onChange={(e) => updateRegler('gewinn_regler_2c', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold small">Gewinn Regler 3 e</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm" 
                        value={currentFormel.regler.gewinn_regler_3e}
                        onChange={(e) => updateRegler('gewinn_regler_3e', e.target.value)}
                      />
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold small">Prozent Aufschlag</label>
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={(currentFormel.regler.prozent_aufschlag * 100).toFixed(2)}
                          onChange={(e) => updateRegler('prozent_aufschlag', parseFloat(e.target.value) / 100)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="col mb-2">
                      <label className="font-weight-bold small">A.A. Threshold</label>
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
            </div>

            {/* EK-Eingabe */}
            <div className="card mb-3 border-primary">
              <div className="card-header bg-primary text-white py-2">
                <h6 className="mb-0">EK-Eingabe</h6>
              </div>
              <div className="card-body py-3">
                <div className="row align-items-end">
                  <div className="col-md-8">
                    <label className="font-weight-bold small">EK-Stück netto (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      placeholder="z.B. 10.50"
                      value={ek}
                      onChange={(e) => setEk(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && berechnePreise()}
                    />
                  </div>
                  <div className="col-md-4">
                    <button 
                      className="btn btn-warning btn-block font-weight-bold" 
                      onClick={berechnePreise}
                      disabled={loading || !ek}
                    >
                      {loading ? <span className="spinner-border spinner-border-sm mr-2"/> : <i className="bi bi-calculator mr-2"/>}
                      Berechnen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* VK-Ergebnisse */}
            {ergebnisse.length > 0 && (
              <div>
                {/* Plattformpreis */}
                <div className="card border-primary mb-3">
                  <div className="card-header bg-primary text-white py-2">
                    <h6 className="mb-0">Netto Plattformpreis (eBay/Amazon)</h6>
                  </div>
                  <div className="card-body text-center py-3">
                    <div className="h2 font-weight-bold text-primary mb-0">
                      {(ergebnisse[0]?.vk_netto || 0).toFixed(2)} €
                    </div>
                    <small className="text-muted">pro Stück (netto)</small>
                  </div>
                </div>

                {/* Shop-Staffelpreise */}
                <div className="card border-success">
                  <div className="card-header bg-success text-white py-2">
                    <h6 className="mb-0">Netto Shop Staffelpreise (SHOP - 8%)</h6>
                  </div>
                  <div className="card-body py-3">
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered text-center mb-0">
                        <thead className="thead-light">
                          <tr className="font-weight-bold">
                            {ergebnisse.map(e => (
                              <th key={e.ve} className="py-2">{e.ve}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {ergebnisse.map(e => (
                              <td key={e.ve} className="font-weight-bold text-success" style={{fontSize: '1.1rem'}}>
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
          <PreiseG2Module />
        )}

        {tab === 'vergleich' && (
          <div>
            {/* EK-Eingabe für Vergleich */}
            <div className="card mb-3 border-info">
              <div className="card-header bg-info text-white py-2">
                <h6 className="mb-0">EK für Vergleich</h6>
              </div>
              <div className="card-body py-3">
                <div className="row">
                  <div className="col-md-6">
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      placeholder="EK in €"
                      value={vergleichEk}
                      onChange={e => setVergleichEk(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <button className="btn btn-info btn-block font-weight-bold" onClick={async () => {
                      if (!vergleichEk || formeln.length === 0) return
                      const ek = parseFloat(vergleichEk)
                      const comparisons = []
                      
                      for (const formel of formeln) {
                        if (selectedFormeln.includes(formel.sheet)) {
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
                            comparisons.push({
                              name: formel.name,
                              sheet: formel.sheet,
                              plattform: data.ergebnisse[0].vk_netto,
                              shop: data.ergebnisse[0].vk_shop_netto
                            })
                          }
                        }
                      }
                      setVergleichData(comparisons)
                    }}>
                      <i className="bi bi-calculator mr-2"/>Vergleich berechnen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Formeln auswählen */}
            <div className="card mb-3">
              <div className="card-header py-2">
                <h6 className="mb-0">Formeln für Vergleich auswählen</h6>
              </div>
              <div className="card-body py-2">
                <div className="row">
                  {formeln.map(f => (
                    <div className="col-md-3 mb-2" key={f.sheet}>
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
                        <label className="custom-control-label small" htmlFor={`check_${f.sheet}`}>
                          {f.name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Vergleichstabelle */}
            {vergleichData.length > 0 && (
              <div className="card border-success mb-3">
                <div className="card-header bg-success text-white py-2">
                  <h6 className="mb-0">Preisvergleich bei EK = {vergleichEk}€</h6>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-striped table-sm mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Warengruppe</th>
                          <th className="text-right">Plattformpreis (netto)</th>
                          <th className="text-right">Shop-Preis (netto)</th>
                          <th className="text-right">Differenz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vergleichData.map((d, idx) => (
                          <tr key={idx}>
                            <td className="font-weight-bold">{d.name}</td>
                            <td className="text-right">{d.plattform.toFixed(2)} €</td>
                            <td className="text-right text-success font-weight-bold">{d.shop.toFixed(2)} €</td>
                            <td className="text-right text-muted">{(d.plattform - d.shop).toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Liniendiagramm */}
            {vergleichData.length > 0 && (
              <div className="card border-info">
                <div className="card-header bg-info text-white py-2">
                  <h6 className="mb-0">Preisverlauf (EK → VK)</h6>
                </div>
                <div className="card-body">
                  <canvas id="vergleichChart" style={{maxHeight: '400px'}}></canvas>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
