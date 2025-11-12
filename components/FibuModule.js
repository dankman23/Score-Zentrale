'use client'

import { useState, useEffect } from 'react'

export default function FibuModule() {
  const [tab, setTab] = useState('uebersicht')
  const [dateFrom, setDateFrom] = useState('2025-10-01')
  const [dateTo, setDateTo] = useState('2025-10-31')
  
  // Kontenplan
  const [konten, setKonten] = useState([])
  const [kontenLoading, setKontenLoading] = useState(false)
  const [kontenFilter, setKontenFilter] = useState('')
  const [kontenKlasseFilter, setKontenKlasseFilter] = useState('alle')
  const [editingKonto, setEditingKonto] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKonto, setNewKonto] = useState({ konto: '', bezeichnung: '' })
  const [importStatus, setImportStatus] = useState('')
  
  // VK-Rechnungen
  const [vkRechnungen, setVkRechnungen] = useState([])
  const [vkLoading, setVkLoading] = useState(false)
  
  // EK-Rechnungen
  const [ekRechnungen, setEkRechnungen] = useState([])
  const [ekLoading, setEkLoading] = useState(false)
  
  // Kontenplan laden
  const loadKontenplan = async () => {
    setKontenLoading(true)
    try {
      const res = await fetch('/api/fibu/kontenplan')
      const data = await res.json()
      if (data.ok) {
        setKonten(data.konten)
      }
    } catch (e) {
      console.error('Fehler beim Laden des Kontenplans:', e)
    }
    setKontenLoading(false)
  }
  
  // VK-Rechnungen laden
  const loadVkRechnungen = async () => {
    setVkLoading(true)
    try {
      const res = await fetch(`/api/fibu/rechnungen/vk?from=${dateFrom}&to=${dateTo}`)
      const data = await res.json()
      if (data.ok) {
        setVkRechnungen(data.rechnungen)
      }
    } catch (e) {
      console.error('Fehler beim Laden der VK-Rechnungen:', e)
    }
    setVkLoading(false)
  }
  
  // EK-Rechnungen laden
  const loadEkRechnungen = async () => {
    setEkLoading(true)
    try {
      const res = await fetch(`/api/fibu/rechnungen/ek?from=${dateFrom}&to=${dateTo}`)
      const data = await res.json()
      if (data.ok) {
        setEkRechnungen(data.rechnungen)
      }
    } catch (e) {
      console.error('Fehler beim Laden der EK-Rechnungen:', e)
    }
    setEkLoading(false)
  }
  
  // EK-Rechnung Upload
  const handleEkUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      alert('Bitte nur PDF-Dateien hochladen')
      return
    }
    
    // PDF zu Base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      
      // Zeige Eingabedialog
      const lieferant = prompt('Lieferantenname:')
      if (!lieferant) return
      
      const rechnungsnr = prompt('Rechnungsnummer:')
      if (!rechnungsnr) return
      
      const rechnungsdatum = prompt('Rechnungsdatum (YYYY-MM-DD):', dateFrom)
      if (!rechnungsdatum) return
      
      const brutto = parseFloat(prompt('Bruttobetrag:') || '0')
      
      setEkLoading(true)
      try {
        const res = await fetch('/api/fibu/rechnungen/ek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lieferant,
            rechnungsnr,
            rechnungsdatum,
            eingangsdatum: new Date().toISOString().slice(0, 10),
            brutto,
            netto: brutto / 1.19,
            mwst: brutto - (brutto / 1.19),
            mwst_satz: 0.19,
            pdf_base64: base64
          })
        })
        
        const data = await res.json()
        if (data.ok) {
          alert('✅ EK-Rechnung hochgeladen!')
          loadEkRechnungen()
        } else {
          alert('Fehler: ' + data.error)
        }
      } catch (e) {
        alert('Fehler beim Upload: ' + e.message)
      }
      setEkLoading(false)
    }
    reader.readAsDataURL(file)
  }
  
  useEffect(() => {
    if (tab === 'kontenplan') loadKontenplan()
    if (tab === 'vk') loadVkRechnungen()
    if (tab === 'ek') loadEkRechnungen()
  }, [tab, dateFrom, dateTo])
  
  return (
    <div className="card">
      <div className="card-header py-2">
        <h5 className="mb-0"><i className="bi bi-calculator-fill mr-2"/>FIBU - Buchhaltung</h5>
      </div>
      <div className="card-body py-2">
        
        {/* Tabs */}
        <div className="btn-group btn-group-sm mb-3 w-100">
          <button 
            className={`btn ${tab === 'uebersicht' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('uebersicht')}
          >
            <i className="bi bi-house mr-1"/>Übersicht
          </button>
          <button 
            className={`btn ${tab === 'vk' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('vk')}
          >
            <i className="bi bi-receipt mr-1"/>VK-Rechnungen
          </button>
          <button 
            className={`btn ${tab === 'ek' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('ek')}
          >
            <i className="bi bi-file-earmark-arrow-down mr-1"/>EK-Rechnungen
          </button>
          <button 
            className={`btn ${tab === 'kontenplan' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('kontenplan')}
          >
            <i className="bi bi-list-ol mr-1"/>Kontenplan
          </button>
          <button 
            className={`btn ${tab === 'einstellungen' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('einstellungen')}
          >
            <i className="bi bi-gear mr-1"/>Einstellungen
          </button>
        </div>
        
        {/* Datumsfilter (für VK/EK) */}
        {(tab === 'vk' || tab === 'ek') && (
          <div className="card mb-3 border-info">
            <div className="card-header bg-info text-white py-1">
              <small className="font-weight-bold">Zeitraum</small>
            </div>
            <div className="card-body py-2">
              <div className="row">
                <div className="col-md-5">
                  <label className="small">Von:</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="col-md-5">
                  <label className="small">Bis:</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button 
                    className="btn btn-sm btn-primary w-100"
                    onClick={() => {
                      if (tab === 'vk') loadVkRechnungen()
                      if (tab === 'ek') loadEkRechnungen()
                    }}
                  >
                    <i className="bi bi-arrow-clockwise"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Übersicht Tab */}
        {tab === 'uebersicht' && (
          <div className="card border-primary">
            <div className="card-header bg-primary text-white py-2">
              <strong>FIBU Übersicht</strong>
            </div>
            <div className="card-body">
              <p><i className="bi bi-info-circle mr-2"/>Willkommen im FIBU-Modul (Buchhaltung)</p>
              <ul>
                <li><strong>VK-Rechnungen:</strong> Automatisch aus JTL-Wawi geladen</li>
                <li><strong>EK-Rechnungen:</strong> PDF-Upload (mit Parsing)</li>
                <li><strong>Kontenplan:</strong> Verwaltung aller Konten</li>
                <li><strong>Export:</strong> 10it EXTF-Format (in Entwicklung)</li>
              </ul>
              <div className="alert alert-warning mt-3">
                <strong>Zeitraum:</strong> Ab Oktober 2025 (2025-10-01)
              </div>
            </div>
          </div>
        )}
        
        {/* VK-Rechnungen Tab */}
        {tab === 'vk' && (
          <div>
            {vkLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"/>
                <p className="mt-2">Lade VK-Rechnungen...</p>
              </div>
            ) : (
              <div className="card">
                <div className="card-header bg-success text-white py-2">
                  <strong>VK-Rechnungen (Ausgangsrechnungen)</strong>
                  <span className="badge badge-light ml-2">{vkRechnungen.length}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Rechnungsnr</th>
                          <th>Datum</th>
                          <th>Kunde</th>
                          <th>Zahlungsart</th>
                          <th className="text-right">Netto</th>
                          <th className="text-right">Brutto</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vkRechnungen.map((r, idx) => (
                          <tr key={idx}>
                            <td><small>{r.rechnungsnr}</small></td>
                            <td><small>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</small></td>
                            <td><small>{r.kunde_name}</small></td>
                            <td><small>{r.zahlungsart}</small></td>
                            <td className="text-right"><small>{r.netto?.toFixed(2)} €</small></td>
                            <td className="text-right"><strong>{r.brutto?.toFixed(2)} €</strong></td>
                            <td><span className="badge badge-info">{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {vkRechnungen.length === 0 && (
                    <div className="text-center py-4 text-muted">
                      Keine Rechnungen im gewählten Zeitraum
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* EK-Rechnungen Tab */}
        {tab === 'ek' && (
          <div>
            <div className="card mb-3 border-warning">
              <div className="card-header bg-warning text-dark py-2">
                <strong>EK-Rechnung hochladen</strong>
              </div>
              <div className="card-body py-2">
                <input 
                  type="file" 
                  accept="application/pdf"
                  className="form-control"
                  onChange={handleEkUpload}
                  disabled={ekLoading}
                />
                <small className="text-muted d-block mt-1">
                  PDF-Upload mit automatischem Parsing (Lieferant, Datum, Betrag)
                </small>
              </div>
            </div>
            
            {ekLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"/>
                <p className="mt-2">Verarbeite EK-Rechnungen...</p>
              </div>
            ) : (
              <div className="card">
                <div className="card-header bg-danger text-white py-2">
                  <strong>EK-Rechnungen (Eingangsrechnungen)</strong>
                  <span className="badge badge-light ml-2">{ekRechnungen.length}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Rechnungsnr</th>
                          <th>Datum</th>
                          <th>Lieferant</th>
                          <th className="text-right">Netto</th>
                          <th className="text-right">Brutto</th>
                          <th>Eingangsdatum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ekRechnungen.map((r, idx) => (
                          <tr key={idx}>
                            <td><small>{r.rechnungsnr}</small></td>
                            <td><small>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</small></td>
                            <td><small>{r.lieferant}</small></td>
                            <td className="text-right"><small>{r.netto?.toFixed(2)} €</small></td>
                            <td className="text-right"><strong>{r.brutto?.toFixed(2)} €</strong></td>
                            <td><small>{new Date(r.eingangsdatum).toLocaleDateString('de-DE')}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {ekRechnungen.length === 0 && (
                    <div className="text-center py-4 text-muted">
                      Noch keine EK-Rechnungen hochgeladen
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Kontenplan Tab */}
        {tab === 'kontenplan' && (
          <div>
            {kontenLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"/>
                <p className="mt-2">Lade Kontenplan...</p>
              </div>
            ) : (
              <div className="card">
                <div className="card-header bg-info text-white py-2">
                  <strong>Kontenplan</strong>
                  <span className="badge badge-light ml-2">{konten.length}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive" style={{maxHeight: '500px', overflowY: 'auto'}}>
                    <table className="table table-sm table-hover mb-0">
                      <thead className="thead-light" style={{position: 'sticky', top: 0, zIndex: 1}}>
                        <tr>
                          <th>Konto</th>
                          <th>Bezeichnung</th>
                          <th>Typ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {konten.map((k, idx) => (
                          <tr key={idx}>
                            <td><strong>{k.konto}</strong></td>
                            <td><small>{k.bezeichnung}</small></td>
                            <td><span className="badge badge-secondary">{k.typ}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {konten.length === 0 && (
                    <div className="text-center py-4 text-muted">
                      Noch keine Konten im Kontenplan
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Einstellungen Tab */}
        {tab === 'einstellungen' && (
          <div className="card border-secondary">
            <div className="card-header bg-secondary text-white py-2">
              <strong>FIBU Einstellungen</strong>
            </div>
            <div className="card-body">
              <h6>Sammeldebitoren</h6>
              <p className="small text-muted">
                Standard: Sammeldebitoren nach Zahlungsart<br/>
                Ausnahme: Innergemeinschaftliche Lieferungen (mit USt-ID) → Einzeldebitoren
              </p>
              
              <div className="alert alert-info">
                <strong>In Entwicklung:</strong> Zahlungsarten-Konfiguration, Export zu 10it
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  )
}
