'use client'
import { useState } from 'react'

export default function PreiseG2Module({ formeln }) {
  const [warengruppe, setWarengruppe] = useState('lagerware')
  const [ekInput, setEkInput] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [plattformpreis, setPlattformpreis] = useState(0)
  const [loading, setLoading] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  const [g2ParamsEdited, setG2ParamsEdited] = useState(false)

  const [g2Params, setG2Params] = useState({
    gstart_ek: 12, gneu_ek: 100, gneu_vk: 189,
    fixcost1: 0.35, fixcost2: 1.4,
    varpct1: 0.25, varpct2: 0.02,
    aufschlag: 1.08, shp_fac: 0.92
  })
  
  const updateG2Param = (key, value) => {
    setG2Params(prev => ({ ...prev, [key]: parseFloat(value) || 0 }))
    setG2ParamsEdited(true)
  }

  const berechne = async () => {
    if (!ekInput || !formeln) return
    const sel = formeln.find(f => f.sheet === warengruppe)
    if (!sel) return

    setLoading(true)
    try {
      const res = await fetch('/api/preise/g2/berechnen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ek: parseFloat(ekInput),
          warengruppe_regler: sel.regler,
          g2_params: g2Params,
          staffel_mengen: [1, 5, 10, 20, 50, 100, 200, 500]
        })
      })
      const data = await res.json()
      if (data.ok) {
        setErgebnisse(data.ergebnisse || [])
        setPlattformpreis(data.plattform_unit || 0)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setLoading(false)
  }

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

      {/* G2-Parameter Konfiguration */}
      <div className="card mb-2">
        <div className="card-header py-1 d-flex justify-content-between align-items-center" style={{cursor: 'pointer'}} onClick={() => setConfigExpanded(!configExpanded)}>
          <small className="mb-0 font-weight-bold">
            <i className={`bi bi-chevron-${configExpanded ? 'up' : 'down'} mr-2`}/>
            G2-Konfiguration {!configExpanded && '(klicken zum Ausklappen)'}
          </small>
          {g2ParamsEdited && (
            <span className="badge badge-warning py-1 px-2" style={{fontSize: '0.7rem'}}>
              Geändert
            </span>
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

      {ergebnisse.length > 0 && (
        <div>
          <div className="card border-primary mb-2">
            <div className="card-header bg-primary text-white py-1">
              <small className="font-weight-bold" style={{fontSize: '0.85rem'}}>Netto Plattformpreis (g2)</small>
            </div>
            <div className="card-body text-center py-2">
              <div className="h4 font-weight-bold text-primary mb-0">
                {plattformpreis.toFixed(2)} €
              </div>
              <small className="text-muted" style={{fontSize: '0.7rem'}}>pro Stück (netto)</small>
            </div>
          </div>

          <div className="card border-success">
            <div className="card-header bg-success text-white py-1">
              <small className="font-weight-bold" style={{fontSize: '0.85rem'}}>Netto Shop Staffelpreise (shp_fac = {(g2Params.shp_fac*100).toFixed(0)}%)</small>
            </div>
            <div className="card-body py-2">
              <div className="table-responsive">
                <table className="table table-sm table-bordered text-center mb-0" style={{fontSize: '0.85rem'}}>
                  <thead className="thead-light">
                    <tr className="font-weight-bold" style={{fontSize: '0.75rem'}}>
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
  )
}
