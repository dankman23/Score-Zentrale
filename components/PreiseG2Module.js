'use client'

import { useState, useEffect } from 'react'

export default function PreiseG2Module({ formeln }) {
  const [warengruppe, setWarengruppe] = useState('lagerware')
  const [ekInput, setEkInput] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [plattformpreis, setPlattformpreis] = useState(0)
  const [shoppreis, setShoppreis] = useState(0)
  const [loading, setLoading] = useState(false)
  const [configEdited, setConfigEdited] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)

  // g2-Parameter (artikelspezifisch)
  const [g2Params, setG2Params] = useState({
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
  })

  const berechneG2 = async () => {
    if (!ekInput || !formeln || formeln.length === 0) return
    
    const selectedFormel = formeln.find(f => f.sheet === warengruppe)
    if (!selectedFormel) return

    setLoading(true)
    try {
      const res = await fetch('/api/preise/g2/berechnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ek: parseFloat(ekInput),
          warengruppe_regler: selectedFormel.regler,
          g2_params: g2Params,
          staffel_mengen: [1, 5, 10, 20, 50, 100, 200, 500]
        })
      })
      const data = await res.json()
      if (data.ok) {
        setErgebnisse(data.ergebnisse || [])
        setPlattformpreis(data.plattform_unit || 0)
        setShoppreis(data.shop_unit || 0)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setLoading(false)
  }

  const updateParam = (key, value) => {
    setG2Params({ ...g2Params, [key]: parseFloat(value) || 0 })
    setConfigEdited(true)
  }

  const speichernConfig = async () => {
    try {
      const res = await fetch('/api/preise/g2/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warengruppe,
          params: g2Params
        })
      })
      if (res.ok) {
        alert('✅ Konfiguration gespeichert!')
        setConfigEdited(false)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
  }

  return (
    <div className="card">
      <div className="card-header py-2">
        <h5 className="mb-0"><i className="bi bi-calculator-fill mr-2"/>Neue Preisberechnung (g2)</h5>
      </div>
      <div className="card-body py-2">
        {/* Warengruppe auswählen */}
        <div className="card mb-2 border-warning">
          <div className="card-header bg-warning text-dark py-1">
            <small className="mb-0 font-weight-bold">Warengruppe (Regler 1a, 2c, 3e)</small>
          </div>
          <div className="card-body py-2">
            <select 
              className="form-control form-control-sm" 
              value={warengruppe}
              onChange={e => setWarengruppe(e.target.value)}
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
        </div>

        {/* g2-Parameter */}
        <div className="card mb-2">
          <div className="card-header py-1 d-flex justify-content-between">
            <small className="mb-0 font-weight-bold">g2-Parameter (artikelspezifisch)</small>
            {configEdited && (
              <button className="btn btn-xs btn-warning py-0 px-2" onClick={speichernConfig}>
                <i className="bi bi-save mr-1"/>Speichern
              </button>
            )}
          </div>
          <div className="card-body py-2">
            <div className="row">
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>gstart_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={g2Params.gstart_ek} onChange={e => updateParam('gstart_ek', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>gneu_ek</label>
                <input type="number" step="1" className="form-control form-control-sm" value={g2Params.gneu_ek} onChange={e => updateParam('gneu_ek', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>gneu_vk</label>
                <input type="number" step="1" className="form-control form-control-sm" value={g2Params.gneu_vk} onChange={e => updateParam('gneu_vk', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>fixcost1 (pa)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.fixcost1} onChange={e => updateParam('fixcost1', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>fixcost2</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.fixcost2} onChange={e => updateParam('fixcost2', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>varpct1 (eba)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.varpct1} onChange={e => updateParam('varpct1', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>varpct2 (paypal)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.varpct2} onChange={e => updateParam('varpct2', e.target.value)} />
              </div>
              <div className="col-md-3 mb-1">
                <label style={{fontSize: '0.7rem'}}>aufschlag</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.aufschlag} onChange={e => updateParam('aufschlag', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-4 mb-1">
                <label style={{fontSize: '0.7rem'}}>shp_fac (Shop-Faktor)</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={g2Params.shp_fac} onChange={e => updateParam('shp_fac', e.target.value)} />
              </div>
              <div className="col-md-4 mb-1">
                <label style={{fontSize: '0.7rem'}}>aa_threshold</label>
                <input type="number" step="1" className="form-control form-control-sm" value={g2Params.aa_threshold} onChange={e => updateParam('aa_threshold', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* EK-Eingabe */}
        <div className="card mb-2 border-primary">
          <div className="card-header bg-primary text-white py-1">
            <small className="mb-0 font-weight-bold">EK-Eingabe (pro Stück)</small>
          </div>
          <div className="card-body py-2">
            <div className="row">
              <div className="col-md-8">
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control form-control-sm" 
                  placeholder="z.B. 2.41"
                  value={ekInput}
                  onChange={e => setEkInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && berechneG2()}
                />
              </div>
              <div className="col-md-4">
                <button className="btn btn-warning btn-sm btn-block font-weight-bold" onClick={berechneG2} disabled={loading || !ekInput}>
                  {loading ? <span className="spinner-border spinner-border-sm mr-1"/> : <i className="bi bi-calculator mr-1"/>}
                  Berechnen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ergebnisse */}
        {ergebnisse.length > 0 && (
          <div>
            {/* Plattformpreis */}
            <div className="card border-primary mb-2">
              <div className="card-header bg-primary text-white py-1">
                <small className="mb-0 font-weight-bold">Netto Plattformpreis (g2)</small>
              </div>
              <div className="card-body text-center py-2">
                <div className="h3 font-weight-bold text-primary mb-0">
                  {plattformpreis.toFixed(2)} €
                </div>
                <small className="text-muted" style={{fontSize: '0.75rem'}}>pro Stück (netto)</small>
              </div>
            </div>

            {/* Shop-Staffelpreise */}
            <div className="card border-success">
              <div className="card-header bg-success text-white py-1">
                <small className="mb-0 font-weight-bold">Netto Shop Staffelpreise (shp_fac = {(g2Params.shp_fac*100).toFixed(0)}%)</small>
              </div>
              <div className="card-body py-2">
                <div className="table-responsive">
                  <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.9rem'}}>
                    <thead className="thead-light">
                      <tr className="font-weight-bold" style={{fontSize: '0.8rem'}}>
                        {ergebnisse.map(e => (
                          <th key={e.staffel} className="py-1 px-1">{e.staffel}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {ergebnisse.map(e => (
                          <td key={e.staffel} className="font-weight-bold text-success py-1 px-1">
                            {e.shop_unit.toFixed(2)} €
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
      </div>
    </div>
  )
}
