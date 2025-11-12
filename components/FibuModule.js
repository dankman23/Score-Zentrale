'use client'

import { useState, useEffect } from 'react'

export default function FibuModule() {
  const [tab, setTab] = useState('uebersicht')
  const [dateFrom, setDateFrom] = useState('2025-10-01')
  const [dateTo, setDateTo] = useState('2025-10-31')
  
  // VK-Rechnungen
  const [vkRechnungen, setVkRechnungen] = useState([])
  const [vkLoading, setVkLoading] = useState(false)
  const [vkZeitraum, setVkZeitraum] = useState({
    from: '2025-10-01',
    to: '2025-10-31'
  })

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
      // Build query params
      const params = new URLSearchParams()
      if (kontenFilter) params.append('search', kontenFilter)
      if (kontenKlasseFilter !== 'alle') params.append('klasse', kontenKlasseFilter)
      params.append('limit', '500')  // Limit to 500 for performance
      
      const res = await fetch(`/api/fibu/kontenplan?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setKonten(data.konten)
      }
    } catch (e) {
      console.error('Fehler beim Laden des Kontenplans:', e)
    }
    setKontenLoading(false)
  }
  
  // Konto hinzufügen
  const handleAddKonto = async () => {
    if (!newKonto.konto || !newKonto.bezeichnung) {
      alert('Bitte Kontonummer und Bezeichnung eingeben')
      return
    }
    
    try {
      const res = await fetch('/api/fibu/kontenplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKonto)
      })
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ Konto hinzugefügt!')
        setNewKonto({ konto: '', bezeichnung: '' })
        setShowAddModal(false)
        loadKontenplan()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
  }
  
  // Konto bearbeiten
  const handleEditKonto = async (oldKonto) => {
    if (!editingKonto || !editingKonto.konto || !editingKonto.bezeichnung) {
      alert('Bitte Kontonummer und Bezeichnung eingeben')
      return
    }
    
    try {
      const res = await fetch('/api/fibu/kontenplan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldKonto,
          konto: editingKonto.konto,
          bezeichnung: editingKonto.bezeichnung
        })
      })
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ Konto aktualisiert!')
        setEditingKonto(null)
        loadKontenplan()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
  }
  
  // Konto löschen
  const handleDeleteKonto = async (konto) => {
    if (!confirm(`Konto "${konto}" wirklich löschen?`)) return
    
    try {
      const res = await fetch(`/api/fibu/kontenplan?konto=${encodeURIComponent(konto)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ Konto gelöscht!')
        loadKontenplan()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
  }
  
  // Excel-Import
  const handleKontenplanImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    setImportStatus('Import läuft...')
    setKontenLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/fibu/kontenplan/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.ok) {
        setImportStatus(`✅ ${data.message}`)
        loadKontenplan()
        setTimeout(() => setImportStatus(''), 5000)
      } else {
        setImportStatus(`❌ Fehler: ${data.error}`)
      }
    } catch (e) {
      setImportStatus(`❌ Fehler: ${e.message}`)
    }
    
    setKontenLoading(false)
    event.target.value = '' // Reset file input
  }
  
  // Gefilterte Konten - Jetzt serverseitig gefiltert, deshalb keine zusätzliche Filterung nötig
  const filteredKonten = konten
  
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
            {/* Import & Filter Controls */}
            <div className="card mb-3 border-info">
              <div className="card-header bg-info text-white py-2">
                <strong>Kontenplan-Verwaltung</strong>
              </div>
              <div className="card-body py-2">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="small font-weight-bold">Excel-Import:</label>
                    <input 
                      type="file" 
                      accept=".xlsx,.xls"
                      className="form-control form-control-sm"
                      onChange={handleKontenplanImport}
                      disabled={kontenLoading}
                    />
                    {importStatus && (
                      <div className="mt-2 small">{importStatus}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="small font-weight-bold">Suche:</label>
                    <input 
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Konto oder Bezeichnung..."
                      value={kontenFilter}
                      onChange={e => setKontenFilter(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadKontenplan()}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="small font-weight-bold">Kontenklasse:</label>
                    <select 
                      className="form-control form-control-sm"
                      value={kontenKlasseFilter}
                      onChange={e => setKontenKlasseFilter(e.target.value)}
                    >
                      <option value="alle">Alle Klassen</option>
                      <option value="0">0 - Anlagevermögen</option>
                      <option value="1">1 - Umlaufvermögen</option>
                      <option value="2">2 - Eigenkapital/Verbindlichk.</option>
                      <option value="3">3 - Bestandskonten</option>
                      <option value="4">4 - Betriebliche Aufwendungen</option>
                      <option value="5">5 - Betriebliche Erträge</option>
                      <option value="6">6 - Weitere Aufwendungen</option>
                      <option value="7">7 - Weitere Erträge</option>
                      <option value="8">8 - Ergebnisrechnungen</option>
                      <option value="9">9 - Abschlusskonten</option>
                    </select>
                  </div>
                </div>
                
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={loadKontenplan}
                    disabled={kontenLoading}
                  >
                    <i className="bi bi-search mr-1"/>Suchen
                  </button>
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => setShowAddModal(true)}
                  >
                    <i className="bi bi-plus-circle mr-1"/>Neues Konto
                  </button>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setKontenFilter('')
                      setKontenKlasseFilter('alle')
                      setTimeout(loadKontenplan, 100)
                    }}
                    disabled={kontenLoading}
                  >
                    <i className="bi bi-x-circle mr-1"/>Filter zurücksetzen
                  </button>
                </div>
              </div>
            </div>
            
            {/* Add Modal */}
            {showAddModal && (
              <div className="card mb-3 border-success">
                <div className="card-header bg-success text-white py-2">
                  <strong>Neues Konto hinzufügen</strong>
                  <button 
                    className="close text-white"
                    onClick={() => {
                      setShowAddModal(false)
                      setNewKonto({ konto: '', bezeichnung: '' })
                    }}
                  >
                    &times;
                  </button>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3">
                      <label className="small">Kontonummer:</label>
                      <input 
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="z.B. 1000"
                        value={newKonto.konto}
                        onChange={e => setNewKonto({...newKonto, konto: e.target.value})}
                      />
                    </div>
                    <div className="col-md-7">
                      <label className="small">Bezeichnung:</label>
                      <input 
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="z.B. Kasse"
                        value={newKonto.bezeichnung}
                        onChange={e => setNewKonto({...newKonto, bezeichnung: e.target.value})}
                      />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button 
                        className="btn btn-sm btn-success w-100"
                        onClick={handleAddKonto}
                      >
                        <i className="bi bi-check-circle"/>Speichern
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {kontenLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"/>
                <p className="mt-2">Lade Kontenplan...</p>
              </div>
            ) : (
              <div className="card">
                <div className="card-header bg-primary text-white py-2">
                  <strong>Kontenplan</strong>
                  <span className="badge badge-light ml-2">{filteredKonten.length} / {konten.length}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive" style={{maxHeight: '500px', overflowY: 'auto'}}>
                    <table className="table table-sm table-hover mb-0">
                      <thead className="thead-light" style={{position: 'sticky', top: 0, zIndex: 1}}>
                        <tr>
                          <th style={{width: '15%'}}>Konto</th>
                          <th style={{width: '45%'}}>Bezeichnung</th>
                          <th style={{width: '10%'}}>Klasse</th>
                          <th style={{width: '20%'}}>Kategorie</th>
                          <th style={{width: '10%'}}>Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKonten.map((k, idx) => (
                          <tr key={idx}>
                            {editingKonto && editingKonto.konto === k.konto ? (
                              <>
                                <td>
                                  <input 
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editingKonto.konto}
                                    onChange={e => setEditingKonto({...editingKonto, konto: e.target.value})}
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editingKonto.bezeichnung}
                                    onChange={e => setEditingKonto({...editingKonto, bezeichnung: e.target.value})}
                                  />
                                </td>
                                <td><small className="text-muted">{k.kontenklasse ?? '-'}</small></td>
                                <td><small className="text-muted">{k.kontenklasseName || k.typ}</small></td>
                                <td>
                                  <button 
                                    className="btn btn-sm btn-success mr-1"
                                    onClick={() => handleEditKonto(k.konto)}
                                    title="Speichern"
                                  >
                                    <i className="bi bi-check"/>
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setEditingKonto(null)}
                                    title="Abbrechen"
                                  >
                                    <i className="bi bi-x"/>
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td><strong>{k.konto}</strong></td>
                                <td><small>{k.bezeichnung}</small></td>
                                <td>
                                  {k.kontenklasse !== null && k.kontenklasse !== undefined ? (
                                    <span className="badge badge-info">{k.kontenklasse}</span>
                                  ) : (
                                    <small className="text-muted">-</small>
                                  )}
                                </td>
                                <td><small className="text-muted">{k.kontenklasseName || k.typ || 'Sonstiges'}</small></td>
                                <td>
                                  <button 
                                    className="btn btn-sm btn-outline-primary mr-1"
                                    onClick={() => setEditingKonto({konto: k.konto, bezeichnung: k.bezeichnung})}
                                    title="Bearbeiten"
                                  >
                                    <i className="bi bi-pencil"/>
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteKonto(k.konto)}
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredKonten.length === 0 && (
                    <div className="text-center py-4 text-muted">
                      {konten.length === 0 ? 
                        'Noch keine Konten im Kontenplan. Bitte Excel importieren oder manuell anlegen.' :
                        'Keine Konten gefunden für die aktuelle Filterung.'
                      }
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
