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
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>c</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.c} onChange={e => updateParam('c', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>a</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.a} onChange={e => updateParam('a', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>pa</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.pa} onChange={e => updateParam('pa', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>fixcost1</label>
                <input type="number" step="0.1" className="form-control form-control-sm" value={params.fixcost1} onChange={e => updateParam('fixcost1', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>fixcost2</label>
                <input type="number" step="0.1" className="form-control form-control-sm" value={params.fixcost2} onChange={e => updateParam('fixcost2', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>aufschlag</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.aufschlag} onChange={e => updateParam('aufschlag', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>varpct1</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.varpct1} onChange={e => updateParam('varpct1', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>varpct2</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.varpct2} onChange={e => updateParam('varpct2', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>shp_fac</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.shp_fac} onChange={e => updateParam('shp_fac', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>gstart_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={params.gstart_ek} onChange={e => updateParam('gstart_ek', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>gneu_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={params.gneu_ek} onChange={e => updateParam('gneu_ek', e.target.value)} />
              </div>
              <div className="col-md-2 mb-1">
                <label style={{fontSize: '0.7rem'}}>gneu_vk</label>
                <input type="number" step="1" className="form-control form-control-sm" value={params.gneu_vk} onChange={e => updateParam('gneu_vk', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>k (Steuerfaktor)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={params.k} onChange={e => updateParam('k', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>A.A. Threshold</label>
                <input type="number" step="1" className="form-control form-control-sm" value={params.aa_threshold} onChange={e => updateParam('aa_threshold', e.target.value)} />
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
