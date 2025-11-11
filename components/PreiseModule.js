'use client'

import { useState, useEffect } from 'react'

export default function PreiseModule() {
  const [tab, setTab] = useState('alte_pb')
  const [sheet, setSheet] = useState('lagerware')
  const [formeln, setFormeln] = useState([])
  const [currentFormel, setCurrentFormel] = useState(null)
  const [ek, setEk] = useState('')
  const [ergebnisse, setErgebnisse] = useState([])
  const [loading, setLoading] = useState(false)
  const [reglerEdited, setReglerEdited] = useState(false)

  const sheets = [
    { id: 'lagerware', name: 'Lagerware' },
    { id: 'klingspor_fremdlager', name: 'Klingspor Fremdlager' },
    { id: 'abverkauf', name: 'Abverkauf' },
    { id: 'lagerware_guenstiger_ek', name: 'Lagerware günstiger EK' },
    { id: 'pferd_fremdlager', name: 'Pferd Fremdlager' },
    { id: 'plastimex_fremdlager', name: 'Plastimex Fremdlager' },
    { id: 'alle_konfektion', name: 'Alle Konfektion' }
  ]

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

  if (!currentFormel) return <div className="text-center py-5"><div className="spinner-border"/></div>

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="mb-0"><i className="bi bi-calculator mr-2"/>Preisberechnung</h2>
      </div>
      <div className="card-body">
        {/* Haupt-Tabs */}
        <div className="btn-group btn-group-lg mb-4 w-100">
          <button 
            className={`btn ${tab === 'alte_pb' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('alte_pb')}
          >
            Alte PB
          </button>
          <button 
            className={`btn ${tab === 'neue_2025' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('neue_2025')}
            disabled
          >
            Neue ab 2025-11 <small className="ml-2">(Coming Soon)</small>
          </button>
        </div>

        {tab === 'alte_pb' && (
          <>
            {/* Sheet-Tabs */}
            <div className="mb-4">
              <ul className="nav nav-pills nav-fill">
                {sheets.map(s => (
                  <li className="nav-item" key={s.id}>
                    <a 
                      className={`nav-link ${sheet === s.id ? 'active' : ''}`}
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
            <div className="alert alert-info mb-4">
              <strong>Warengruppen:</strong> {currentFormel.warengruppen.map(w => w.name).join(', ')}
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
                <div className="mb-4">
                  <div className="bg-warning text-dark font-weight-bold px-3 py-2 mb-3" style={{fontSize: '1.1rem'}}>
                    Kosten - variabel
                  </div>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="font-weight-bold">Mwst.</label>
                      <div className="input-group">
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
                    <div className="col-md-4 mb-3">
                      <label className="font-weight-bold">Ebay/Amazon</label>
                      <div className="input-group">
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
                    <div className="col-md-4 mb-3">
                      <label className="font-weight-bold">Paypal</label>
                      <div className="input-group">
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
                <div className="mb-4">
                  <div className="bg-warning text-dark font-weight-bold px-3 py-2 mb-3" style={{fontSize: '1.1rem'}}>
                    Kosten - statisch
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="font-weight-bold">Paypal Fix</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control" 
                        value={currentFormel.regler.paypal_fix}
                        onChange={(e) => updateRegler('paypal_fix', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="font-weight-bold">Fixkosten Beitrag</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control" 
                        value={currentFormel.regler.fixkosten_beitrag}
                        onChange={(e) => updateRegler('fixkosten_beitrag', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Regler */}
                <div className="mb-4">
                  <div className="bg-light text-dark font-weight-bold px-3 py-2 mb-3" style={{fontSize: '1.1rem'}}>
                    Regler
                  </div>
                  <div className="row">
                    <div className="col-md mb-3">
                      <label className="font-weight-bold small">Gewinn Regler 1 a</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control" 
                        value={currentFormel.regler.gewinn_regler_1a}
                        onChange={(e) => updateRegler('gewinn_regler_1a', e.target.value)}
                      />
                    </div>
                    <div className="col-md mb-3">
                      <label className="font-weight-bold small">Gewinn Regler 2 c</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control" 
                        value={currentFormel.regler.gewinn_regler_2c}
                        onChange={(e) => updateRegler('gewinn_regler_2c', e.target.value)}
                      />
                    </div>
                    <div className="col-md mb-3">
                      <label className="font-weight-bold small">Gewinn Regler 3 e</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control" 
                        value={currentFormel.regler.gewinn_regler_3e}
                        onChange={(e) => updateRegler('gewinn_regler_3e', e.target.value)}
                      />
                    </div>
                    <div className="col-md mb-3">
                      <label className="font-weight-bold small">Prozent Aufschlag</label>
                      <div className="input-group">
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
                    <div className="col-md mb-3">
                      <label className="font-weight-bold small">A.A. Threshold</label>
                      <input 
                        type="number" 
                        step="1"
                        className="form-control" 
                        value={currentFormel.regler.aa_threshold}
                        onChange={(e) => updateRegler('aa_threshold', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* EK-Eingabe */}
            <div className="card mb-4 border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">EK-Eingabe</h5>
              </div>
              <div className="card-body">
                <div className="row align-items-end">
                  <div className="col-md-8">
                    <label className="font-weight-bold">EK-Stück netto (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control form-control-lg" 
                      placeholder="z.B. 10.50"
                      value={ek}
                      onChange={(e) => setEk(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && berechnePreise()}
                    />
                  </div>
                  <div className="col-md-4">
                    <button 
                      className="btn btn-primary btn-lg btn-block" 
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
                  <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">Netto Plattformpreis (eBay/Amazon)</h5>
                  </div>
                  <div className="card-body text-center">
                    <div className="display-4 font-weight-bold text-primary">
                      {(ergebnisse[0]?.vk_netto || 0).toFixed(2)} €
                    </div>
                    <div className="text-muted">pro Stück (netto)</div>
                  </div>
                </div>

                {/* Shop-Staffelpreise */}
                <div className="card border-success">
                  <div className="card-header bg-success text-white">
                    <h5 className="mb-0">Netto Shop Staffelpreise (mit {currentFormel?.regler?.aa_threshold || 18}% Rabatt)</h5>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-striped table-bordered text-center">
                        <thead className="thead-dark">
                          <tr>
                            {ergebnisse.map(e => (
                              <th key={e.ve} className="font-weight-bold">{e.ve}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {ergebnisse.map(e => (
                              <td key={e.ve} className="font-weight-bold h5 text-success">
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
          <div className="alert alert-warning">
            <i className="bi bi-info-circle mr-2"/>
            Neue Preisformeln ab November 2025 werden hier implementiert.
          </div>
        )}
      </div>
    </div>
  )
}
