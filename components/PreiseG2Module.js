'use client'

import { useState } from 'react'

export default function PreiseG2Module() {
  const [ekInput, setEkInput] = useState('')
  const [ekInputPer, setEkInputPer] = useState('VE')
  const [veSize, setVeSize] = useState(10)
  const [tierSet, setTierSet] = useState('Standard')
  const [showAb1, setShowAb1] = useState(true)
  const [prettyRound, setPrettyRound] = useState(true)
  const [ergebnisse, setErgebnisse] = useState([])
  const [plattformpreis, setPlattformpreis] = useState(0)
  const [loading, setLoading] = useState(false)

  // Default Parameter
  const [params, setParams] = useState({
    c: 1.07,
    a: 0.81,
    pa: 0.35,
    fixcost1: 0,
    fixcost2: 1.4,
    varpct1: 0.25,
    varpct2: 0.02,
    aufschlag: 1.08,
    gstart_ek: 50,
    gneu_ek: 150,
    gneu_vk: 180,
    k: 1.0,
    shp_fac: 0.92,
    aa_threshold: 18
  })

  const berechneG2 = async () => {
    if (!ekInput) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/preise/g2/berechnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ek: parseFloat(ekInput),
          params,
          staffel_mengen: [1, 5, 10, 20, 50, 100, 200, 500]
        })
      })
      const data = await res.json()
      if (data.ok) {
        setErgebnisse(data.ergebnisse || [])
        setPlattformpreis(data.plattformpreis_unit || 0)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setLoading(false)
  }

  const updateParam = (key, value) => {
    setParams({ ...params, [key]: parseFloat(value) || 0 })
  }

  return (
    <div className="card">
      <div className="card-header py-2">
        <h5 className="mb-0"><i className="bi bi-calculator-fill mr-2"/>Neue Preisberechnung (g2)</h5>
      </div>
      <div className="card-body py-2">
        {/* Regler kompakt */}
        <div className="card mb-2">
          <div className="card-header py-1">
            <small className="mb-0 font-weight-bold">Regler & Parameter</small>
          </div>
          <div className="card-body py-2">
            <div className="row">
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Regler a</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.a} onChange={e => updateRegler('a', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Regler c</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.c} onChange={e => updateRegler('c', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Regler pa</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.pa} onChange={e => updateRegler('pa', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Fixkosten</label>
                <input type="number" step="0.1" className="form-control form-control-sm" value={regler.fixcost} onChange={e => updateRegler('fixcost', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Aufschlag</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.aufschlag} onChange={e => updateRegler('aufschlag', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">PriceDiscounter</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.price_discounter} onChange={e => updateRegler('price_discounter', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">ShopModifier</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={regler.shop_modifier} onChange={e => updateRegler('shop_modifier', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">gstart_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={regler.gstart_ek} onChange={e => updateRegler('gstart_ek', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">gneu_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={regler.gneu_ek} onChange={e => updateRegler('gneu_ek', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">gneu_vk</label>
                <input type="number" step="1" className="form-control form-control-sm" value={regler.gneu_vk} onChange={e => updateRegler('gneu_vk', e.target.value)} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">A.A. Threshold</label>
                <input type="number" step="1" className="form-control form-control-sm" value={regler.aa_threshold} onChange={e => updateRegler('aa_threshold', e.target.value)} />
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
            <div className="row">
              <div className="col-md-3 mb-2">
                <label className="small font-weight-bold">EK-Wert</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  placeholder="z.B. 24.10"
                  value={ekInput}
                  onChange={e => setEkInput(e.target.value)}
                />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Eingabe je</label>
                <select className="form-control" value={ekInputPer} onChange={e => setEkInputPer(e.target.value)}>
                  <option value="VE">VE</option>
                  <option value="Stück">Stück</option>
                </select>
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">VE-Größe</label>
                <input type="number" className="form-control" value={veSize} onChange={e => setVeSize(parseInt(e.target.value))} />
              </div>
              <div className="col-md-2 mb-2">
                <label className="small font-weight-bold">Tier-Set</label>
                <select className="form-control" value={tierSet} onChange={e => setTierSet(e.target.value)}>
                  <option value="Basis">Basis</option>
                  <option value="Standard">Standard</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="col-md-3 mb-2 d-flex align-items-end">
                <button className="btn btn-warning btn-block font-weight-bold" onClick={berechneG2} disabled={loading || !ekInput}>
                  {loading ? <span className="spinner-border spinner-border-sm mr-2"/> : <i className="bi bi-calculator mr-2"/>}
                  Berechnen
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <div className="custom-control custom-checkbox">
                  <input type="checkbox" className="custom-control-input" id="showAb1" checked={showAb1} onChange={e => setShowAb1(e.target.checked)} />
                  <label className="custom-control-label small" htmlFor="showAb1">"ab 1" Zeile anzeigen (+2%)</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="custom-control custom-checkbox">
                  <input type="checkbox" className="custom-control-input" id="prettyRound" checked={prettyRound} onChange={e => setPrettyRound(e.target.checked)} />
                  <label className="custom-control-label small" htmlFor="prettyRound">Schöne Rundung (große Mengen)</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ergebnisse */}
        {ergebnisse.length > 0 && (
          <div>
            {/* Plattformpreis */}
            <div className="card border-primary mb-3">
              <div className="card-header bg-primary text-white py-2">
                <h6 className="mb-0">Netto Plattformpreis (ab VE)</h6>
              </div>
              <div className="card-body text-center py-3">
                <div className="h2 font-weight-bold text-primary mb-0">
                  {plattformpreis.toFixed(2)} €
                </div>
                <small className="text-muted">pro Stück (netto)</small>
              </div>
            </div>

            {/* Shop-Staffelpreise */}
            <div className="card border-success">
              <div className="card-header bg-success text-white py-2">
                <h6 className="mb-0">Netto Shop Staffelpreise (ShopModifier = {(regler.shop_modifier * 100).toFixed(0)}%)</h6>
              </div>
              <div className="card-body py-3">
                <div className="table-responsive">
                  <table className="table table-sm table-bordered text-center mb-0">
                    <thead className="thead-light">
                      <tr>
                        <th className="font-weight-bold">Anzahl</th>
                        <th className="font-weight-bold">Preis pro Stück (netto)</th>
                        <th className="font-weight-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ergebnisse.map((tier, idx) => (
                        <tr key={idx} className={!tier.selectable ? 'table-secondary' : ''}>
                          <td className="font-weight-bold">{tier.label}</td>
                          <td className="text-success font-weight-bold" style={{fontSize: '1.1rem'}}>
                            {tier.unitPriceShop.toFixed(2)} €
                          </td>
                          <td>
                            {tier.selectable ? (
                              <span className="badge badge-success">Kaufbar</span>
                            ) : (
                              <span className="badge badge-secondary">Nur Anzeige</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
