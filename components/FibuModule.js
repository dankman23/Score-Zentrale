'use client'

import FibuCompleteDashboard from './FibuCompleteDashboard'

export default function FibuModule() {
  // Das neue, vollständige FIBU Dashboard
  return <FibuCompleteDashboard />
}

// ALTE VERSION (vor Refactoring)
function FibuModuleOld() {
  const { useState, useEffect } = require('react')
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
  
  // EK-Rechnungen
  const [ekRechnungen, setEkRechnungen] = useState([])
  const [ekLoading, setEkLoading] = useState(false)
  const [showEkModal, setShowEkModal] = useState(false)
  const [ekFiles, setEkFiles] = useState([])
  const [ekForm, setEkForm] = useState({
    lieferantName: '',
    kreditorKonto: '',
    rechnungsnummer: '',
    rechnungsdatum: new Date().toISOString().slice(0, 10),
    gesamtBetrag: '',
    aufwandskonto: '5200',
    beschreibung: '',
    neuerKreditor: false
  })
  const [ekSearchKreditor, setEkSearchKreditor] = useState('')
  const [ekMatchResult, setEkMatchResult] = useState(null)
  
  // E-Mail Inbox
  const [emailInbox, setEmailInbox] = useState([])
  const [emailInboxLoading, setEmailInboxLoading] = useState(false)
  const [emailFetchLoading, setEmailFetchLoading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailForm, setEmailForm] = useState({
    lieferantName: '',
    kreditorKonto: '',
    rechnungsnummer: '',
    rechnungsdatum: new Date().toISOString().slice(0, 10),
    gesamtBetrag: '',
    aufwandskonto: '5200'
  })
  const [geminiParsing, setGeminiParsing] = useState(false)
  const [geminiResult, setGeminiResult] = useState(null)
  
  // Export
  const [exportFrom, setExportFrom] = useState('2025-01-01')
  const [exportTo, setExportTo] = useState('2025-01-31')
  const [exportLoading, setExportLoading] = useState(false)
  
  // Kreditoren
  const [kreditoren, setKreditoren] = useState([])
  const [kreditorenLoading, setKreditorenLoading] = useState(false)
  const [kreditorenFilter, setKreditorenFilter] = useState('')
  
  // EK-Upload mit Zuordnung
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [selectedKreditor, setSelectedKreditor] = useState('')
  const [selectedAufwandskonto, setSelectedAufwandskonto] = useState('')
  
  // Zahlungen
  const [zahlungen, setZahlungen] = useState([])
  const [zahlungenLoading, setZahlungenLoading] = useState(false)
  const [showZahlungenTab, setShowZahlungenTab] = useState(false)
  const [zahlungsFilter, setZahlungsFilter] = useState({ anbieter: 'alle', zuordnung: 'alle' })
  
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
  
  // VK-Rechnungen laden
  const loadVkRechnungen = async () => {
    setVkLoading(true)
    try {
      const res = await fetch(`/api/fibu/rechnungen/vk?from=${vkZeitraum.from}&to=${vkZeitraum.to}&limit=100`)
      const data = await res.json()
      if (data.ok) {
        setVkRechnungen(data.rechnungen)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      console.error('Fehler beim Laden der VK-Rechnungen:', e)
      alert('Fehler: ' + e.message)
    }
    setVkLoading(false)
  }
  
  // Gefilterte Konten - Jetzt serverseitig gefiltert, deshalb keine zusätzliche Filterung nötig
  const filteredKonten = konten
  
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
  
  // EK-Rechnung Upload - Multi-File
  const handleEkFileSelect = async (event) => {
    const files = Array.from(event.target.files)
    
    // Filter nur PDFs
    const pdfFiles = files.filter(f => f.type === 'application/pdf')
    
    if (pdfFiles.length === 0) {
      alert('Bitte nur PDF-Dateien auswählen')
      return
    }
    
    if (pdfFiles.length !== files.length) {
      alert(`${files.length - pdfFiles.length} Nicht-PDF-Dateien wurden ignoriert`)
    }
    
    setEkFiles(pdfFiles)
    setShowEkModal(true)
    
    // Lade Kreditoren für Dropdown
    if (kreditoren.length === 0) {
      await loadKreditoren()
    }
    
    // Auto-Vorschlag aus Dateinamen
    if (pdfFiles[0]) {
      const filename = pdfFiles[0].name
      // Versuche Lieferant aus Dateinamen zu erkennen
      const lowerName = filename.toLowerCase()
      
      if (lowerName.includes('amazon')) {
        setEkForm(prev => ({ ...prev, lieferantName: 'Amazon Payment' }))
        handleKreditorSearch('Amazon Payment')
      } else if (lowerName.includes('idealo')) {
        setEkForm(prev => ({ ...prev, lieferantName: 'Idealo' }))
        handleKreditorSearch('Idealo')
      } else if (lowerName.includes('dhl')) {
        setEkForm(prev => ({ ...prev, lieferantName: 'DHL' }))
        handleKreditorSearch('DHL')
      }
    }
  }
  
  // Kreditor-Suche und Auto-Matching
  const handleKreditorSearch = async (searchTerm) => {
    setEkSearchKreditor(searchTerm)
    
    if (!searchTerm || searchTerm.length < 2) {
      setEkMatchResult(null)
      return
    }
    
    // Lokales Matching in geladenen Kreditoren
    const normalized = searchTerm.toLowerCase().trim()
    
    // Exakte Übereinstimmung
    const exactMatch = kreditoren.find(k => 
      k.name.toLowerCase() === normalized
    )
    
    if (exactMatch) {
      setEkMatchResult({
        kreditorenNummer: exactMatch.kreditorenNummer,
        name: exactMatch.name,
        aufwandskonto: exactMatch.standardAufwandskonto,
        confidence: 100,
        method: 'exact'
      })
      setEkForm(prev => ({
        ...prev,
        kreditorKonto: exactMatch.kreditorenNummer,
        aufwandskonto: exactMatch.standardAufwandskonto || '5200'
      }))
      return
    }
    
    // Fuzzy Match
    const fuzzyMatches = kreditoren.filter(k =>
      k.name.toLowerCase().includes(normalized) ||
      normalized.includes(k.name.toLowerCase())
    )
    
    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches[0]
      setEkMatchResult({
        kreditorenNummer: bestMatch.kreditorenNummer,
        name: bestMatch.name,
        aufwandskonto: bestMatch.standardAufwandskonto,
        confidence: 85,
        method: 'fuzzy'
      })
      setEkForm(prev => ({
        ...prev,
        kreditorKonto: bestMatch.kreditorenNummer,
        aufwandskonto: bestMatch.standardAufwandskonto || '5200'
      }))
    } else {
      setEkMatchResult(null)
    }
  }
  
  // EK-Rechnungen speichern
  const handleEkSave = async () => {
    if (!ekForm.lieferantName || !ekForm.rechnungsnummer || !ekForm.gesamtBetrag) {
      alert('Bitte alle Pflichtfelder ausfüllen')
      return
    }
    
    setEkLoading(true)
    
    try {
      // Wenn neuer Kreditor, erst anlegen
      if (ekForm.neuerKreditor && ekForm.lieferantName && !ekForm.kreditorKonto) {
        const kreditorRes = await fetch('/api/fibu/kreditoren', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kreditorenNummer: '7' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
            name: ekForm.lieferantName,
            standardAufwandskonto: ekForm.aufwandskonto
          })
        })
        
        const kreditorData = await kreditorRes.json()
        if (kreditorData.ok) {
          ekForm.kreditorKonto = kreditorData.kreditorenNummer
          await loadKreditoren()
        }
      }
      
      // Speichere Rechnung
      const res = await fetch('/api/fibu/rechnungen/ek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lieferantName: ekForm.lieferantName,
          rechnungsnummer: ekForm.rechnungsnummer,
          rechnungsdatum: ekForm.rechnungsdatum,
          gesamtBetrag: parseFloat(ekForm.gesamtBetrag),
          kreditorKonto: ekForm.kreditorKonto,
          aufwandskonto: ekForm.aufwandskonto,
          beschreibung: ekForm.beschreibung
        })
      })
      
      const data = await res.json()
      
      if (data.ok) {
        alert(`✅ ${ekFiles.length} EK-Rechnung(en) gespeichert!`)
        setShowEkModal(false)
        setEkFiles([])
        setEkForm({
          lieferantName: '',
          kreditorKonto: '',
          rechnungsnummer: '',
          rechnungsdatum: new Date().toISOString().slice(0, 10),
          gesamtBetrag: '',
          aufwandskonto: '5200',
          beschreibung: '',
          neuerKreditor: false
        })
        loadEkRechnungen()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    }
    
    setEkLoading(false)
  }
  
  // Kreditoren laden
  const loadKreditoren = async () => {
    setKreditorenLoading(true)
    try {
      const res = await fetch('/api/fibu/kreditoren')
      const data = await res.json()
      if (data.ok) {
        setKreditoren(data.kreditoren)
      } else {
        alert('Fehler beim Laden der Kreditoren: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Laden der Kreditoren')
    }
    setKreditorenLoading(false)
  }
  
  // Zahlungen laden
  const loadZahlungen = async () => {
    setZahlungenLoading(true)
    try {
      const res = await fetch(`/api/fibu/zahlungen?from=${dateFrom}&to=${dateTo}&limit=500`)
      const data = await res.json()
      if (data.ok) {
        setZahlungen(data.zahlungen)
      } else {
        alert('Fehler beim Laden der Zahlungen: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Laden der Zahlungen')
    }
    setZahlungenLoading(false)
  }
  
  // E-Mail Inbox laden
  const loadEmailInbox = async () => {
    setEmailInboxLoading(true)
    try {
      const res = await fetch('/api/fibu/email-inbox')
      const data = await res.json()
      if (data.ok) {
        setEmailInbox(data.emails)
      } else {
        alert('Fehler beim Laden der Inbox: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Laden der Inbox')
    }
    setEmailInboxLoading(false)
  }
  
  // Neue E-Mails manuell abrufen
  const fetchNewEmails = async () => {
    setEmailFetchLoading(true)
    try {
      const res = await fetch('/api/fibu/email-inbox', { method: 'POST' })
      const data = await res.json()
      
      if (data.ok) {
        alert(`✅ ${data.message}`)
        loadEmailInbox()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Abrufen')
    }
    setEmailFetchLoading(false)
  }
  
  // E-Mail verarbeiten - Modal öffnen
  const handleProcessEmail = (email) => {
    setSelectedEmail(email)
    setEmailForm({
      lieferantName: '',
      kreditorKonto: '',
      rechnungsnummer: '',
      rechnungsdatum: new Date().toISOString().slice(0, 10),
      gesamtBetrag: '',
      aufwandskonto: '5200'
    })
    setGeminiResult(null)
    setShowEmailModal(true)
    
    // Lade Kreditoren falls noch nicht geladen
    if (kreditoren.length === 0) {
      loadKreditoren()
    }
  }
  
  // Gemini PDF-Parsing
  const handleGeminiParse = async () => {
    if (!selectedEmail) return
    
    setGeminiParsing(true)
    try {
      const res = await fetch('/api/fibu/email-inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEmail.id })
      })
      
      const data = await res.json()
      
      if (data.ok && data.extracted) {
        setGeminiResult(data.extracted)
        
        // Vorbefüllen wenn Daten vorhanden
        if (data.extracted.lieferant) {
          setEmailForm(prev => ({
            ...prev,
            lieferantName: data.extracted.lieferant || prev.lieferantName,
            rechnungsnummer: data.extracted.rechnungsnummer || prev.rechnungsnummer,
            rechnungsdatum: data.extracted.datum || prev.rechnungsdatum,
            gesamtBetrag: data.extracted.gesamtbetrag?.toString() || prev.gesamtBetrag
          }))
          
          // Auto-Matching für Kreditor
          if (data.extracted.lieferant) {
            handleKreditorSearch(data.extracted.lieferant)
          }
        }
        
        alert('✅ PDF erfolgreich analysiert!')
      } else {
        alert('❌ Fehler beim Parsen: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Gemini Fehler:', error)
      alert('❌ Fehler beim PDF-Parsing')
    }
    setGeminiParsing(false)
  }
  
  // E-Mail als EK-Rechnung speichern
  const handleSaveEmailInvoice = async () => {
    if (!selectedEmail || !emailForm.lieferantName || !emailForm.gesamtBetrag) {
      alert('Bitte alle Pflichtfelder ausfüllen')
      return
    }
    
    setEkLoading(true)
    try {
      const res = await fetch('/api/fibu/email-inbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmail.id,
          ...emailForm,
          kreditorKonto: emailForm.kreditorKonto || undefined,
          aufwandskonto: emailForm.aufwandskonto
        })
      })
      
      const data = await res.json()
      
      if (data.ok) {
        alert('✅ EK-Rechnung erstellt!')
        setShowEmailModal(false)
        setSelectedEmail(null)
        loadEmailInbox()
        loadEkRechnungen()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    }
    setEkLoading(false)
  }
  
  // Export-Handler
  const handleExport = async () => {
    if (!exportFrom || !exportTo) {
      alert('Bitte Zeitraum auswählen')
      return
    }
    
    setExportLoading(true)
    try {
      const response = await fetch(
        `/api/fibu/export/10it?from=${exportFrom}&to=${exportTo}`
      )
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Export fehlgeschlagen')
      }
      
      // Download als Datei
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Export_Konten_von_${exportFrom}_bis_${exportTo}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      alert('✅ Export erfolgreich erstellt!')
    } catch (error) {
      console.error('Export Fehler:', error)
      alert('❌ Fehler beim Export: ' + error.message)
    }
    setExportLoading(false)
  }
  
  useEffect(() => {
    if (tab === 'kontenplan') loadKontenplan()
    if (tab === 'vk') loadVkRechnungen()
    if (tab === 'ek') loadEkRechnungen()
    if (tab === 'ek-manager') loadEkRechnungen()
    if (tab === 'zahlungen') loadZahlungen()
    if (tab === 'kreditoren') loadKreditoren()
    if (tab === 'inbox') loadEmailInbox()
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
            className={`btn ${tab === 'zahlungen' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('zahlungen')}
          >
            <i className="bi bi-cash-coin mr-1"/>Zahlungen
          </button>
          <button 
            className={`btn ${tab === 'ek' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('ek')}
          >
            <i className="bi bi-file-earmark-arrow-down mr-1"/>EK-Upload
          </button>
          <button 
            className={`btn ${tab === 'ek-manager' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('ek-manager')}
          >
            <i className="bi bi-list-check mr-1"/>EK-Manager
          </button>
          <button 
            className={`btn ${tab === 'inbox' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('inbox')}
          >
            <i className="bi bi-envelope mr-1"/>📧 Inbox
            {emailInbox.filter(e => e.status === 'pending').length > 0 && (
              <span className="badge badge-danger ml-1">
                {emailInbox.filter(e => e.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            className={`btn ${tab === 'kontenplan' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('kontenplan')}
          >
            <i className="bi bi-list-ol mr-1"/>Kontenplan
          </button>
          <button 
            className={`btn ${tab === 'kreditoren' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('kreditoren')}
          >
            <i className="bi bi-building mr-1"/>Kreditoren
          </button>
          <button 
            className={`btn ${tab === 'export' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('export')}
          >
            <i className="bi bi-file-earmark-arrow-down mr-1"/>10it Export
          </button>
          <button 
            className={`btn ${tab === 'einstellungen' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab('einstellungen')}
          >
            <i className="bi bi-gear mr-1"/>Einstellungen
          </button>
        </div>
        
        {/* Datumsfilter (für VK/EK) */}
        {(tab === 'vk' || tab === 'ek' || tab === 'ek-manager') && (
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
                      if (tab === 'ek-manager') loadEkRechnungen()
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
                          <th>Debitor-Konto</th>
                          <th>Sachkonto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vkRechnungen.map((r, idx) => (
                          <tr key={idx} style={{color: '#e0e0e0'}}>
                            <td><small><strong style={{color: '#fff'}}>{r.cRechnungsNr}</strong></small></td>
                            <td><small style={{color: '#e0e0e0'}}>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</small></td>
                            <td><small style={{color: '#f0f0f0', fontWeight: '500'}}>{r.kundenName}</small></td>
                            <td><small style={{color: '#d0d0d0'}}>{r.zahlungsart}</small></td>
                            <td className="text-right"><small style={{color: '#e0e0e0'}}>{r.netto?.toFixed(2)} €</small></td>
                            <td className="text-right"><strong style={{color: '#fff'}}>{r.brutto?.toFixed(2)} €</strong></td>
                            <td>
                              <span className={`badge ${r.status === 'Bezahlt' ? 'badge-success' : 'badge-warning'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-primary">{r.debitorKonto}</span>
                            </td>
                            <td>
                              <span className="badge badge-secondary">{r.sachkonto}</span>
                            </td>
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
        
        {/* Zahlungen Tab */}
        {tab === 'zahlungen' && (
          <div>
            <div className="card border-success">
              <div className="card-header bg-success text-white py-2">
                <strong><i className="bi bi-cash-coin mr-2"/>Zahlungseingänge (VK)</strong>
              </div>
              <div className="card-body">
                {/* Filter */}
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="small font-weight-bold">Zahlungsanbieter:</label>
                    <select 
                      className="form-control form-control-sm"
                      value={zahlungsFilter.anbieter}
                      onChange={e => setZahlungsFilter(prev => ({ ...prev, anbieter: e.target.value }))}
                    >
                      <option value="alle">Alle Anbieter</option>
                      <option value="paypal">PayPal</option>
                      <option value="amazon">Amazon Payment</option>
                      <option value="ebay">eBay Managed Payments</option>
                      <option value="mollie">Mollie</option>
                      <option value="commerzbank">Commerzbank</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="small font-weight-bold">Zuordnung:</label>
                    <select 
                      className="form-control form-control-sm"
                      value={zahlungsFilter.zuordnung}
                      onChange={e => setZahlungsFilter(prev => ({ ...prev, zuordnung: e.target.value }))}
                    >
                      <option value="alle">Alle Zahlungen</option>
                      <option value="zugeordnet">Nur zugeordnete</option>
                      <option value="nicht-zugeordnet">Nur nicht zugeordnete</option>
                    </select>
                  </div>
                </div>
                
                {zahlungenLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-success"/>
                    <p className="mt-2">Lade Zahlungen...</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{maxHeight: '600px', overflow: 'auto'}}>
                    <table className="table table-sm table-hover">
                      <thead className="thead-light sticky-top">
                        <tr>
                          <th>Referenz/Hinweis</th>
                          <th>Datum</th>
                          <th>Rechnung</th>
                          <th>Kunde</th>
                          <th className="text-right">Betrag</th>
                          <th>Zahlungsanbieter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zahlungen
                          .filter(z => {
                            if (!zahlungsFilter.anbieter || zahlungsFilter.anbieter === 'alle') return true
                            return z.zahlungsanbieter?.toLowerCase().includes(zahlungsFilter.anbieter.toLowerCase())
                          })
                          .filter(z => {
                            if (!zahlungsFilter.zuordnung || zahlungsFilter.zuordnung === 'alle') return true
                            if (zahlungsFilter.zuordnung === 'zugeordnet') return z.kRechnung && z.kRechnung > 0
                            if (zahlungsFilter.zuordnung === 'nicht-zugeordnet') return !z.kRechnung || z.kRechnung === 0
                            return true
                          })
                          .map((z, idx) => (
                          <tr key={idx} style={{color: '#e0e0e0'}}>
                            <td>
                              <span style={{color: '#f0f0f0', fontSize: '0.85rem'}}>{z.belegnummer?.substring(0, 40)}</span>
                              {z.belegnummer && z.belegnummer.length > 40 && (
                                <span className="text-muted" title={z.belegnummer}>...</span>
                              )}
                            </td>
                            <td><span style={{color: '#e0e0e0'}}>{new Date(z.zahlungsdatum).toLocaleDateString('de-DE')}</span></td>
                            <td>
                              {z.rechnungsNr && z.rechnungsNr !== 'Unbekannt' ? (
                                <strong style={{color: '#4ade80'}}>{z.rechnungsNr}</strong>
                              ) : (
                                <span style={{color: '#ef4444'}}>Nicht zugeordnet</span>
                              )}
                            </td>
                            <td><span style={{color: '#d0d0d0'}}>{z.kundenName || '-'}</span></td>
                            <td className="text-right"><strong style={{color: '#4ade80'}}>{z.betrag?.toFixed(2)} €</strong></td>
                            <td>
                              <span className={`badge ${
                                z.zahlungsanbieter?.toLowerCase().includes('paypal') ? 'badge-primary' :
                                z.zahlungsanbieter?.toLowerCase().includes('amazon') ? 'badge-warning' :
                                z.zahlungsanbieter?.toLowerCase().includes('mollie') ? 'badge-info' :
                                z.zahlungsanbieter?.toLowerCase().includes('commerzbank') || z.zahlungsanbieter?.toLowerCase().includes('bank') ? 'badge-secondary' :
                                z.zahlungsanbieter?.toLowerCase().includes('ebay') ? 'badge-success' :
                                'badge-dark'
                              }`}>
                                {z.zahlungsanbieter || z.zahlungsart || 'Manuell'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {zahlungen.length === 0 && (
                      <div className="text-center py-4 text-muted">
                        Keine Zahlungen im gewählten Zeitraum gefunden.
                      </div>
                    )}
                  </div>
                )}
                
                <div className="alert alert-info small mt-3 mb-0">
                  <strong><i className="bi bi-info-circle mr-2"/>Info:</strong>
                  {zahlungen.length} Zahlungseingang/Zahlungseingänge gefunden. 
                  Zahlungen werden automatisch den Rechnungen zugeordnet (via kRechnung).
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* EK-Rechnungen Tab */}
        {tab === 'ek' && (
          <div>
            <div className="card mb-3 border-warning">
              <div className="card-header bg-warning text-dark py-2">
                <strong><i className="bi bi-cloud-upload mr-2"/>EK-Rechnungen hochladen</strong>
              </div>
              <div className="card-body py-2">
                <input 
                  type="file" 
                  accept="application/pdf"
                  multiple
                  className="form-control"
                  onChange={handleEkFileSelect}
                  disabled={ekLoading}
                />
                <small className="text-muted d-block mt-1">
                  <i className="bi bi-info-circle mr-1"/>
                  Mehrere PDFs gleichzeitig möglich. Auto-Matching versucht Lieferanten zu erkennen.
                </small>
              </div>
            </div>
            
            {/* Upload Modal */}
            {showEkModal && (
              <div className="card mb-3 border-success" style={{maxWidth: '800px', margin: '0 auto'}}>
                <div className="card-header bg-success text-white py-2 d-flex justify-content-between align-items-center">
                  <strong><i className="bi bi-pencil-square mr-2"/>EK-Rechnung erfassen</strong>
                  <button 
                    className="btn btn-sm btn-light"
                    onClick={() => {
                      setShowEkModal(false)
                      setEkFiles([])
                    }}
                  >
                    <i className="bi bi-x-lg"/>
                  </button>
                </div>
                <div className="card-body">
                  <div className="alert alert-info small mb-3">
                    <strong><i className="bi bi-files mr-2"/>{ekFiles.length} Datei(en) ausgewählt:</strong>
                    {ekFiles.map((f, i) => (
                      <div key={i} className="ml-3 text-truncate">{f.name}</div>
                    ))}
                  </div>
                  
                  {/* Lieferant Suche */}
                  <div className="form-group">
                    <label className="font-weight-bold">
                      Lieferant <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Lieferant suchen..."
                      value={ekForm.lieferantName}
                      onChange={e => {
                        setEkForm(prev => ({ ...prev, lieferantName: e.target.value }))
                        handleKreditorSearch(e.target.value)
                      }}
                      list="kreditorenList"
                    />
                    <datalist id="kreditorenList">
                      {kreditoren.map(k => (
                        <option key={k.id} value={k.name}/>
                      ))}
                    </datalist>
                    
                    {/* Match-Ergebnis */}
                    {ekMatchResult && (
                      <div className="mt-2">
                        <span className={`badge ${
                          ekMatchResult.confidence === 100 ? 'badge-success' : 'badge-info'
                        }`}>
                          ✓ {ekMatchResult.method === 'exact' ? 'Exakte Übereinstimmung' : 'Ähnlicher Lieferant'}: {ekMatchResult.name}
                        </span>
                        <small className="d-block text-muted mt-1">
                          Kreditor: {ekMatchResult.kreditorenNummer} | Aufwandskonto: {ekMatchResult.aufwandskonto}
                        </small>
                      </div>
                    )}
                    
                    {ekForm.lieferantName && !ekMatchResult && (
                      <div className="mt-2">
                        <div className="custom-control custom-checkbox">
                          <input 
                            type="checkbox"
                            className="custom-control-input"
                            id="neuerKreditorCheck"
                            checked={ekForm.neuerKreditor}
                            onChange={e => setEkForm(prev => ({ ...prev, neuerKreditor: e.target.checked }))}
                          />
                          <label className="custom-control-label" htmlFor="neuerKreditorCheck">
                            <i className="bi bi-plus-circle mr-1"/>Neuen Lieferanten anlegen
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Rechnungsnummer <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="text"
                          className="form-control"
                          placeholder="z.B. XRE-5561, IDE-2025-001"
                          value={ekForm.rechnungsnummer}
                          onChange={e => setEkForm(prev => ({ ...prev, rechnungsnummer: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Rechnungsdatum <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="date"
                          className="form-control"
                          value={ekForm.rechnungsdatum}
                          onChange={e => setEkForm(prev => ({ ...prev, rechnungsdatum: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Bruttobetrag <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          className="form-control"
                          placeholder="119.00"
                          value={ekForm.gesamtBetrag}
                          onChange={e => setEkForm(prev => ({ ...prev, gesamtBetrag: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">Aufwandskonto</label>
                        <select 
                          className="form-control"
                          value={ekForm.aufwandskonto}
                          onChange={e => setEkForm(prev => ({ ...prev, aufwandskonto: e.target.value }))}
                        >
                          <option value="5200">5200 - Wareneinkauf</option>
                          <option value="6300">6300 - Versandkosten</option>
                          <option value="6530">6530 - Kraftstoff</option>
                          <option value="6600">6600 - Werbung</option>
                          <option value="6610">6610 - Bürobedarf</option>
                          <option value="6640">6640 - Versicherungen</option>
                          <option value="6805">6805 - Telefon/Internet</option>
                          <option value="6815">6815 - IT/Software</option>
                          <option value="6823">6823 - Lizenzgebühren</option>
                          <option value="6850">6850 - Bankgebühren</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="font-weight-bold">Beschreibung</label>
                    <textarea 
                      className="form-control"
                      rows="2"
                      placeholder="Optional: Zusätzliche Informationen"
                      value={ekForm.beschreibung}
                      onChange={e => setEkForm(prev => ({ ...prev, beschreibung: e.target.value }))}
                    />
                  </div>
                  
                  <div className="d-flex justify-content-end gap-2">
                    <button 
                      className="btn btn-secondary mr-2"
                      onClick={() => {
                        setShowEkModal(false)
                        setEkFiles([])
                      }}
                    >
                      Abbrechen
                    </button>
                    <button 
                      className="btn btn-success"
                      onClick={handleEkSave}
                      disabled={ekLoading}
                    >
                      {ekLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2"/>
                          Speichere...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-lg mr-2"/>
                          Speichern
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
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
                          <th>Belegnr</th>
                          <th>Datum</th>
                          <th>Lieferant</th>
                          <th>Kreditor</th>
                          <th>Aufwandskonto</th>
                          <th className="text-right">Netto</th>
                          <th className="text-right">Brutto</th>
                          <th>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ekRechnungen.map((r, idx) => (
                          <tr key={idx}>
                            <td>
                              <small className="font-weight-bold">{r.rechnungsNummer || r.rechnungsnr}</small>
                              {r.originalRechnungsNummer && r.originalRechnungsNummer !== r.rechnungsNummer && (
                                <div className="text-muted" style={{fontSize: '0.7rem'}}>
                                  ({r.originalRechnungsNummer})
                                </div>
                              )}
                            </td>
                            <td><small>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</small></td>
                            <td><small>{r.lieferantName || r.lieferant}</small></td>
                            <td>
                              {r.kreditorKonto ? (
                                <span className="badge badge-info">{r.kreditorKonto}</span>
                              ) : (
                                <span className="badge badge-warning">?</span>
                              )}
                            </td>
                            <td>
                              {r.aufwandskonto ? (
                                <span className="badge badge-secondary">{r.aufwandskonto}</span>
                              ) : (
                                <span className="badge badge-warning">?</span>
                              )}
                            </td>
                            <td className="text-right"><small>{(r.nettoBetrag || r.netto)?.toFixed(2)} €</small></td>
                            <td className="text-right"><strong>{(r.gesamtBetrag || r.brutto)?.toFixed(2)} €</strong></td>
                            <td>
                              {r.matching && (
                                <span 
                                  className={`badge ${
                                    r.matching.confidence === 100 ? 'badge-success' : 
                                    r.matching.confidence >= 80 ? 'badge-info' : 
                                    'badge-warning'
                                  }`}
                                  title={`${r.matching.method}: ${r.matching.matchedName || ''}`}
                                >
                                  {r.matching.confidence}%
                                </span>
                              )}
                            </td>
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
        
        {/* EK-Manager Tab */}
        {tab === 'ek-manager' && (
          <div>
            <div className="card border-info">
              <div className="card-header bg-info text-white py-2">
                <strong><i className="bi bi-list-check mr-2"/>EK-Manager - Rechnungsübersicht</strong>
                <span className="badge badge-light ml-2">{ekRechnungen.length}</span>
              </div>
              <div className="card-body">
                {ekLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary"/>
                    <p className="mt-2">Lade EK-Rechnungen...</p>
                  </div>
                ) : (
                  <div>
                    {ekRechnungen.length === 0 ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-inbox display-4 d-block mb-3"/>
                        Noch keine EK-Rechnungen vorhanden
                        <p className="mt-2">
                          <button 
                            className="btn btn-primary"
                            onClick={() => setTab('ek')}
                          >
                            <i className="bi bi-plus-circle mr-1"/>Erste Rechnung hochladen
                          </button>
                        </p>
                      </div>
                    ) : (
                      <div className="table-responsive" style={{maxHeight: '600px', overflow: 'auto'}}>
                        <table className="table table-sm table-hover">
                          <thead className="thead-light sticky-top">
                            <tr>
                              <th>Belegnr</th>
                              <th>Datum</th>
                              <th>Lieferant</th>
                              <th>Kreditor</th>
                              <th>Aufwandskonto</th>
                              <th className="text-right">Netto</th>
                              <th className="text-right">Brutto</th>
                              <th>Status</th>
                              <th>Aktionen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ekRechnungen.map((r, idx) => (
                              <tr key={idx}>
                                <td>
                                  <small className="font-weight-bold">{r.rechnungsNummer || r.rechnungsnr}</small>
                                  {r.originalRechnungsNummer && r.originalRechnungsNummer !== r.rechnungsNummer && (
                                    <div className="text-muted" style={{fontSize: '0.7rem'}}>
                                      ({r.originalRechnungsNummer})
                                    </div>
                                  )}
                                </td>
                                <td><small>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</small></td>
                                <td><small>{r.lieferantName || r.lieferant}</small></td>
                                <td>
                                  {r.kreditorKonto ? (
                                    <span className="badge badge-info">{r.kreditorKonto}</span>
                                  ) : (
                                    <span className="badge badge-warning">Nicht zugeordnet</span>
                                  )}
                                </td>
                                <td>
                                  {r.aufwandskonto ? (
                                    <span className="badge badge-secondary">{r.aufwandskonto}</span>
                                  ) : (
                                    <span className="badge badge-warning">?</span>
                                  )}
                                </td>
                                <td className="text-right"><small>{(r.nettoBetrag || r.netto)?.toFixed(2)} €</small></td>
                                <td className="text-right"><strong>{(r.gesamtBetrag || r.brutto)?.toFixed(2)} €</strong></td>
                                <td>
                                  {r.matching ? (
                                    <span 
                                      className={`badge ${
                                        r.matching.confidence === 100 ? 'badge-success' : 
                                        r.matching.confidence >= 80 ? 'badge-info' : 
                                        'badge-warning'
                                      }`}
                                      title={`${r.matching.method}: ${r.matching.matchedName || ''}`}
                                    >
                                      {r.matching.confidence}% Match
                                    </span>
                                  ) : (
                                    <span className="badge badge-secondary">Manuell</span>
                                  )}
                                </td>
                                <td>
                                  <button 
                                    className="btn btn-sm btn-outline-primary mr-1"
                                    title="Bearbeiten"
                                  >
                                    <i className="bi bi-pencil"/>
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger"
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    <div className="alert alert-info small mt-3 mb-0">
                      <strong><i className="bi bi-info-circle mr-2"/>Info:</strong>
                      Hier können Sie alle hochgeladenen EK-Rechnungen verwalten, bearbeiten und den Status überprüfen.
                      Rechnungen mit hoher Match-Confidence wurden automatisch zugeordnet.
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                                <td><strong style={{color: '#fff'}}>{k.konto}</strong></td>
                                <td><span style={{color: '#f0f0f0'}}>{k.bezeichnung}</span></td>
                                <td>
                                  {k.kontenklasse !== null && k.kontenklasse !== undefined ? (
                                    <span className="badge badge-info">{k.kontenklasse}</span>
                                  ) : (
                                    <small className="text-muted">-</small>
                                  )}
                                </td>
                                <td><span style={{color: '#d0d0d0'}}>{k.kontenklasseName || k.typ || 'Sonstiges'}</span></td>
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
        
        {/* Inbox Tab */}
        {tab === 'inbox' && (
          <div>
            <div className="card border-info mb-3">
              <div className="card-header bg-info text-white py-2 d-flex justify-content-between align-items-center">
                <strong><i className="bi bi-envelope mr-2"/>📧 E-Mail Inbox</strong>
                <button 
                  className="btn btn-sm btn-light"
                  onClick={fetchNewEmails}
                  disabled={emailFetchLoading}
                >
                  {emailFetchLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm mr-1"/>
                      Abrufen...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise mr-1"/>
                      Neue E-Mails abrufen
                    </>
                  )}
                </button>
              </div>
              <div className="card-body">
                {emailInboxLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-info"/>
                    <p className="mt-2">Lade E-Mails...</p>
                  </div>
                ) : (
                  <div>
                    {emailInbox.length === 0 ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-inbox display-4 d-block mb-3"/>
                        Keine E-Mails in der Inbox
                      </div>
                    ) : (
                      <div className="table-responsive" style={{maxHeight: '500px', overflow: 'auto'}}>
                        <table className="table table-sm table-hover">
                          <thead className="thead-light sticky-top">
                            <tr>
                              <th>Status</th>
                              <th>Datum</th>
                              <th>Von</th>
                              <th>Betreff</th>
                              <th>Anhänge</th>
                              <th>Aktionen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailInbox.map((email, idx) => (
                              <tr key={idx} className={email.status === 'pending' ? 'table-warning' : ''}>
                                <td>
                                  <span className={`badge ${
                                    email.status === 'pending' ? 'badge-warning' : 
                                    email.status === 'processed' ? 'badge-success' : 
                                    'badge-secondary'
                                  }`}>
                                    {email.status === 'pending' ? 'Neu' : 
                                     email.status === 'processed' ? 'Verarbeitet' : 
                                     'Archiviert'}
                                  </span>
                                </td>
                                <td className="small">
                                  {new Date(email.receivedDate).toLocaleDateString('de-DE')}
                                </td>
                                <td className="small">{email.from}</td>
                                <td className="small">{email.subject}</td>
                                <td>
                                  {email.attachments && email.attachments.length > 0 ? (
                                    <span className="badge badge-info">
                                      <i className="bi bi-paperclip mr-1"/>
                                      {email.attachments.length}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {email.status === 'pending' && (
                                    <button 
                                      className="btn btn-sm btn-success mr-1"
                                      onClick={() => handleProcessEmail(email)}
                                      title="Verarbeiten"
                                    >
                                      <i className="bi bi-pencil-square mr-1"/>
                                      Verarbeiten
                                    </button>
                                  )}
                                  {email.status === 'processed' && (
                                    <span className="badge badge-success">
                                      <i className="bi bi-check-lg"/> Erledigt
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    <div className="alert alert-info small mt-3">
                      <strong><i className="bi bi-info-circle mr-2"/>Info:</strong>
                      {emailInbox.length} E-Mails in der Inbox. 
                      Neue E-Mails werden automatisch alle 15 Minuten abgerufen.
                      {emailInbox.filter(e => e.status === 'pending').length > 0 && (
                        <span className="text-warning ml-2">
                          <strong>{emailInbox.filter(e => e.status === 'pending').length} unbearbeitete E-Mails</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Verarbeiten Modal */}
            {showEmailModal && selectedEmail && (
              <div className="card border-success mt-3" style={{maxWidth: '900px', margin: '1rem auto'}}>
                <div className="card-header bg-success text-white py-2 d-flex justify-content-between align-items-center">
                  <strong><i className="bi bi-envelope-open mr-2"/>E-Mail verarbeiten</strong>
                  <button 
                    className="btn btn-sm btn-light"
                    onClick={() => {
                      setShowEmailModal(false)
                      setSelectedEmail(null)
                    }}
                  >
                    <i className="bi bi-x-lg"/>
                  </button>
                </div>
                <div className="card-body">
                  {/* E-Mail Info */}
                  <div className="alert alert-info small mb-3">
                    <div><strong>Von:</strong> {selectedEmail.from}</div>
                    <div><strong>Betreff:</strong> {selectedEmail.subject}</div>
                    <div><strong>Datum:</strong> {new Date(selectedEmail.date).toLocaleString('de-DE')}</div>
                    <div><strong>Datei:</strong> {selectedEmail.filename} ({(selectedEmail.fileSize / 1024).toFixed(1)} KB)</div>
                    {selectedEmail.emailTextBody && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-primary">
                          <i className="bi bi-envelope-open mr-1"/>E-Mail-Text anzeigen
                        </summary>
                        <div className="mt-2 p-2 bg-light border rounded" style={{maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap'}}>
                          {selectedEmail.emailTextBody}
                        </div>
                      </details>
                    )}
                  </div>
                  
                  {/* Gemini Parse Button */}
                  <div className="mb-3">
                    <button 
                      className="btn btn-primary"
                      onClick={handleGeminiParse}
                      disabled={geminiParsing}
                    >
                      {geminiParsing ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2"/>
                          PDF wird analysiert...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-magic mr-2"/>
                          🤖 Mit Gemini automatisch auslesen
                        </>
                      )}
                    </button>
                    <small className="d-block text-muted mt-1">
                      Gemini 2.0 Flash liest automatisch: Lieferant, Rechnungsnr, Datum, Betrag
                    </small>
                  </div>
                  
                  {/* Gemini Ergebnis */}
                  {geminiResult && (
                    <div className="alert alert-success small mb-3">
                      <strong><i className="bi bi-check-circle mr-2"/>Gemini hat folgendes erkannt:</strong>
                      <div className="mt-2">
                        {geminiResult.lieferant && <div>✓ Lieferant: <strong>{geminiResult.lieferant}</strong></div>}
                        {geminiResult.rechnungsnummer && <div>✓ Rechnungsnr: <strong>{geminiResult.rechnungsnummer}</strong></div>}
                        {geminiResult.datum && <div>✓ Datum: <strong>{geminiResult.datum}</strong></div>}
                        {geminiResult.gesamtbetrag && <div>✓ Betrag: <strong>{geminiResult.gesamtbetrag.toFixed(2)} €</strong></div>}
                        {geminiResult.error && <div className="text-warning">⚠️ {geminiResult.error}</div>}
                      </div>
                    </div>
                  )}
                  
                  {/* Formular */}
                  <div className="form-group">
                    <label className="font-weight-bold">
                      Lieferant <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Lieferant suchen..."
                      value={emailForm.lieferantName}
                      onChange={e => {
                        setEmailForm(prev => ({ ...prev, lieferantName: e.target.value }))
                        handleKreditorSearch(e.target.value)
                      }}
                      list="kreditorenListEmail"
                    />
                    <datalist id="kreditorenListEmail">
                      {kreditoren.map(k => (
                        <option key={k.id} value={k.name}/>
                      ))}
                    </datalist>
                    
                    {ekMatchResult && (
                      <div className="mt-2">
                        <span className={`badge ${
                          ekMatchResult.confidence === 100 ? 'badge-success' : 'badge-info'
                        }`}>
                          ✓ {ekMatchResult.method === 'exact' ? 'Exakte Übereinstimmung' : 'Ähnlicher Lieferant'}: {ekMatchResult.name}
                        </span>
                        <small className="d-block text-muted mt-1">
                          Kreditor: {ekMatchResult.kreditorenNummer} | Aufwandskonto: {ekMatchResult.aufwandskonto}
                        </small>
                      </div>
                    )}
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Rechnungsnummer <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="text"
                          className="form-control"
                          placeholder="z.B. RE-2025-001"
                          value={emailForm.rechnungsnummer}
                          onChange={e => setEmailForm(prev => ({ ...prev, rechnungsnummer: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Rechnungsdatum <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="date"
                          className="form-control"
                          value={emailForm.rechnungsdatum}
                          onChange={e => setEmailForm(prev => ({ ...prev, rechnungsdatum: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">
                          Bruttobetrag <span className="text-danger">*</span>
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          className="form-control"
                          placeholder="119.00"
                          value={emailForm.gesamtBetrag}
                          onChange={e => setEmailForm(prev => ({ ...prev, gesamtBetrag: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="font-weight-bold">Aufwandskonto</label>
                        <select 
                          className="form-control"
                          value={emailForm.aufwandskonto}
                          onChange={e => setEmailForm(prev => ({ ...prev, aufwandskonto: e.target.value }))}
                        >
                          <option value="5200">5200 - Wareneinkauf</option>
                          <option value="6300">6300 - Versandkosten</option>
                          <option value="6530">6530 - Kraftstoff</option>
                          <option value="6600">6600 - Werbung</option>
                          <option value="6610">6610 - Bürobedarf</option>
                          <option value="6640">6640 - Versicherungen</option>
                          <option value="6805">6805 - Telefon/Internet</option>
                          <option value="6815">6815 - IT/Software</option>
                          <option value="6823">6823 - Lizenzgebühren</option>
                          <option value="6850">6850 - Bankgebühren</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-end gap-2">
                    <button 
                      className="btn btn-secondary mr-2"
                      onClick={() => {
                        setShowEmailModal(false)
                        setSelectedEmail(null)
                      }}
                    >
                      Abbrechen
                    </button>
                    <button 
                      className="btn btn-success"
                      onClick={handleSaveEmailInvoice}
                      disabled={ekLoading}
                    >
                      {ekLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2"/>
                          Speichere...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-lg mr-2"/>
                          Als EK-Rechnung speichern
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Kreditoren Tab */}
        {tab === 'kreditoren' && (
          <div>
            <div className="card border-info mb-3">
              <div className="card-header bg-info text-white py-2">
                <strong><i className="bi bi-building mr-2"/>Kreditoren-Verwaltung</strong>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="🔍 Lieferant suchen..."
                    value={kreditorenFilter}
                    onChange={e => setKreditorenFilter(e.target.value)}
                  />
                </div>
                
                {kreditorenLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-info"/>
                    <p className="mt-2">Lade Kreditoren...</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{maxHeight: '500px', overflow: 'auto'}}>
                    <table className="table table-sm table-hover">
                      <thead className="thead-light sticky-top">
                        <tr>
                          <th>Konto-Nr</th>
                          <th>Lieferant</th>
                          <th>Aufwandskonto</th>
                          <th>Aliases</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kreditoren
                          .filter(k => 
                            !kreditorenFilter || 
                            k.name.toLowerCase().includes(kreditorenFilter.toLowerCase()) ||
                            k.kreditorenNummer.includes(kreditorenFilter)
                          )
                          .map(k => (
                            <tr key={k.id}>
                              <td><span className="badge badge-info">{k.kreditorenNummer}</span></td>
                              <td>{k.name}</td>
                              <td><span className="badge badge-secondary">{k.standardAufwandskonto || '-'}</span></td>
                              <td className="small text-muted">
                                {k.aliases && k.aliases.length > 0 ? k.aliases.join(', ') : '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="alert alert-info small mt-3">
                  <strong><i className="bi bi-info-circle mr-2"/>Info:</strong>
                  {kreditoren.length} Kreditoren geladen. 
                  Das System lernt automatisch neue Zuordnungen, wenn Sie EK-Rechnungen manuell zuordnen.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Export Tab */}
        {tab === 'export' && (
          <div>
            <div className="card border-success mb-3">
              <div className="card-header bg-success text-white py-2">
                <strong><i className="bi bi-download mr-2"/>10it Export - Buchungsstapel generieren</strong>
              </div>
              <div className="card-body">
                <p className="small text-muted mb-3">
                  Exportiert alle Buchungen (VK-Rechnungen, Zahlungen, EK-Rechnungen) im 10it-Format (EXTF CSV).
                </p>
                
                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="small font-weight-bold">Von (Startdatum):</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={exportFrom}
                      onChange={e => setExportFrom(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="small font-weight-bold">Bis (Enddatum):</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={exportTo}
                      onChange={e => setExportTo(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button 
                      className="btn btn-success w-100"
                      onClick={handleExport}
                      disabled={exportLoading}
                    >
                      {exportLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2"/>
                          Exportiere...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-file-earmark-arrow-down mr-2"/>
                          CSV Exportieren
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="alert alert-info small">
                  <strong><i className="bi bi-info-circle mr-2"/>Enthaltene Daten:</strong>
                  <ul className="mb-0 mt-2">
                    <li>✅ VK-Rechnungen (Ausgangsrechnungen aus JTL)</li>
                    <li>✅ VK-Zahlungen (Zahlungseingänge aus JTL)</li>
                    <li>⚠️ EK-Rechnungen (nur wenn Kreditorenkonto zugeordnet)</li>
                    <li>❌ EK-Zahlungen (noch nicht implementiert)</li>
                  </ul>
                </div>
                
                <div className="card bg-light">
                  <div className="card-body small">
                    <h6>Export-Format:</h6>
                    <ul className="mb-0">
                      <li>CSV-Datei mit Semikolon-Trennung</li>
                      <li>UTF-8 Encoding mit BOM</li>
                      <li>Deutsche Zahlenformatierung (Komma als Dezimaltrenner)</li>
                      <li>10 Spalten: Konto, Kontobezeichnung, Datum, Belegnummer, Text, Gegenkonto, Soll, Haben, Steuer, Steuerkonto</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
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
                <strong>In Entwicklung:</strong> Zahlungsarten-Konfiguration
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  )
}
