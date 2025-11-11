'use client'
import { useState } from 'react'

export default function PreiseG2Module({ formeln }) {
  const [warengruppe, setWarengruppe] = useState('lagerware')
  const [ekInput, setEkInput] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [plattformpreis, setPlattformpreis] = useState(0)
  const [loading, setLoading] = useState(false)

  const [g2Params] = useState({
    gstart_ek: 12, gneu_ek: 100, gneu_vk: 189,
    fixcost1: 0.35, fixcost2: 1.4,
    varpct1: 0.25, varpct2: 0.02,
    aufschlag: 1.08, shp_fac: 0.92
  })

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
      <select className="form-control mb-2" value={warengruppe} onChange={e => setWarengruppe(e.target.value)}>
        <option value="lagerware">Lagerware</option>
        <option value="klingspor_fremdlager">Klingspor</option>
      </select>
      
      <div className="input-group mb-2">
        <input 
          type="number" 
          className="form-control" 
          placeholder="EK"
          value={ekInput}
          onChange={e => setEkInput(e.target.value)}
        />
        <div className="input-group-append">
          <button className="btn btn-warning" onClick={berechne} disabled={loading}>
            Berechnen
          </button>
        </div>
      </div>

      {ergebnisse.length > 0 && (
        <div>
          <div className="alert alert-primary">Plattform: {plattformpreis.toFixed(2)} €</div>
          <table className="table table-sm">
            <thead><tr>{ergebnisse.map(e => <th key={e.staffel}>{e.staffel}</th>)}</tr></thead>
            <tbody><tr>{ergebnisse.map(e => <td key={e.staffel}>{e.shop_unit.toFixed(2)} €</td>)}</tr></tbody>
          </table>
        </div>
      )}
    </div>
  )
}
