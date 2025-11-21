'use client'

import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PreiseModule from '../components/PreiseModule'
import FibuModule from '../components/FibuModule'

// Lightweight utils inlined (avoid missing imports)
const toArray = (v) => Array.isArray(v) ? v : (v && v.data && Array.isArray(v.data) ? v.data : (v ? [v] : []))
const sortByDateAsc = (arr) => (arr||[]).slice().sort((a,b)=> new Date(a?.date||a?.Datum||0) - new Date(b?.date||b?.Datum||0))
const getJsonRaw = async (url, init) => {
  const started = performance.now()
  try {
    const res = await fetch(url, { cache:'no-store', ...init })
    const data = await res.json().catch(()=>null)
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now()-started), data, error: res.ok ? null : (data?.error || `HTTP ${res.status}`) }
  } catch (e) {
    return { ok:false, status:0, ms: Math.round(performance.now()-started), data:null, error:String(e) }
  }
}
const getJson = async (url, init) => {
  const r = await getJsonRaw(url, init)
  if (!r.ok) throw new Error(r.error||'Request failed')
  return r.data
}

// Mail Prompts View Component
function MailPromptsView() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [showCreatePromptModal, setShowCreatePromptModal] = useState(false)
  const [showEditPromptModal, setShowEditPromptModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(null)
  const [newPromptData, setNewPromptData] = useState({
    name: '',
    model: 'gpt-4o-mini',
    prompt: ''
  })
  
  useEffect(() => {
    loadPrompts()
  }, [])
  
  async function loadPrompts() {
    try {
      const data = await getJson('/api/coldleads/prompts')
      setPrompts(data.prompts || [])
    } catch (e) {
      console.error('Failed to load prompts:', e)
    } finally {
      setLoading(false)
    }
  }
  
  async function activatePrompt(version) {
    try {
      await fetch('/api/coldleads/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', version })
      })
      await loadPrompts()
      alert(`✅ Prompt ${version} ist jetzt aktiv`)
    } catch (e) {
      alert('❌ Fehler beim Aktivieren: ' + e.message)
    }
  }
  
  async function createNewPrompt() {
    if (!newPromptData.name || !newPromptData.prompt) {
      alert('❌ Bitte Name und Prompt ausfüllen')
      return
    }
    
    try {
      const response = await fetch('/api/coldleads/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newPromptData.name,
          model: newPromptData.model,
          prompt: newPromptData.prompt
        })
      })
      
      const data = await response.json()
      
      if (data.ok) {
        await loadPrompts()
        setShowCreatePromptModal(false)
        setNewPromptData({ name: '', model: 'gpt-4o-mini', prompt: '' })
        alert(`✅ Prompt v${data.version} erstellt!`)
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler beim Erstellen: ' + e.message)
    }
  }
  
  async function updatePrompt() {
    if (!editingPrompt) return
    
    try {
      const response = await fetch('/api/coldleads/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: editingPrompt.version,
          name: editingPrompt.name,
          model: editingPrompt.model,
          prompt: editingPrompt.prompt
        })
      })
      
      const data = await response.json()
      
      if (data.ok) {
        await loadPrompts()
        setShowEditPromptModal(false)
        setEditingPrompt(null)
        alert('✅ Prompt aktualisiert!')
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler beim Aktualisieren: ' + e.message)
    }
  }
  
  if (loading) {
    return (
      <div className="p-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Laden...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="mb-0">
          <i className="bi bi-gear mr-2"/>Mail Prompts Verwaltung
        </h4>
        <button 
          className="btn btn-sm btn-success"
          onClick={() => setShowCreatePromptModal(true)}
        >
          <i className="bi bi-plus-circle mr-1"/>Neuer Prompt
        </button>
      </div>
      
      {prompts.length === 0 ? (
        <div className="alert alert-info">
          Noch keine Prompts vorhanden. Erstellen Sie Ihren ersten Prompt!
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm">
            <thead className="thead-dark">
              <tr>
                <th style={{width:'80px'}}>Version</th>
                <th style={{width:'150px'}}>Name</th>
                <th style={{width:'120px'}}>Modell</th>
                <th style={{width:'130px'}}>Änderungsdatum</th>
                <th style={{width:'100px'}}>Versendet</th>
                <th style={{width:'100px'}}>Antworten</th>
                <th style={{width:'120px'}}>Conversion</th>
                <th style={{width:'100px'}}>Status</th>
                <th style={{width:'120px'}}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map(prompt => (
                <tr key={prompt._id} className={prompt.active ? 'table-success' : ''}>
                  <td>
                    <span className="badge badge-secondary">v{prompt.version}</span>
                  </td>
                  <td>{prompt.name}</td>
                  <td>
                    <code className="small">{prompt.model}</code>
                  </td>
                  <td className="small">
                    {new Date(prompt.updated_at).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className="badge badge-info">{prompt.stats.versendet}</span>
                  </td>
                  <td>
                    <span className="badge badge-success">{prompt.stats.antworten}</span>
                  </td>
                  <td>
                    <span className={`badge ${prompt.stats.conversionRate > 0 ? 'badge-success' : 'badge-secondary'}`}>
                      {prompt.stats.conversionRate.toFixed(2)}%
                    </span>
                  </td>
                  <td>
                    {prompt.active ? (
                      <span className="badge badge-success">
                        <i className="bi bi-check-circle mr-1"/>Aktiv
                      </span>
                    ) : (
                      <span className="badge badge-secondary">Inaktiv</span>
                    )}
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button
                        className="btn btn-outline-primary"
                        title="Prompt ansehen"
                        onClick={() => setSelectedPrompt(prompt)}
                      >
                        <i className="bi bi-eye"/>
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        title="Bearbeiten"
                        onClick={() => {
                          setEditingPrompt({...prompt})
                          setShowEditPromptModal(true)
                        }}
                      >
                        <i className="bi bi-pencil"/>
                      </button>
                      {!prompt.active && (
                        <button
                          className="btn btn-outline-success"
                          title="Aktivieren"
                          onClick={() => activatePrompt(prompt.version)}
                        >
                          <i className="bi bi-check-circle"/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Prompt Detail Modal */}
      {selectedPrompt && (
        <div 
          className="modal d-block" 
          style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
          onClick={() => setSelectedPrompt(null)}
        >
          <div 
            className="modal-dialog modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-file-text mr-2"/>
                  {selectedPrompt.name} (v{selectedPrompt.version})
                </h5>
                <button 
                  type="button" 
                  className="close"
                  onClick={() => setSelectedPrompt(null)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Modell:</strong> <code>{selectedPrompt.model}</code>
                </div>
                <div className="mb-3">
                  <strong>Prompt:</strong>
                  <pre 
                    className="bg-light p-3 rounded border" 
                    style={{
                      maxHeight: '400px',
                      overflow: 'auto',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {selectedPrompt.prompt}
                  </pre>
                </div>
                <div className="row">
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h3 className="mb-0">{selectedPrompt.stats.versendet}</h3>
                        <small className="text-muted">Versendet</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h3 className="mb-0">{selectedPrompt.stats.antworten}</h3>
                        <small className="text-muted">Antworten</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h3 className="mb-0">{selectedPrompt.stats.conversionRate.toFixed(2)}%</h3>
                        <small className="text-muted">Conversion Rate</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setSelectedPrompt(null)}
                >
                  Schließen
                </button>
                {!selectedPrompt.active && (
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      activatePrompt(selectedPrompt.version)
                      setSelectedPrompt(null)
                    }}
                  >
                    <i className="bi bi-check-circle mr-1"/>Aktivieren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Prompt Modal */}
      {showCreatePromptModal && (
        <div 
          className="modal d-block" 
          style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
          onClick={() => setShowCreatePromptModal(false)}
        >
          <div 
            className="modal-dialog modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-plus-circle mr-2"/>Neuen Prompt erstellen
                </h5>
                <button 
                  type="button" 
                  className="close"
                  onClick={() => setShowCreatePromptModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label><strong>Name:</strong></label>
                  <input
                    type="text"
                    className="form-control"
                    value={newPromptData.name}
                    onChange={(e) => setNewPromptData({...newPromptData, name: e.target.value})}
                    placeholder="z.B. Prompt 2 (Direkter Stil)"
                  />
                </div>
                <div className="form-group">
                  <label><strong>Modell:</strong></label>
                  <select
                    className="form-control"
                    value={newPromptData.model}
                    onChange={(e) => setNewPromptData({...newPromptData, model: e.target.value})}
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (schnell & günstig)</option>
                    <option value="gpt-4o">gpt-4o (beste Qualität)</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label><strong>Prompt-Text:</strong></label>
                  <textarea
                    className="form-control"
                    rows="15"
                    value={newPromptData.prompt}
                    onChange={(e) => setNewPromptData({...newPromptData, prompt: e.target.value})}
                    placeholder="Prompt hier einfügen... Verwenden Sie Platzhalter: {cleanedFirmenname}, {werkstoffe}, {werkstucke}, {anwendungen}"
                    style={{fontFamily: 'monospace', fontSize: '0.9rem'}}
                  />
                  <small className="text-muted">
                    Verfügbare Platzhalter: <code>{'{cleanedFirmenname}'}</code>, <code>{'{werkstoffe}'}</code>, <code>{'{werkstucke}'}</code>, <code>{'{anwendungen}'}</code>
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowCreatePromptModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-success"
                  onClick={createNewPrompt}
                >
                  <i className="bi bi-check-circle mr-1"/>Erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Prompt Modal */}
      {showEditPromptModal && editingPrompt && (
        <div 
          className="modal d-block" 
          style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
          onClick={() => setShowEditPromptModal(false)}
        >
          <div 
            className="modal-dialog modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-pencil mr-2"/>Prompt bearbeiten (v{editingPrompt.version})
                </h5>
                <button 
                  type="button" 
                  className="close"
                  onClick={() => setShowEditPromptModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label><strong>Name:</strong></label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingPrompt.name}
                    onChange={(e) => setEditingPrompt({...editingPrompt, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label><strong>Modell:</strong></label>
                  <select
                    className="form-control"
                    value={editingPrompt.model}
                    onChange={(e) => setEditingPrompt({...editingPrompt, model: e.target.value})}
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (schnell & günstig)</option>
                    <option value="gpt-4o">gpt-4o (beste Qualität)</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label><strong>Prompt-Text:</strong></label>
                  <textarea
                    className="form-control"
                    rows="15"
                    value={editingPrompt.prompt}
                    onChange={(e) => setEditingPrompt({...editingPrompt, prompt: e.target.value})}
                    style={{fontFamily: 'monospace', fontSize: '0.9rem'}}
                  />
                  <small className="text-muted">
                    Verfügbare Platzhalter: <code>{'{cleanedFirmenname}'}</code>, <code>{'{werkstoffe}'}</code>, <code>{'{werkstucke}'}</code>, <code>{'{anwendungen}'}</code>
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowEditPromptModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={updatePrompt}
                >
                  <i className="bi bi-save mr-1"/>Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiTile({ title, value, sub, demo }) {
  return (
    <div className="col-md-4 mb-3">
      <div className="card kpi h-100">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between">
            <div className="label mb-1 text-uppercase small">{title}</div>
            {demo ? <span className="badge badge-warning">Demo</span> : null}
          </div>
          <div className="value mb-0">{value}</div>
          {sub ? <div className="text-muted small mt-1">{sub}</div> : null}
        </div>
      </div>
    </div>
  )
}

const fmtCurrency = (n) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(Number(n||0))

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  
  // JTL/Sales Filter
  const [selectedWarengruppen, setSelectedWarengruppen] = useState([])
  const [selectedHersteller, setSelectedHersteller] = useState([])
  const [selectedLieferanten, setSelectedLieferanten] = useState([])
  const [availableWarengruppen, setAvailableWarengruppen] = useState([])
  const [availableHersteller, setAvailableHersteller] = useState([])
  const [availableLieferanten, setAvailableLieferanten] = useState([])
  
  const [from, setFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })
  const [to, setTo] = useState(()=> new Date().toISOString().slice(0,10))

  const [kpi, setKpi] = useState(null)
  const [kpiFees, setKpiFees] = useState(null)
  const [ordersSplit, setOrdersSplit] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [margin, setMargin] = useState(null)
  const [topPlatforms, setTopPlatforms] = useState([])
  const [topManufacturers, setTopManufacturers] = useState([])
  const [ts, setTs] = useState([])
  const [tsFees, setTsFees] = useState([])
  const [platTs, setPlatTs] = useState([])
  const [stacked, setStacked] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [autoAdjusted, setAutoAdjusted] = useState('')

  const revChartRef = useRef(null)
  const platChartRef = useRef(null)
  const revChart = useRef(null)
  const platChart = useRef(null)

  // Outbound
  const [prospects, setProspects] = useState([])
  const [form, setForm] = useState({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'', keywords:'' })
  const [compose, setCompose] = useState({ company:'', contactRole:'Einkauf', industry:'', useCases:'', hypotheses:'' })
  const [mail, setMail] = useState(null)

  // Sales tables
  const [salesTab, setSalesTab] = useState('products')
  const [topProducts, setTopProducts] = useState([])
  const [topCategories, setTopCategories] = useState([])
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState({ field: 'revenue', direction: 'desc' })

  // Kaltakquise
  const [coldLeadsTab, setColdLeadsTab] = useState('search')
  const [coldSearchForm, setColdSearchForm] = useState({ industry: '', region: '', limit: 10 })
  const [selectedProspectsForBulk, setSelectedProspectsForBulk] = useState([])
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false)
  const [bulkAnalyzeProgress, setBulkAnalyzeProgress] = useState({ current: 0, total: 0 })
  const [showEmailPreview, setShowEmailPreview] = useState(null)
  const [coldProspects, setColdProspects] = useState([])
  const [coldLoading, setColdLoading] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [generatedEmail, setGeneratedEmail] = useState(null)
  const [coldStatusFilter, setColdStatusFilter] = useState('all')
  const [coldStats, setColdStats] = useState({ total: 0, new: 0, analyzed: 0, no_email: 0, contacted: 0, replied: 0 })
  const [coldLeadStats, setColdLeadStats] = useState({ unreadReplies: 0, recentReplies: 0, awaitingFollowup: 0 })
  const [showColdProspectDetails, setShowColdProspectDetails] = useState(null)
  const [mailView, setMailView] = useState('prospects') // 'prospects', 'inbox', 'outbox'
  const [inboxEmails, setInboxEmails] = useState([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [selectedInboxEmail, setSelectedInboxEmail] = useState(null)
  const [outboxEmails, setOutboxEmails] = useState([])
  const [outboxLoading, setOutboxLoading] = useState(false)
  const [selectedOutboxEmail, setSelectedOutboxEmail] = useState(null)
  
  // DACH Crawler
  const [dachCrawlerForm, setDachCrawlerForm] = useState({ country: 'DE', region: '', industry: '', limit: 20 })
  const [dachCrawlerStats, setDachCrawlerStats] = useState(null)
  const [dachCrawlerProgress, setDachCrawlerProgress] = useState([])
  const [dachCrawlerLoading, setDachCrawlerLoading] = useState(false)
  
  // Autopilot
  const [autopilotState, setAutopilotState] = useState({ 
    running: false, 
    dailyLimit: 50, 
    dailyCount: 0, 
    remaining: 50,
    currentPhase: null,
    lastActivity: null
  })
  const [autopilotLimit, setAutopilotLimit] = useState(50)
  const autopilotIntervalRef = useRef(null)

  // Marketing → Warmaquise
  const [leads, setLeads] = useState([])
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState('')
  const [statusF, setStatusF] = useState('') // '', open, called, qualified, discarded
  const [b2bF, setB2bF] = useState('') // '', true, false
  const [minScoreF, setMinScoreF] = useState('')
  const [qF, setQF] = useState('')
  const [qTyping, setQTyping] = useState('')
  const [pageF, setPageF] = useState(1)
  const [limitF, setLimitF] = useState(20)
  const [sortF, setSortF] = useState('warmScore')
  const [orderF, setOrderF] = useState('desc')
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState('')
  const [noteFor, setNoteFor] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [netlog, setNetlog] = useState([]) // request inspector
  const [marketingSub, setMarketingSub] = useState('analytics') // analytics|googleads|glossar
  const [glossarSub, setGlossarSub] = useState('anwendungen') // anwendungen|kategorien|werkstoffe|maschinen
  const [glossarSearch, setGlossarSearch] = useState('')
  
  // Produkte (Artikel-Import)
  const [produkteTab, setProdukteTab] = useState('import') // import | browser | prompts
  
  // Amazon Bulletpoints
  const [amazonPrompts, setAmazonPrompts] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [promptModalMode, setPromptModalMode] = useState('create') // create | edit
  const [editingPrompt, setEditingPrompt] = useState(null)
  const [newPromptData, setNewPromptData] = useState({ name: '', beschreibung: '', prompt: '' })
  
  // Artikel Detail Tabs
  const [artikelDetailTab, setArtikelDetailTab] = useState('jtl') // jtl | bulletpoints
  const [artikelBulletpoints, setArtikelBulletpoints] = useState(null)
  const [generatingBulletpoints, setGeneratingBulletpoints] = useState(false)
  
  // Preise
  const [preiseTab, setPreiseTab] = useState('alte_pb') // alte_pb | neue_2025
  const [preiseSheet, setPreiseSheet] = useState('lagerware')
  const [preiseFormeln, setPreiseFormeln] = useState([])
  const [preiseEK, setPreiseEK] = useState('')
  const [preiseErgebnisse, setPreiseErgebnisse] = useState([])
  const [preiseLoading, setPreiseLoading] = useState(false)
  const [artikelImportRunning, setArtikelImportRunning] = useState(false)
  const [artikelImportProgress, setArtikelImportProgress] = useState({ imported: 0, total: 166854 })
  const [orphanedArticles, setOrphanedArticles] = useState([])
  const [checkingOrphans, setCheckingOrphans] = useState(false)
  const [artikelList, setArtikelList] = useState([])
  const [expandedArtikel, setExpandedArtikel] = useState(null)
  const [artikelPresence, setArtikelPresence] = useState(null)
  const [loadingPresence, setLoadingPresence] = useState(false)
  const [preisvergleichArtikel, setPreisvergleichArtikel] = useState(null)
  const [preisvergleichErgebnisse, setPreisvergleichErgebnisse] = useState([])
  const [preisvergleichLoading, setPreisvergleichLoading] = useState(false)
  const [artikelFilter, setArtikelFilter] = useState({ search: '', hersteller: '', warengruppe: '' })
  const [artikelPage, setArtikelPage] = useState(1)
  const [artikelPerPage, setArtikelPerPage] = useState(50)
  const [artikelTotal, setArtikelTotal] = useState(0)
  const [artikelTotalPages, setArtikelTotalPages] = useState(0)
  const [artikelLoading, setArtikelLoading] = useState(false)
  const [availableHerstellerArtikel, setAvailableHerstellerArtikel] = useState([])
  const [availableWarengruppenArtikel, setAvailableWarengruppenArtikel] = useState([])
  const [artikelSortBy, setArtikelSortBy] = useState('cArtNr')
  const [artikelSortOrder, setArtikelSortOrder] = useState('asc')
  
  // Analytics (GA4)
  const [analyticsMetrics, setAnalyticsMetrics] = useState(null)
  const [analyticsTrafficSources, setAnalyticsTrafficSources] = useState([])
  const [analyticsTopPages, setAnalyticsTopPages] = useState([])
  const [analyticsCategoryPages, setAnalyticsCategoryPages] = useState([])
  const [analyticsProductPages, setAnalyticsProductPages] = useState([])
  const [analyticsInfoPages, setAnalyticsInfoPages] = useState([])
  const [analyticsBeilegerData, setAnalyticsBeilegerData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30daysAgo')
  const [trafficSort, setTrafficSort] = useState({ field: 'sessions', order: 'desc' })
  const [categorySort, setCategorySort] = useState({ field: 'pageViews', order: 'desc' })
  const [productSort, setProductSort] = useState({ field: 'pageViews', order: 'desc' })
  const [allPagesSort, setAllPagesSort] = useState({ field: 'pageViews', order: 'desc' })
  const [showAllTraffic, setShowAllTraffic] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)
  
  // Charts
  const [metricsTimeSeries, setMetricsTimeSeries] = useState([])
  const [selectedKpiMetric, setSelectedKpiMetric] = useState('sessions')
  const [showTrafficChart, setShowTrafficChart] = useState(false)
  const [showCategoryChart, setShowCategoryChart] = useState(false)
  const [showProductChart, setShowProductChart] = useState(false)
  const [showAllPagesChart, setShowAllPagesChart] = useState(false)
  const [showInfoChart, setShowInfoChart] = useState(false)
  const [selectedTrafficSource, setSelectedTrafficSource] = useState(null)
  const [selectedCategoryPage, setSelectedCategoryPage] = useState(null)
  const [selectedProductPage, setSelectedProductPage] = useState(null)
  const [selectedAllPage, setSelectedAllPage] = useState(null)
  const [selectedInfoPage, setSelectedInfoPage] = useState(null)
  const [trafficSourceTimeSeries, setTrafficSourceTimeSeries] = useState([])
  const [categoryPageTimeSeries, setCategoryPageTimeSeries] = useState([])
  const [productPageTimeSeries, setProductPageTimeSeries] = useState([])
  const [allPageTimeSeries, setAllPageTimeSeries] = useState([])
  const [infoPageTimeSeries, setInfoPageTimeSeries] = useState([])
  
  // Google Ads
  const [googleAdsCampaigns, setGoogleAdsCampaigns] = useState([])
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false)

  const isDegradedFlag = (process.env.NEXT_PUBLIC_DEGRADED === '1')

  const pushLog = (entry) => {
    setNetlog(l => [{ ...entry, at: new Date().toLocaleTimeString() }, ...l.slice(0,9)])
  }

  const loadDateRangeAndAdjust = async () => {
    try {
      const dr = await getJson(`/api/jtl/sales/date-range`)
      if (dr?.ok && dr.minDate && dr.maxDate){
        const currentFrom = new Date(from)
        const currentTo = new Date(to)
        const min = new Date(dr.minDate)
        const max = new Date(dr.maxDate)
        if (currentTo < min || currentFrom > max){
          const newTo = dr.maxDate
          const d = new Date(newTo); d.setDate(d.getDate()-29)
          const newFrom = d.toISOString().slice(0,10)
          setFrom(newFrom); setTo(newTo)
          setAutoAdjusted(`Zeitraum automatisch angepasst auf ${newFrom} bis ${newTo}`)
        }
      }
    } catch(e){ /* ignore; fallback to UI defaults */ }
  }

  const setDemoSnapshot = () => {
    const today = new Date()
    const days = [...Array(30)].map((_,i)=>{ const d=new Date(today); d.setDate(d.getDate()-29+i); const ds=d.toISOString().slice(0,10); const rev=1000+Math.round(Math.random()*1500); const mar=Math.round(rev*0.35); return {date: ds, revenue: rev, margin_with_fees: Math.round(mar*0.8)} })
    const plats = ['Shop','Amazon','eBay']
    const platRows = []
    days.forEach(d => plats.forEach((p,j)=>{ platRows.push({ date:d.date, pName:p, revenue: Math.round((d.revenue*(0.5-j*0.15))*(0.6+Math.random()*0.3)) }) }))
    setKpi({ revenue: days.reduce((s,x)=>s+x.revenue,0), orders: 100, margin: days.reduce((s,x)=>s+Math.round(x.revenue*0.35),0) })
    setKpiFees({ margin_with_fees: days.reduce((s,x)=>s+x.margin_with_fees,0) })
    setOrdersSplit({ net_without_shipping: 22000, net_with_shipping: 25000, gross_without_shipping: 26200, gross_with_shipping: 29800 })
    setTs(days.map(d=>({ date:d.date, revenue:d.revenue, margin: Math.round(d.revenue*0.35) })))
    setTsFees(days.map(d=>({ date:d.date, margin_with_fees:d.margin_with_fees })))
    setPlatTs(platRows)
    setTopProducts([]); setTopCategories([])
    setDemoMode(true)
  }

  const fetchAll = async () => {
    setLoading(true); setError(''); setDemoMode(false)
    try {
      const started = performance.now()
      const [k1, k2, t1, t2, osRaw, poRaw, expRaw, marginRaw, topPlatRaw, topManufRaw] = await Promise.all([
        getJson(`/api/jtl/sales/kpi?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/kpi/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/orders/kpi/shipping-split?from=${from}&to=${to}`),
        getJsonRaw(`/api/jtl/purchase/orders?from=${from}&to=${to}`),
        getJsonRaw(`/api/jtl/purchase/expenses?from=${from}&to=${to}`),
        getJson(`/api/jtl/orders/kpi/margin?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/top-platforms?from=${from}&to=${to}&limit=100`),
        getJson(`/api/jtl/sales/top-manufacturers?from=${from}&to=${to}&limit=100`)
      ])
      
      // Map Sales API field names to what frontend expects
      const mappedK1 = { ...k1, revenue: k1?.net || 0, margin: k1?.margin || 0 } // Now includes margin!
      const mappedK2 = { ...k2, margin_with_fees: (Number(k2?.net || 0) - Number(k2?.platform_fees || 0)) }
      
      // Map timeseries data: net -> revenue, fees -> margin_with_fees
      const rawTsN = toArray(t1?.rows || t1)
      const rawTsFeesN = toArray(t2?.rows || t2)
      
      const tsN = sortByDateAsc(rawTsN.map(r => ({
        date: r?.date,
        revenue: Number(r?.net || r?.revenue || 0),
        orders: r?.orders || 0
      })))
      
      const tsFeesN = sortByDateAsc(rawTsFeesN.map(r => ({
        date: r?.date,
        margin_with_fees: Number(r?.net || 0) - Number(r?.fees || 0)
      })))
      
      setKpi(mappedK1)
      setKpiFees(mappedK2)
      setTs(tsN)
      setTsFees(tsFeesN)
      setPlatTs([]) // Platform timeseries removed - will implement later if needed
      setOrdersSplit(osRaw?.ok ? osRaw : null) // osRaw is full response with {ok, period, orders, net_*, gross_*}
      setPurchaseOrders(poRaw?.ok ? poRaw.data : null)
      setExpenses(expRaw?.ok ? expRaw.data : null)
      setMargin(marginRaw?.ok ? marginRaw : null) // marginRaw is also full response
      setTopPlatforms(topPlatRaw?.ok ? topPlatRaw.platforms : [])
      setTopManufacturers(topManufRaw?.ok ? topManufRaw.manufacturers : [])
      pushLog({ url:'/api/jtl/orders/kpi/shipping-split', status:200, ok:true, ms: Math.round(performance.now()-started) })
      if (isDegradedFlag) {
        const ksum = Number(mappedK1?.revenue||0) + Number(mappedK1?.orders||0) + Number(mappedK1?.margin||0)
        const hasData = (tsN?.length||0) + (tsFeesN?.length||0) > 0 || ksum > 0
        if (!hasData) setDemoSnapshot()
      }
    } catch (e) {
      setError(String(e))
      pushLog({ url:'/api/jtl/orders/kpi/shipping-split', status:0, ok:false, ms:0, error:String(e) })
      if (isDegradedFlag) { setDemoSnapshot() }
    }
    setLoading(false)
  }

  const fetchSalesTables = async () => {
    try {
      const [prods, cats] = await Promise.all([
        getJson(`/api/jtl/sales/top-products?limit=${limit}&from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/top-categories?limit=${limit}&from=${from}&to=${to}`)
      ])
      setTopProducts(Array.isArray(prods?.rows)?prods.rows:(Array.isArray(prods)?prods:toArray(prods)))
      setTopCategories(Array.isArray(cats?.rows)?cats.rows:(Array.isArray(cats)?cats:toArray(cats)))
    } catch(e){ 
      if (isDegradedFlag){ 
        setTopProducts([]); 
        setTopCategories([]) 
      } 
    }
  }

  // Warmaquise
  const queryLeads = async () => {
    setLeadsLoading(true); setLeadsError('')
    const params = new URLSearchParams()
    if (statusF) params.set('status', statusF)
    if (b2bF) params.set('b2b', b2bF)
    if (minScoreF) params.set('minScore', String(minScoreF))
    if (qF) params.set('q', qF)
    params.set('page', String(pageF))
    params.set('limit', String(limitF))
    params.set('sort', sortF); params.set('order', orderF)
    const url = `/api/leads?${params.toString()}`
    const r = await getJsonRaw(url)
    pushLog({ url, status: r.status, ok: r.ok, ms: r.ms, error: r.error })
    if (!r.ok) { setLeadsError(r.error||'Request failed'); setLeads([]); setLeadsTotal(0); setLeadsLoading(false); return }
    const data = r.data||{}
    setLeads(Array.isArray(data.rows)?data.rows:[])
    setLeadsTotal(Number(data.total||0))
    setLeadsLoading(false)
  }

  const runImport = async () => {
    setImporting(true)
    // Warmakquise: Kunden die mind. 4 Monate, max. 24 Monate inaktiv sind
    const params = {
      minInactiveMonths: 4,  // Mindestens 4 Monate seit letzter Bestellung
      maxInactiveMonths: 24, // Maximal 24 Monate seit letzter Bestellung
      minOrders: 2,          // Mindestens 2 Bestellungen
      minRevenue: 1000       // Mindestens 1000 EUR Umsatz
    }
    const r = await getJsonRaw('/api/leads/import', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(params) })
    pushLog({ url:'/api/leads/import', status:r.status, ok:r.ok, ms:r.ms, error:r.error })
    setImporting(false)
    if (!r.ok) { setToast(`Import fehlgeschlagen: ${r.error}`); return }
    setToast(`Import abgeschlossen: ${r.data?.imported||0} aktualisiert (Gesamt: ${r.data?.count||0})`)
    setPageF(1)
    await queryLeads()
  }

  const changeStatus = async (lead, status) => {
    const prev = lead.status
    setLeads(ls => ls.map(x => x.id===lead.id ? { ...x, status } : x))
    const r = await getJsonRaw(`/api/leads/${lead.id}/status`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ status }) })
    pushLog({ url:`/api/leads/${lead.id}/status`, status:r.status, ok:r.ok, ms:r.ms, error:r.error })
    if (!r.ok) { setLeads(ls => ls.map(x => x.id===lead.id ? { ...x, status: prev } : x)); setToast('Status-Update fehlgeschlagen'); }
  }

  const saveNote = async () => {
    if (!noteFor || !noteText.trim()) return
    const id = noteFor.id
    const r = await getJsonRaw(`/api/leads/${id}/note`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ text: noteText }) })
    pushLog({ url:`/api/leads/${id}/note`, status:r.status, ok:r.ok, ms:r.ms, error:r.error })
    if (r.ok) {
      setToast('Notiz gespeichert')
      setLeads(ls => ls.map(x => x.id===id ? { ...x, notes: [...(x.notes||[]), { at:new Date().toISOString(), by:'user', text: noteText }] } : x))
      setNoteFor(null); setNoteText('')
    } else {
      setToast('Notiz fehlgeschlagen')
    }
  }

  const exportLeadsCSV = () => {
    const params = new URLSearchParams()
    if (statusF) params.set('status', statusF)
    if (b2bF) params.set('b2b', b2bF)
    if (minScoreF) params.set('minScore', String(minScoreF))
    const url = `/api/leads/export.csv?${params.toString()}`
    window.open(url, '_blank')
  }

  // Debounce search
  useEffect(() => { const t = setTimeout(()=>{ setQF(qTyping); setPageF(1) }, 300); return ()=>clearTimeout(t) }, [qTyping])

  useEffect(() => { loadDateRangeAndAdjust(); fetchAll(); fetchSalesTables(); refreshProspects(); loadColdLeadStats() }, [])
  useEffect(() => { fetchAll(); fetchSalesTables() }, [from, to, limit])
  useEffect(() => { if (activeTab==='warmakquise') queryLeads() }, [activeTab, statusF, b2bF, minScoreF, qF, pageF, limitF, sortF, orderF])
  useEffect(() => { 
    if (activeTab==='kaltakquise') {
      loadColdProspects()
      loadColdLeadStats()
    }
  }, [activeTab, coldStatusFilter])
  
  // Lade Autopilot Status beim Start
  useEffect(() => {
    loadAutopilotStatus()
    
    // Cleanup: Stoppe Polling beim Unmount
    return () => {
      stopAutopilotPolling()
    }
  }, [])
  // Autopilot Status regelmäßig laden
  useEffect(() => {
    if (activeTab === 'kaltakquise') {
      loadAutopilotStatus()
      const interval = setInterval(loadAutopilotStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  // Lade Postausgang/Posteingang wenn Ansicht wechselt
  useEffect(() => {
    if (mailView === 'outbox') {
      loadOutbox()
    } else if (mailView === 'inbox') {
      loadInbox()
    }
  }, [mailView])
  
  // Starte/Stoppe Polling basierend auf Autopilot State
  useEffect(() => {
    if (autopilotState.running && !autopilotIntervalRef.current) {
      startAutopilotPolling()
    } else if (!autopilotState.running && autopilotIntervalRef.current) {
      stopAutopilotPolling()
    }
  }, [autopilotState.running])
  useEffect(() => { 
    if (activeTab==='marketing' && marketingSub==='analytics') {
      console.log('[Analytics] Loading...', {analyticsDateRange})
      loadAnalytics() 
    }
  }, [activeTab, marketingSub, analyticsDateRange])
  useEffect(() => { if (activeTab==='marketing' && marketingSub==='googleads') loadGoogleAds() }, [activeTab, marketingSub])
  
  // Load filter options when Sales tab is active
  useEffect(() => {
    if (activeTab === 'sales') {
      loadFilterOptions()
    }
  }, [activeTab])

  useEffect(() => {
    const applyHash = () => { const h=(window.location.hash||'#dashboard').replace('#',''); if (['dashboard','sales','marketing','glossar','kaltakquise','warmakquise','outbound','produkte','preise','fibu'].includes(h)) setActiveTab(h) }
    applyHash(); window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  useEffect(() => { renderCharts() }, [ts, tsFees, platTs, stacked])

  // Produkte: Import-Status beim Tab-Wechsel laden UND beim ersten Laden
  useEffect(() => {
    if (activeTab === 'produkte') {
      loadArtikelStatus()
    }
  }, [activeTab])

  // Produkte: Import-Status initial laden (nur einmal beim Mount)
  useEffect(() => {
    loadArtikelStatus()
  }, [])

  // Produkte: Filter-Optionen beim Browser-Tab laden
  useEffect(() => {
    if (activeTab === 'produkte' && produkteTab === 'browser') {
      loadArtikelFilters()
    }
  }, [activeTab, produkteTab])

  // Produkte: Artikel-Liste laden wenn Filter oder Seite sich ändert
  useEffect(() => {
    if (activeTab === 'produkte' && produkteTab === 'browser' && artikelImportProgress.imported > 0) {
      loadArtikelList()
    }
  }, [activeTab, produkteTab, artikelPage, artikelPerPage, artikelFilter.search, artikelFilter.hersteller, artikelFilter.warengruppe, artikelSortBy, artikelSortOrder])

  const renderCharts = () => {
    if (!window.Chart) return
    // Umsatz vs Marge (with fees)
    const labels = (ts||[]).map(x=>x?.date).filter(Boolean)
    const revenue = (ts||[]).map(x=>x?.revenue ?? x?.umsatz ?? 0)
    const marginF = (tsFees||[]).map(x=>x?.margin_with_fees ?? x?.marge_with_fees ?? 0)

    const ctx1 = revChartRef.current?.getContext('2d')
    if (ctx1) {
      if (revChart.current) revChart.current.destroy()
      if (labels.length===0 && marginF.length===0) {
        ctx1.fillStyle = '#1d232b'; ctx1.fillRect(0,0,ctx1.canvas.width, ctx1.canvas.height)
      } else {
        revChart.current = new window.Chart(ctx1, {
          type: 'line',
          data: { labels, datasets:[
            { label:'Umsatz', data: revenue, borderColor:'#2dd4bf', backgroundColor:'rgba(45,212,191,0.2)', tension:.3, yAxisID:'y' },
            { label:'Marge (mit Gebühren)', data: marginF, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.2)', tension:.3, yAxisID:'y1' }
          ]},
          options:{ responsive:true, interaction:{ mode:'index', intersect:false }, plugins:{ legend:{ labels:{ color:'var(--txt)' } } }, scales:{ y:{ ticks:{ color:'var(--muted)'}, beginAtZero:true }, y1:{ position:'right', ticks:{ color:'var(--muted)'}, beginAtZero:true }, x:{ ticks:{ color:'var(--muted)'} } } }
        })
      }
    }

    // Plattform Kurven
    const seriesByKey = {}
    for(const r of (platTs||[])){
      const key = r?.pKey || r?.pName || 'Serie'
      if(!seriesByKey[key]) seriesByKey[key] = { label:r?.pName||String(key), data:{} }
      if (r?.date) seriesByKey[key].data[r.date] = (seriesByKey[key].data[r.date]||0) + (r?.revenue||r?.umsatz||0)
    }
    const allDates = Array.from(new Set((platTs||[]).map(r=>r?.date).filter(Boolean))).sort()
    const datasets = Object.values(seriesByKey).map((s,i)=>{
      const colorArr = ['#38bdf8','#34d399','#f6b10a','#f97316','#a78bfa','#fb7185']
      const c = colorArr[i % colorArr.length]
      return { label:s.label, data: allDates.map(d=>s.data[d]||0), borderColor:c, backgroundColor:c+'33', tension:.3, fill: stacked }
    })
    const ctx2 = platChartRef.current?.getContext('2d')
    if (ctx2) {
      if (platChart.current) platChart.current.destroy()
      if (allDates.length===0 || datasets.length===0) {
        ctx2.fillStyle = '#1d232b'; ctx2.fillRect(0,0,ctx2.canvas.width, ctx2.canvas.height)
      } else {
        platChart.current = new window.Chart(ctx2, { type:'line', data:{ labels:allDates, datasets }, options:{ responsive:true, interaction:{ mode:'index', intersect:false }, plugins:{ legend:{ labels:{ color:'var(--txt)'}} }, scales:{ x:{ stacked }, y:{ stacked, ticks:{ color:'var(--muted)'}, beginAtZero:true } } } })
      }
    }
  }

  const refreshProspects = async () => {
    try { const res = await fetch('/api/prospects'); const data = await res.json(); setProspects(Array.isArray(data)?data:[]) } catch(e){ console.error(e) }
  }

  const submitProspect = async (e) => {
    e.preventDefault()
    try { const res = await fetch('/api/prospects', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) }); await res.json(); setForm({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'', keywords:'' }); await refreshProspects() } catch(e){ console.error(e) }
  }
  const analyzeCompany = async (p) => {
    try { const res = await fetch('/api/analyze', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name:p.name, website:p.website, industry:p.industry }) }); const data = await res.json(); alert('Analyse erstellt. Produktgruppen: '+(data?.productGroups||[]).join(', ')) } catch(e){ console.error(e) }
  }
  const generateMail = async (e) => {
    e.preventDefault(); try { const res = await fetch('/api/mailer/compose', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...compose, useCases: compose.useCases.split(',').map(s=>s.trim()), hypotheses: compose.hypotheses }) }); const data=await res.json(); setMail(data) } catch(e){ console.error(e) }
  }

  const exportCSV = (rows, filename) => {
    const arr = Array.isArray(rows) ? rows : toArray(rows)
    const csv = arr.map(r=>Object.values(r).map(x=>`"${(x??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
  }

  // Sortier-Funktion für Analytics-Tabellen
  const sortData = (data, field, order) => {
    return [...data].sort((a, b) => {
      const aVal = a[field] || 0
      const bVal = b[field] || 0
      if (order === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }

  const toggleSort = (currentSort, setSort, field) => {
    if (currentSort.field === field) {
      setSort({ field, order: currentSort.order === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ field, order: 'desc' })
    }
  }

  // Funktion zum Gruppieren von Seiten nach pagePath (entfernt mehrsprachige Duplikate)
  const consolidatePages = (pages) => {
    const grouped = {}
    pages.forEach(page => {
      const path = page.pagePath
      if (!grouped[path]) {
        grouped[path] = {
          pagePath: path,
          pageTitle: page.pageTitle,
          pageViews: 0,
          uniquePageViews: 0,
          avgTimeOnPage: 0,
          count: 0
        }
      }
      grouped[path].pageViews += page.pageViews
      grouped[path].uniquePageViews += page.uniquePageViews
      grouped[path].avgTimeOnPage += page.avgTimeOnPage
      grouped[path].count += 1
    })
    
    // Durchschnitt für avgTimeOnPage berechnen
    return Object.values(grouped).map(item => ({
      ...item,
      avgTimeOnPage: item.avgTimeOnPage / item.count
    }))
  }

  // Analytics Functions
  const loadAnalytics = async () => {
    console.log('[Analytics] Start loading...')
    setAnalyticsLoading(true)
    try {
      const dateParam = `startDate=${analyticsDateRange}&endDate=today`
      
      console.log('[Analytics] Fetching APIs...')
      // Parallel laden
      const [metricsRes, sourcesRes, topPagesRes, categoryRes, productRes, infoRes, beilegerRes, timeSeriesRes] = await Promise.all([
        fetch(`/api/analytics/metrics?${dateParam}`),
        fetch(`/api/analytics/traffic-sources?${dateParam}&limit=1000`),
        fetch(`/api/analytics/top-pages?${dateParam}&limit=100`),
        fetch(`/api/analytics/category-pages?${dateParam}`),
        fetch(`/api/analytics/product-pages?${dateParam}&limit=100`),
        fetch(`/api/analytics/info-pages?${dateParam}`),
        fetch(`/api/analytics/beileger?${dateParam}`),
        fetch(`/api/analytics/timeseries/metrics?${dateParam}`)
      ])
      
      console.log('[Analytics] Parsing responses...')
      
      // Check for errors first
      if (!metricsRes.ok) throw new Error(`Metrics API failed: ${metricsRes.status}`)
      if (!sourcesRes.ok) throw new Error(`Traffic Sources API failed: ${sourcesRes.status}`)
      if (!topPagesRes.ok) throw new Error(`Top Pages API failed: ${topPagesRes.status}`)
      if (!categoryRes.ok) throw new Error(`Category Pages API failed: ${categoryRes.status}`)
      if (!productRes.ok) throw new Error(`Product Pages API failed: ${productRes.status}`)
      if (!infoRes.ok) throw new Error(`Info Pages API failed: ${infoRes.status}`)
      if (!beilegerRes.ok) throw new Error(`Beileger API failed: ${beilegerRes.status}`)
      if (!timeSeriesRes.ok) throw new Error(`Time Series API failed: ${timeSeriesRes.status}`)
      
      const metrics = await metricsRes.json()
      const sources = await sourcesRes.json()
      const topPages = await topPagesRes.json()
      const category = await categoryRes.json()
      const product = await productRes.json()
      const info = await infoRes.json()
      const beileger = await beilegerRes.json()
      const timeSeries = await timeSeriesRes.json()
      
      console.log('[Analytics] Consolidating pages...', {topPages: topPages.length, category: category.length, product: product.length, info: info.length})
      
      setAnalyticsMetrics(metrics)
      setAnalyticsTrafficSources(sources)
      setAnalyticsTopPages(consolidatePages(topPages))
      setAnalyticsCategoryPages(consolidatePages(category))
      setAnalyticsProductPages(consolidatePages(product))
      setAnalyticsInfoPages(consolidatePages(info))
      setAnalyticsBeilegerData(beileger)
      setMetricsTimeSeries(timeSeries)
      
      console.log('[Analytics] Done!')
    } catch (e) {
      console.error('[Analytics] Load failed:', e)
      alert('Analytics konnte nicht geladen werden: ' + e.message)
    } finally {
      setAnalyticsLoading(false)
    }
  }
  
  const loadPageTimeSeries = async (pagePath, setterFn) => {
    try {
      const dateParam = `startDate=${analyticsDateRange}&endDate=today&pagePath=${encodeURIComponent(pagePath)}`
      const res = await fetch(`/api/analytics/timeseries/page?${dateParam}`)
      const data = await res.json()
      setterFn(data)
    } catch (e) {
      console.error('Page time series load failed:', e)
    }
  }

  const loadInbox = async () => {
    setInboxLoading(true)
    try {
      const res = await fetch('/api/coldleads/inbox')
      const data = await res.json()
      if (data.emails) {
        setInboxEmails(data.emails)
      } else if (data.error) {
        console.error('Inbox error:', data.error)
      }
    } catch (e) {
      console.error('Inbox load failed:', e)
    } finally {
      setInboxLoading(false)
    }
  }

  const loadOutbox = async () => {
    setOutboxLoading(true)
    try {
      const res = await fetch('/api/coldleads/postausgang?limit=100')
      const data = await res.json()
      if (data.ok) {
        setOutboxEmails(data.emails || [])
      }
    } catch (e) {
      console.error('Outbox load failed:', e)
    } finally {
      setOutboxLoading(false)
    }
  }

  const loadGoogleAds = async () => {
    setGoogleAdsLoading(true)
    try {
      const res = await fetch('/api/google-ads/campaigns')
      const data = await res.json()
      if (data.campaigns) {
        setGoogleAdsCampaigns(data.campaigns)
      } else if (data.error) {
        console.error('Google Ads Error:', data.error)
      }
    } catch (e) {
      console.error('Google Ads load failed:', e)
    }
    setGoogleAdsLoading(false)
  }

  const loadFilterOptions = async () => {
    try {
      const [wgRes, herstRes, liefRes] = await Promise.all([
        fetch('/api/jtl/sales/filters/warengruppen'),
        fetch('/api/jtl/sales/filters/hersteller'),
        fetch('/api/jtl/sales/filters/lieferanten')
      ])

      const wgData = await wgRes.json()
      const herstData = await herstRes.json()
      const liefData = await liefRes.json()

      if (wgData.ok) setAvailableWarengruppen(wgData.values || [])
      if (herstData.ok) setAvailableHersteller(herstData.values || [])
      if (liefData.ok) setAvailableLieferanten(liefData.values || [])
    } catch (e) {
      console.error('Filter options load failed:', e)
    }
  }

  const loadGlossary = async () => {
    console.log('[Glossary] Loading glossary data...')
    // Placeholder function for glossary loading
    // This would typically load glossary data from an API
    try {
      // const res = await fetch('/api/glossary')
      // const data = await res.json()
      console.log('[Glossary] Glossary loaded successfully')
    } catch (e) {
      console.error('[Glossary] Load failed:', e)
    }
  }

  // Kaltakquise Functions
  // Load Cold Lead Stats
  const loadColdLeadStats = async () => {
    try {
      const data = await getJson('/api/coldleads/stats')
      setColdLeadStats({
        unreadReplies: data.unreadReplies || 0,
        recentReplies: data.recentReplies || 0,
        awaitingFollowup: data.awaitingFollowup || 0
      })
    } catch (e) {
      console.error('Failed to load cold lead stats:', e)
    }
  }
  
  // Autopilot Funktionen
  const loadAutopilotStatus = async () => {
    try {
      const res = await fetch('/api/coldleads/autopilot/status')
      const data = await res.json()
      if (data.ok) {
        setAutopilotState(data.state)
        setAutopilotLimit(data.state.dailyLimit)
      }
    } catch (e) {
      console.error('Load autopilot status failed:', e)
    }
  }
  
  const startAutopilot = async () => {
    try {
      const res = await fetch('/api/coldleads/autopilot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyLimit: autopilotLimit })
      })
      const data = await res.json()
      if (data.ok) {
        setToast('Autopilot gestartet!')
        loadAutopilotStatus()
        // Starte Polling
        startAutopilotPolling()
      } else {
        setToast('Fehler: ' + data.error)
      }
    } catch (e) {
      setToast('Fehler beim Starten: ' + e.message)
    }
  }
  
  const stopAutopilot = async () => {
    try {
      const res = await fetch('/api/coldleads/autopilot/stop', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setToast('Autopilot gestoppt')
        loadAutopilotStatus()
        // Stoppe Polling
        stopAutopilotPolling()
      } else {
        setToast('Fehler: ' + data.error)
      }
    } catch (e) {
      setToast('Fehler beim Stoppen: ' + e.message)
    }
  }
  
  const autopilotTick = async () => {
    try {
      const res = await fetch('/api/coldleads/autopilot/tick', { method: 'POST' })
      const data = await res.json()
      
      if (data.ok) {
        // Update Status nach jedem Tick
        loadAutopilotStatus()
        loadColdProspects()
        loadColdLeadStats()
        
        if (data.action === 'email_sent') {
          console.log('[Autopilot] Email gesendet an:', data.prospect.company_name)
        } else if (data.action === 'limit_reached') {
          setToast('Session-Limit erreicht!')
          stopAutopilot()
        }
      }
    } catch (e) {
      console.error('Autopilot tick failed:', e)
    }
  }
  
  const startAutopilotPolling = () => {
    if (autopilotIntervalRef.current) return
    
    console.log('[Autopilot] Starting polling (60s interval)')
    autopilotIntervalRef.current = setInterval(() => {
      autopilotTick()
    }, 60000) // Alle 60 Sekunden
  }
  
  const stopAutopilotPolling = () => {
    if (autopilotIntervalRef.current) {
      clearInterval(autopilotIntervalRef.current)
      autopilotIntervalRef.current = null
      console.log('[Autopilot] Polling stopped')
    }
  }
  
  const sendFollowups = async () => {
    try {
      setColdLoading(true)
      const res = await fetch('/api/coldleads/followup/check', { method: 'POST' })
      const data = await res.json()
      setColdLoading(false)
      
      if (data.ok) {
        setToast(`Follow-ups versendet: ${data.sent}/${data.count}`)
        loadColdProspects()
      } else {
        setToast('Fehler: ' + data.error)
      }
    } catch (e) {
      setColdLoading(false)
      setToast('Fehler: ' + e.message)
    }
  }
  
  const changeProspectStatus = async (prospectId, newStatus, oldStatus) => {
    try {
      const res = await fetch('/api/coldleads/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: prospectId, 
          status: newStatus,
          oldStatus
        })
      })
      const data = await res.json()
      
      if (data.ok) {
        setToast(`Status geändert zu: ${newStatus}`)
        loadColdProspects()
        loadColdStats()
      } else {
        setToast('Fehler: ' + data.error)
      }
    } catch (e) {
      setToast('Fehler: ' + e.message)
    }
  }

  const loadColdProspects = async (filterOverride = null) => {
    try {
      const filterToUse = filterOverride || coldStatusFilter
      const res = await fetch(`/api/coldleads/search?status=${filterToUse}&limit=200`)
      const data = await res.json()
      if (data.ok) {
        setColdProspects(data.prospects)
        console.log(`Loaded ${data.prospects.length} prospects with status: ${filterToUse}`)
        
        // Statistiken berechnen - lade alle Prospects für korrekte Zählung
        const allRes = await fetch(`/api/coldleads/search?status=all&limit=1000`)
        const allData = await allRes.json()
        if (allData.ok) {
          const all = allData.prospects
          setColdStats({
            total: all.length,
            new: all.filter(p => p.status === 'new').length,
            analyzed: all.filter(p => p.status === 'analyzed').length,
            no_email: all.filter(p => p.status === 'no_email').length,
            contacted: all.filter(p => p.status === 'contacted').length,
            replied: all.filter(p => p.hasReply === true).length
          })
          console.log(`Stats: ${all.length} total, ${all.filter(p => p.status === 'analyzed').length} analyzed`)
        }
      }
    } catch (e) {
      console.error('loadColdProspects error:', e)
    }
  }

  const searchColdLeads = async () => {
    if (!coldSearchForm.industry || !coldSearchForm.region) {
      alert('Bitte Branche und Region eingeben'); return
    }
    setColdLoading(true)
    try {
      const res = await fetch('/api/coldleads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coldSearchForm)
      })
      const data = await res.json()
      if (data.ok) {
        setColdProspects(data.prospects)
        alert(`${data.count} Firmen gefunden!`)
        loadColdProspects() // Refresh
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setColdLoading(false)
  }

  // DACH Crawler Funktionen
  const loadDachStats = async () => {
    try {
      const res = await fetch('/api/coldleads/dach/stats')
      const data = await res.json()
      if (data.ok) {
        setDachCrawlerStats(data)
      }
    } catch (e) {
      console.error('Error loading DACH stats:', e)
    }
  }

  const loadDachProgress = async () => {
    try {
      const res = await fetch('/api/coldleads/dach/status')
      const data = await res.json()
      if (data.ok) {
        setDachCrawlerProgress(data.progress)
      }
    } catch (e) {
      console.error('Error loading DACH progress:', e)
    }
  }

  const startDachCrawl = async () => {
    if (!dachCrawlerForm.region || !dachCrawlerForm.industry) {
      alert('Bitte Region und Branche auswählen')
      return
    }
    
    if (!confirm(`DACH-Crawling starten für:\n${dachCrawlerForm.country} / ${dachCrawlerForm.region} / ${dachCrawlerForm.industry}?\n\nDies kann einige Minuten dauern.`)) {
      return
    }

    setDachCrawlerLoading(true)
    try {
      const res = await fetch('/api/coldleads/dach/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dachCrawlerForm)
      })
      const data = await res.json()
      if (data.ok) {
        alert(`✅ ${data.count} Firmen gefunden!\n\nStatus: ${data.progress.status}\nRegion: ${data.progress.region}`)
        loadDachStats()
        loadDachProgress()
        loadColdProspects()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    }
    setDachCrawlerLoading(false)
  }

  const analyzeProspect = async (prospect) => {
    if (coldLoading) return
    setColdLoading(true)
    try {
      // Nutze neue SCORE Deep-Analysis API
      const res = await fetch('/api/coldleads/analyze-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          website: prospect.website,
          firmenname: prospect.company_name,
          branche: prospect.industry,
          prospectId: prospect.id
        })
      })
      const data = await res.json()
      
      if (data.success) {
        const analysis = data.analysis
        console.log(`✓ ${prospect.company_name}: Qualität ${analysis.analyse_qualität}%`)
        
        // Erstelle Zusammenfassung
        const kontakte = analysis.kontaktpersonen.length
        const emails = analysis.kontaktpersonen.filter(k => k.email).length
        const produkte = analysis.potenzielle_produkte.length
        const werkstoffe = analysis.werkstoffe.map(w => w.name).join(', ')
        
        // WICHTIG: Stats UND Prospects-Liste neu laden
        await loadColdLeadStats()
        
        // Wechsle zum "Analysiert" Tab ZUERST
        setColdStatusFilter('analyzed')
        
        // Dann Prospects mit explizitem 'analyzed' Filter laden
        await loadColdProspects('analyzed')
        
        alert(`✅ Analyse abgeschlossen!\n\n` +
          `Qualität: ${analysis.analyse_qualität}%\n` +
          `Branche: ${analysis.branche}\n` +
          `Werkstoffe: ${werkstoffe || 'Keine gefunden'}\n` +
          `Kontakte: ${kontakte} (${emails} mit E-Mail)\n` +
          `Produktempfehlungen: ${produkte}\n\n` +
          `➡️ Wechsle zu "Analysiert" Tab für Details`)
      } else {
        alert('❌ Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (err) {
      console.error(err)
      alert('❌ Fehler beim Analysieren: ' + err.message)
    } finally {
      setColdLoading(false)
    }
  }

  const deleteProspect = async (prospectId) => {
    try {
      const res = await fetch('/api/coldleads/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: prospectId })
      })
      const data = await res.json()
      if (data.ok) {
        console.log('Prospect deleted:', prospectId)
        await loadColdProspects()
        await loadColdLeadStats()
      } else {
        alert('Fehler beim Löschen: ' + data.error)
      }
    } catch (e) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  // E-Mail generieren
  const [emailPreview, setEmailPreview] = useState(null)
  const [generatingEmail, setGeneratingEmail] = useState(false)

  const generateEmail = async (prospect, kontaktpersonIndex = null) => {
    if (generatingEmail) return
    setGeneratingEmail(true)
    
    try {
      const res = await fetch('/api/coldleads/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prospectId: prospect.id,
          kontaktpersonIndex
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        // Zeige E-Mail Vorschau
        setEmailPreview({
          prospect,
          email: data.email,
          kontaktperson: kontaktpersonIndex !== null && prospect.analysis.kontaktpersonen[kontaktpersonIndex]
            ? prospect.analysis.kontaktpersonen[kontaktpersonIndex]
            : null
        })
      } else {
        alert('❌ Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (err) {
      console.error(err)
      alert('❌ Fehler beim Generieren: ' + err.message)
    } finally {
      setGeneratingEmail(false)
    }
  }

  // Bulk-Analyse für ausgewählte Prospects
  const bulkAnalyzeProspects = async () => {
    if (selectedProspectsForBulk.length === 0) return
    
    setBulkAnalyzing(true)
    setBulkAnalyzeProgress({ current: 0, total: selectedProspectsForBulk.length })
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < selectedProspectsForBulk.length; i++) {
      const prospectId = selectedProspectsForBulk[i]
      const prospect = coldProspects.find(p => p.id === prospectId)
      
      if (!prospect) continue
      
      try {
        const res = await fetch('/api/coldleads/analyze-deep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            website: prospect.website,
            firmenname: prospect.company_name,
            branche: prospect.industry,
            prospectId: prospect.id
          })
        })
        const data = await res.json()
        if (data.ok) {
          successCount++
          console.log(`✓ ${prospect.company_name}: Score ${data.analysis.confidence_overall}%`)
        } else {
          errorCount++
          console.error(`✗ ${prospect.company_name}:`, data.error)
        }
      } catch (err) {
        console.error(`✗ ${prospect.company_name}:`, err)
        errorCount++
      }
      
      setBulkAnalyzeProgress({ current: i + 1, total: selectedProspectsForBulk.length })
      
      // Kleine Pause zwischen Anfragen
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // WICHTIG: Stats UND Prospects-Liste neu laden
    console.log('Lade Stats und Prospects neu...')
    await loadColdLeadStats()
    
    // Wechsle zum "Analysiert" Tab ZUERST
    setColdStatusFilter('analyzed')
    
    // Prospects mit explizitem 'analyzed' Filter laden
    await loadColdProspects('analyzed')
    
    // Reset
    setBulkAnalyzing(false)
    setSelectedProspectsForBulk([])
    setBulkAnalyzeProgress({ current: 0, total: 0 })
    
    alert(`✅ Bulk-Analyse abgeschlossen!\n\n✓ Erfolgreich: ${successCount}\n✗ Fehler: ${errorCount}\n\n➡️ Wechsle zu "Analysiert" Tab`)
  }

  // Alle neuen Prospects analysieren
  const bulkAnalyzeAllNew = async () => {
    const newProspects = coldProspects.filter(p => p.status === 'new')
    if (newProspects.length === 0) {
      alert('Keine neuen Firmen zum Analysieren vorhanden.')
      return
    }
    
    if (!confirm(`Möchten Sie wirklich ALLE ${newProspects.length} neuen Firmen analysieren?\n\n⚠️ Dies kann ${Math.ceil(newProspects.length * 0.5)} Minuten dauern.\n\nFortschritt wird angezeigt.`)) {
      return
    }
    
    // Setze ausgewählte Prospects
    setSelectedProspectsForBulk(newProspects.map(p => p.id))
    
    // Kurze Verzögerung damit UI sich aktualisiert, dann starte
    setTimeout(async () => {
      await bulkAnalyzeProspects()
    }, 100)
  }

  const generateColdEmail = async (prospect) => {
    setColdLoading(true)
    try {
      const res = await fetch('/api/coldleads/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: prospect.website, send: false })
      })
      const data = await res.json()
      if (data.ok) {
        setGeneratedEmail({ ...data.email, recipient: data.recipient, website: prospect.website })
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setColdLoading(false)
  }

  // Artikel-Import Funktionen
  const loadArtikelStatus = async () => {
    try {
      const res = await fetch('/api/jtl/articles/import/status')
      const data = await res.json()
      if (data.ok) {
        const imported = data.imported || 0
        const total = data.target || 166854
        setArtikelImportProgress({ imported, total })
        setArtikelImportRunning(data.running || false)
        
        console.log('[Import Status]', { imported, total, running: data.running })
      }
    } catch (e) {
      console.error('Error loading artikel status:', e)
    }
  }

  const loadAmazonPrompts = async () => {
    try {
      setLoadingPrompts(true)
      const res = await fetch('/api/amazon/prompts')
      const data = await res.json()
      if (data.ok) {
        setAmazonPrompts(data.prompts || [])
        console.log('[Amazon Prompts]', `Loaded ${data.prompts?.length || 0} prompts`)
      } else {
        console.error('Error loading Amazon prompts:', data.error)
      }
    } catch (e) {
      console.error('Error loading Amazon prompts:', e)
    } finally {
      setLoadingPrompts(false)
    }
  }

  const activatePrompt = async (version) => {
    try {
      const res = await fetch('/api/amazon/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', version })
      })
      const data = await res.json()
      if (data.ok) {
        alert(`✅ Prompt ${version} ist jetzt aktiv`)
        await loadAmazonPrompts()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    }
  }

  const savePrompt = async () => {
    if (!newPromptData.name || !newPromptData.prompt) {
      alert('❌ Bitte Name und Prompt ausfüllen')
      return
    }

    try {
      const action = promptModalMode === 'edit' ? 'update' : 'create'
      const payload = {
        action,
        name: newPromptData.name,
        beschreibung: newPromptData.beschreibung,
        prompt: newPromptData.prompt
      }

      if (promptModalMode === 'edit') {
        payload.version = editingPrompt.version
      }

      const res = await fetch('/api/amazon/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.ok) {
        alert(`✅ Prompt ${promptModalMode === 'edit' ? 'aktualisiert' : 'erstellt'}!`)
        setShowPromptModal(false)
        setNewPromptData({ name: '', beschreibung: '', prompt: '' })
        setEditingPrompt(null)
        await loadAmazonPrompts()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    }
  }

  const deletePrompt = async (version) => {
    if (!confirm(`Prompt ${version} wirklich löschen?`)) return

    try {
      const res = await fetch('/api/amazon/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', version })
      })

      const data = await res.json()
      if (data.ok) {
        alert('✅ Prompt gelöscht')
        await loadAmazonPrompts()
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    }
  }

  const openPromptModal = (mode, prompt = null) => {
    setPromptModalMode(mode)
    if (mode === 'edit' && prompt) {
      setEditingPrompt(prompt)
      setNewPromptData({
        name: prompt.name,
        beschreibung: prompt.beschreibung,
        prompt: prompt.prompt
      })
    } else {
      setNewPromptData({ name: '', beschreibung: '', prompt: '' })
    }
    setShowPromptModal(true)
  }

  const generateBulletpointsForArtikel = async (artikel) => {
    try {
      setGeneratingBulletpoints(true)
      
      // Hole aktiven Prompt
      const activePrompt = amazonPrompts.find(p => p.isActive)
      if (!activePrompt) {
        alert('❌ Kein aktiver Prompt gefunden. Bitte aktivieren Sie einen Prompt.')
        return
      }

      // Bereite Produktinfo vor
      const merkmaleText = artikel.merkmale?.map(m => `${m.name}: ${m.wert}`).join(' | ') || ''

      const res = await fetch('/api/amazon/bulletpoints/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artikelnummer: artikel.cArtNr,
          artikelname: artikel.cName,
          beschreibung: artikel.cBeschreibung || '',
          kurzbeschreibung: artikel.cKurzBeschreibung || '',
          merkmale: merkmaleText,
          userPrompt: activePrompt.prompt
        })
      })

      const data = await res.json()
      if (data.ok) {
        // Speichere in DB
        await fetch(`/api/amazon/bulletpoints/artikel/${artikel.kArtikel}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bulletpoints: data.bulletpoints,
            promptVersion: activePrompt.version
          })
        })

        setArtikelBulletpoints(data.bulletpoints)
        alert('✅ Bulletpoints erfolgreich generiert!')
      } else {
        alert('❌ Fehler: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    } finally {
      setGeneratingBulletpoints(false)
    }
  }

  const loadBulletpointsForArtikel = async (kArtikel) => {
    try {
      const res = await fetch(`/api/amazon/bulletpoints/artikel/${kArtikel}`)
      const data = await res.json()
      if (data.ok && data.bulletpoints) {
        setArtikelBulletpoints(data.bulletpoints)
      } else {
        setArtikelBulletpoints(null)
      }
    } catch (e) {
      console.error('Error loading bulletpoints:', e)
      setArtikelBulletpoints(null)
    }
  }

  // Status-Polling: Prüfe alle 3 Sekunden ob Import läuft
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'produkte') {
        loadArtikelStatus()
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [activeTab])

  const checkOrphanedArticles = async () => {
    if (checkingOrphans) return
    
    if (!confirm('Verwaiste Artikel prüfen?\n\nDies vergleicht alle Artikel in der Datenbank mit JTL-Wawi und findet Artikel, die nicht mehr vorhanden sind.\n\nDauer: ca. 1-2 Minuten.\n\nFortfahren?')) {
      return
    }

    setCheckingOrphans(true)
    try {
      const res = await fetch('/api/jtl/articles/import/orphaned')
      const data = await res.json()
      if (data.ok) {
        setOrphanedArticles(data.orphanedArticles || [])
        if (data.orphanedCount === 0) {
          alert('✅ Keine verwaisten Artikel gefunden!\n\nAlle Artikel in der Datenbank sind aktuell.')
        } else {
          alert(`⚠️ ${data.orphanedCount} verwaiste Artikel gefunden!\n\nDiese Artikel sind in der Datenbank vorhanden, aber nicht mehr in JTL-Wawi aktiv.\n\nSehen Sie sich die Liste an und entscheiden Sie, ob sie gelöscht werden sollen.`)
        }
      } else {
        alert('Fehler beim Prüfen: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setCheckingOrphans(false)
  }

  const deleteOrphanedArticles = async () => {
    if (orphanedArticles.length === 0) return
    
    if (!confirm(`⚠️ WARNUNG: Artikel löschen\n\n${orphanedArticles.length} verwaiste Artikel werden PERMANENT gelöscht.\n\nDies kann nicht rückgängig gemacht werden!\n\nFortfahren?`)) {
      return
    }

    try {
      const res = await fetch('/api/jtl/articles/import/orphaned', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kArtikelIds: orphanedArticles.map(a => a.kArtikel)
        })
      })
      const data = await res.json()
      if (data.ok) {
        alert(`✅ ${data.deletedCount} Artikel erfolgreich gelöscht!`)
        setOrphanedArticles([])
        await loadArtikelStatus()
      } else {
        alert('Fehler beim Löschen: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
  }

  // Preisvergleich starten
  const startePreisvergleich = async (artikel) => {
    setPreisvergleichArtikel(artikel)
    setPreisvergleichLoading(true)
    setPreisvergleichErgebnisse([])

    try {
      const res = await fetch('/api/preisvergleich/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ean: artikel.cBarcode,
          mpn: artikel.cHAN,
          productName: artikel.cName,
          unserVK: artikel.fVKNetto,
          unsereVE: 1 // TODO: VE aus Artikel extrahieren
        })
      })
      const data = await res.json()
      if (data.ok) {
        setPreisvergleichErgebnisse(data.wettbewerber || [])
      } else {
        alert('Fehler beim Preisvergleich: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setPreisvergleichLoading(false)
  }

  // Artikel-Präsenz laden
  const loadArtikelPresence = async (kArtikel) => {
    if (expandedArtikel === kArtikel) {
      setExpandedArtikel(null)
      setArtikelPresence(null)
      return
    }

    setExpandedArtikel(kArtikel)
    setLoadingPresence(true)
    setArtikelPresence(null)

    try {
      const res = await fetch(`/api/jtl/articles/presence/${kArtikel}`)
      const data = await res.json()
      if (data.ok) {
        setArtikelPresence(data)
      }
    } catch (e) {
      console.error('Fehler beim Laden der Präsenz:', e)
    }
    setLoadingPresence(false)
  }

  const startArtikelImport = async () => {
    if (artikelImportRunning) return
    
    if (!confirm('Artikel-Import starten?\n\nDies importiert alle 166.854 Artikel aus JTL-Wawi in die Score Zentrale.\nDauer: ca. 5-10 Minuten.\n\nFortfahren?')) {
      return
    }

    setArtikelImportRunning(true)
    setArtikelImportProgress({ imported: 0, total: 166854 })

    let offset = 0
    const batchSize = 1000
    let totalImported = 0

    try {
      // Erster Batch mit fullImport=true
      const firstRes = await fetch('/api/jtl/articles/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize, offset: 0, fullImport: true })
      })
      const firstData = await firstRes.json()
      
      if (!firstData.ok) {
        alert('❌ Fehler beim ersten Batch: ' + firstData.error)
        setArtikelImportRunning(false)
        return
      }

      totalImported += firstData.imported
      setArtikelImportProgress({ imported: totalImported, total: 166854 })
      offset = firstData.nextOffset

      // Loop durch alle weiteren Batches
      while (offset && offset < 166854) {
        const res = await fetch('/api/jtl/articles/import/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize, offset, fullImport: false })
        })
        const data = await res.json()

        if (!data.ok) {
          console.error('Import error at offset', offset, ':', data.error)
          break
        }

        totalImported += data.imported
        setArtikelImportProgress({ imported: totalImported, total: 166854 })

        if (data.finished || !data.nextOffset) {
          break
        }

        offset = data.nextOffset

        // Kleine Pause zwischen Batches
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      alert(`✅ Import abgeschlossen!\n\n${totalImported} Artikel wurden importiert.`)
      loadArtikelStatus()
      
    } catch (e) {
      alert('❌ Fehler beim Import: ' + e.message)
    } finally {
      setArtikelImportRunning(false)
    }
  }

  // Lädt verfügbare Filter-Optionen
  const loadArtikelFilters = async () => {
    try {
      const res = await fetch('/api/jtl/articles/filters')
      const data = await res.json()
      if (data.ok) {
        setAvailableHerstellerArtikel(data.hersteller || [])
        setAvailableWarengruppenArtikel(data.warengruppen || [])
      }
    } catch (e) {
      console.error('Error loading artikel filters:', e)
    }
  }

  // Lädt Artikel-Liste mit Filter & Pagination
  const loadArtikelList = async () => {
    setArtikelLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(artikelPage),
        limit: String(artikelPerPage),
        sortBy: artikelSortBy,
        sortOrder: artikelSortOrder
      })

      if (artikelFilter.search) params.append('search', artikelFilter.search)
      if (artikelFilter.hersteller) params.append('hersteller', artikelFilter.hersteller)
      if (artikelFilter.warengruppe) params.append('warengruppe', artikelFilter.warengruppe)

      const res = await fetch('/api/jtl/articles/list?' + params.toString())
      const data = await res.json()
      
      if (data.ok) {
        setArtikelList(data.articles || [])
        setArtikelTotal(data.pagination?.total || 0)
        setArtikelTotalPages(data.pagination?.totalPages || 0)
      } else {
        console.error('Error loading articles:', data.error)
        setArtikelList([])
      }
    } catch (e) {
      console.error('Error loading artikel:', e)
      setArtikelList([])
    } finally {
      setArtikelLoading(false)
    }
  }

  const sendColdEmail = async () => {
    if (!confirm('Email jetzt wirklich versenden?')) return
    setColdLoading(true)
    try {
      const res = await fetch('/api/coldleads/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: generatedEmail.website, send: true })
      })
      const data = await res.json()
      if (data.ok && data.sent) {
        alert('✅ Email erfolgreich versendet!')
        setGeneratedEmail(null)
        // Prospects neu laden um Status zu aktualisieren
        await fetchColdProspects()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setColdLoading(false)
  }

  const ScoreBadge = ({v}) => (<span className="badge badge-warning" style={{fontSize:'0.95rem'}}>{Math.round(Number(v||0))}</span>)
  const StatusBadge = ({s}) => {
    const map = { open:'secondary', called:'info', qualified:'success', discarded:'dark' }
    const cls = map[s]||'secondary'; return <span className={`badge badge-${cls}`}>{s||'open'}</span>
  }
  const B2BBadge = ({b}) => (<span className={`badge badge-${b?'warning':'secondary'}`}>{b?'B2B':'B2C'}</span>)

  // Hash-basierte Navigation synchronisieren
  useEffect(() => {
    const syncHash = () => {
      const hash = (window.location.hash || '#dashboard').slice(1)
      if (hash !== activeTab) {
        setActiveTab(hash)
      }
    }
    
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  return (
    <div>
      {/* Date Range - nur bei Dashboard, Sales, Marketing */}
      {(activeTab === 'dashboard' || activeTab === 'sales' || activeTab === 'marketing') && (
        <>
          <div className="mb-3 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="mr-2 text-muted" style={{fontSize:'0.9rem'}}>Zeitraum:</div>
              <input type="date" className="form-control form-control-sm mr-2" style={{maxWidth:150}} value={from} onChange={e=>setFrom(e.target.value)} />
              <input type="date" className="form-control form-control-sm mr-2" style={{maxWidth:150}} value={to} onChange={e=>setTo(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={()=>{fetchAll(); fetchSalesTables()}}><i className="bi bi-arrow-repeat mr-1"/>Aktualisieren</button>
            </div>
            {loading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="sr-only">Loading...</span></div>}
          </div>
          {autoAdjusted && (<div className="alert alert-info py-2 px-3 small mb-3"><i className="bi bi-info-circle mr-2"/>{autoAdjusted}</div>)}
        </>
      )}

      {activeTab==='dashboard' && (
        <div>
          {/* Oberste Reihe: Aufträge (mit Versand) */}
          <div className="row">
            <KpiTile title="Bestellungen (Aufträge)" value={(ordersSplit?.orders??'-').toLocaleString?.('de-DE')||ordersSplit?.orders||'-'} sub="nach 'Erstellt am'" demo={demoMode} />
            <KpiTile title="Umsatz (NETTO)" value={fmtCurrency(ordersSplit?.net_with_shipping)} sub="Aufträge mit Versand" demo={demoMode} />
            <KpiTile title="Umsatz (BRUTTO)" value={fmtCurrency(ordersSplit?.gross_with_shipping)} sub="Aufträge mit Versand" demo={demoMode} />
          </div>

          {/* Zweite Reihe: Rohertragsmarge + Top 5 */}
          <div className="row">
            <KpiTile 
              title="Rohertragsmarge (Netto)" 
              value={fmtCurrency((parseFloat(margin?.margin_net_with_ship || 0) - parseFloat(margin?.shipping_revenue || 0)).toFixed(2))} 
              sub={
                <span>
                  Umsatz: {fmtCurrency(margin?.revenue_net_with_ship)} | Ø EK: {fmtCurrency(margin?.cost_net)} | Versand: {fmtCurrency(margin?.shipping_revenue)} (abgezogen)
                  {margin?.cost_source && (
                    <span 
                      className="ml-2" 
                      style={{cursor:'help'}} 
                      title={`Cost Sources:\nPosition: ${margin?.cost_source?.from?.position_pct}%\nHistorie: ${margin?.cost_source?.from?.history_pct}%\nArtikel-EK: ${margin?.cost_source?.from?.article_current_pct}%`}
                    >
                      ⓘ
                    </span>
                  )}
                </span>
              } 
              demo={demoMode} 
            />
            <div className="col-md-4 mb-3">
              <div className="card kpi h-100" style={{cursor: 'pointer'}} onClick={() => { setActiveTab('sales'); setSalesTab('platforms'); }}>
                <div className="card-body">
                  <div className="label mb-2 text-uppercase small">
                    <i className="bi bi-shop mr-1"/>TOP 5 Plattformen
                  </div>
                  {topPlatforms && topPlatforms.length > 0 ? (
                    <div className="small">
                      {topPlatforms.slice(0, 5).map((p, i) => {
                        const platformNames = {
                          '1': 'Direktvertrieb',
                          '2': 'Onlineshop',
                          '8': 'Otto',
                          '31': 'ebay.de',
                          '32': 'ebay.com',
                          '34': 'ebay.co.uk',
                          '36': 'ebay.at',
                          '38': 'ebay.fr',
                          '39': 'ebay.it',
                          '42': 'ebay.es',
                          '43': 'ebay.ch',
                          '44': 'ebay.ie',
                          '51': 'Amazon.de',
                          '54': 'Amazon.fr',
                          '56': 'Amazon.it',
                          '57': 'Amazon.es',
                          '60': 'Amazon.nl',
                          '65': 'Amazon.com.be'
                        }
                        const name = platformNames[p.platform] || `Plattform #${p.platform}`
                        return (
                          <div key={i} className="d-flex justify-content-between mb-1 pb-1" style={{borderBottom: i < 4 ? '1px solid var(--line)' : 'none'}}>
                            <span className="text-truncate" style={{maxWidth: '100px'}}>{name}</span>
                            <span className="text-nowrap">
                              <strong>{fmtCurrency(p.revenue)}</strong>
                              <span className="text-success ml-2">+{fmtCurrency(p.margin)}</span>
                              <span className="text-muted ml-1">({p.marginPct}%)</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-muted small">Keine Daten</div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card kpi h-100" style={{cursor: 'pointer'}} onClick={() => { setActiveTab('sales'); setSalesTab('manufacturers'); }}>
                <div className="card-body">
                  <div className="label mb-2 text-uppercase small">
                    <i className="bi bi-building mr-1"/>TOP 5 Hersteller
                  </div>
                  {topManufacturers && topManufacturers.length > 0 ? (
                    <div className="small">
                      {topManufacturers.slice(0, 5).map((m, i) => (
                        <div key={i} className="d-flex justify-content-between mb-1 pb-1" style={{borderBottom: i < 4 ? '1px solid var(--line)' : 'none'}}>
                          <span className="text-truncate" style={{maxWidth: '100px'}}>{m.manufacturer}</span>
                          <span className="text-nowrap">
                            <strong>{fmtCurrency(m.revenue)}</strong>
                            <span className="text-success ml-2">+{fmtCurrency(m.margin)}</span>
                            <span className="text-muted ml-1">({m.marginPct}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small">Keine Daten</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dritte Reihe: Kaltakquise Stats */}
          <div className="row mt-3">
            <div className="col-md-4 mb-3">
              <a href="#kaltakquise" style={{textDecoration: 'none', color: 'inherit'}} onClick={()=>setActiveTab('kaltakquise')}>
                <div className="card kpi h-100 border-warning" style={{cursor: 'pointer'}}>
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="label mb-1 text-uppercase small">
                        <i className="bi bi-envelope-exclamation mr-1"/>Ungelesene Antworten
                      </div>
                      {coldLeadStats.unreadReplies > 0 && <span className="badge badge-warning pulse">{coldLeadStats.unreadReplies}</span>}
                    </div>
                    <div className="value mb-0 text-warning">{coldLeadStats.unreadReplies || 0}</div>
                    <div className="text-muted small mt-1">
                      {coldLeadStats.recentReplies || 0} Antworten (7 Tage)
                    </div>
                  </div>
                </div>
              </a>
            </div>
            <div className="col-md-4 mb-3">
              <a href="#kaltakquise" style={{textDecoration: 'none', color: 'inherit'}} onClick={()=>setActiveTab('kaltakquise')}>
                <div className="card kpi h-100" style={{cursor: 'pointer'}}>
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="label mb-1 text-uppercase small">
                        <i className="bi bi-clock-history mr-1"/>Follow-up benötigt
                      </div>
                    </div>
                    <div className="value mb-0">{coldLeadStats.awaitingFollowup || 0}</div>
                    <div className="text-muted small mt-1">Nach 6 Werktagen</div>
                  </div>
                </div>
              </a>
            </div>
          </div>

          {/* Neues Chart: Umsatz, Bestellungen & Marge über Zeitintervall */}
          <div className="row mt-3">
            <div className="col-12 mb-3">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-graph-up text-primary mr-2"/>
                    <span className="font-weight-bold">Umsatz (Netto), Bestellungen & Marge</span>
                  </div>
                  {demoMode && <span className="badge badge-warning"><i className="bi bi-exclamation-triangle mr-1"/>Demo-Modus</span>}
                </div>
                <div className="card-body" style={{height: '350px'}}>
                  {ts.length===0 ? (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-inbox" style={{fontSize:'3rem', opacity:0.3}}/>
                      <p className="mt-2 mb-0">Keine Zeitreihen-Daten im gewählten Zeitraum</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="date" stroke="#999" />
                        <YAxis yAxisId="left" stroke="#0d6efd" />
                        <YAxis yAxisId="right" orientation="right" stroke="#28a745" />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}}
                          formatter={(value, name) => {
                            if (name === 'Umsatz Netto' || name === 'Marge') return `${parseFloat(value).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`
                            return value
                          }}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0d6efd" strokeWidth={2} name="Umsatz Netto" dot={{fill: '#0d6efd'}} />
                        <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#28a745" strokeWidth={2} name="Bestellungen" dot={{fill: '#28a745'}} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-1">
            <div className="col-md-8 mb-3">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-graph-up text-primary mr-2"/>
                    <span className="font-weight-bold">Umsatz & Marge (mit Gebühren)</span>
                  </div>
                  {demoMode && <span className="badge badge-warning"><i className="bi bi-exclamation-triangle mr-1"/>Demo-Modus</span>}
                </div>
                <div className="card-body">
                  {ts.length===0 && tsFees.length===0 ? (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-inbox" style={{fontSize:'3rem', opacity:0.3}}/>
                      <p className="mt-2 mb-0">Keine Zeitreihen-Daten im gewählten Zeitraum</p>
                    </div>
                  ) : (
                    <canvas ref={revChartRef} height="120" />
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-bar-chart text-success mr-2"/>
                    <span className="font-weight-bold">Plattform-Umsatz</span>
                  </div>
                  <div className="custom-control custom-switch">
                    <input type="checkbox" className="custom-control-input" id="stackedSwitch" checked={stacked} onChange={e=>setStacked(e.target.checked)} />
                    <label className="custom-control-label" htmlFor="stackedSwitch"><small>Stack</small></label>
                  </div>
                </div>
                <div className="card-body">
                  {platTs.length===0 ? (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-inbox" style={{fontSize:'3rem', opacity:0.3}}/>
                      <p className="mt-2 mb-0 small">Keine Plattform-Daten</p>
                    </div>
                  ) : (
                    <canvas ref={platChartRef} height="120" />
                  )}
                </div>
              </div>
            </div>
          </div>
          {error && <div className="alert alert-danger border-0 shadow-sm d-flex align-items-center"><i className="bi bi-exclamation-triangle-fill mr-2"/><strong>Fehler:</strong>&nbsp;{String(error)}</div>}
        </div>
      )}

      {activeTab==='outbound' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h2 className="mb-1"><i className="bi bi-list-ul mr-2"/>Prospect Management</h2>
              <p className="text-muted small mb-0">Lead-Verwaltung und Qualifizierung</p>
            </div>
          </div>
          
          <div className="row">
            <div className="col-lg-5 mb-4">
              <div className="card h-100">
                <div className="card-header bg-transparent border-0">Prospect Filter</div>
                <div className="card-body">
                  <form onSubmit={submitProspect}>
                    <div className="form-group">
                      <label>Firma</label>
                      <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="form-control form-control-sm"/>
                    </div>
                    <div className="form-group">
                      <label>Website</label>
                      <input value={form.website} onChange={e=>setForm({...form, website:e.target.value})} className="form-control form-control-sm" placeholder="https://..."/>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-6">
                        <label>Region</label>
                        <input value={form.region} onChange={e=>setForm({...form, region:e.target.value})} className="form-control form-control-sm"/>
                      </div>
                      <div className="form-group col-md-6">
                        <label>Branche</label>
                        <input value={form.industry} onChange={e=>setForm({...form, industry:e.target.value})} className="form-control form-control-sm"/>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-6">
                        <label>Größe</label>
                        <select value={form.size} onChange={e=>setForm({...form, size:e.target.value})} className="form-control form-control-sm">
                          <option value="">-</option>
                          <option>1-10</option>
                          <option>11-50</option>
                          <option>51-200</option>
                          <option>200+</option>
                        </select>
                      </div>
                      <div className="form-group col-md-6">
                        <label>Keywords</label>
                        <input value={form.keywords} onChange={e=>setForm({...form, keywords:e.target.value})} className="form-control form-control-sm" placeholder="Metall, Apparatebau"/>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Zur Liste hinzufügen</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-7 mb-4">
              <div className="card h-100">
                <div className="card-header bg-transparent d-flex align-items-center justify-content-between">
                  <span>Prospects</span>
                  <div>
                    <button className="btn btn-outline-primary btn-sm mr-2" onClick={()=>exportCSV((prospects||[]).map(p=>({name:p.name,website:p.website,region:p.region,industry:p.industry,size:p.size,score:p.score})), 'prospects.csv')}><i className="bi bi-download mr-1"/>CSV</button>
                    <button className="btn btn-outline-primary btn-sm" onClick={refreshProspects}><i className="bi bi-arrow-repeat mr-1"/>Aktualisieren</button>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive" style={{maxHeight:360}}>
                    <table className="table table-dark table-hover table-sm mb-0">
                      <thead className="thead-dark"><tr><th>Name</th><th>Website</th><th>Region</th><th>Branche</th><th>Score</th><th></th></tr></thead>
                      <tbody>
                        {(prospects||[]).map(p => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td><a className="text-info" href={p.website} target="_blank" rel="noreferrer">{p.website}</a></td>
                            <td>{p.region}</td>
                            <td>{p.industry}</td>
                            <td>{p.score}</td>
                            <td>
                              <button className="btn btn-outline-primary btn-sm" onClick={()=>analyzeCompany(p)}><i className="bi bi-search"/> Analysieren</button>
                            </td>
                          </tr>
                        ))}
                        {prospects?.length===0 && <tr><td colSpan={6} className="text-center text-muted">Noch keine Prospects</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mail Composer */}
          <div className="card">
            <div className="card-header bg-transparent border-0">Mail Composer</div>
            <div className="card-body">
              <form onSubmit={generateMail}>
                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Firma</label>
                    <input className="form-control form-control-sm" value={compose.company} onChange={e=>setCompose({...compose, company:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-4">
                    <label>Rolle</label>
                    <input className="form-control form-control-sm" value={compose.contactRole} onChange={e=>setCompose({...compose, contactRole:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-4">
                    <label>Branche</label>
                    <input className="form-control form-control-sm" value={compose.industry} onChange={e=>setCompose({...compose, industry:e.target.value})}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Use-Cases (kommagetrennt)</label>
                    <input className="form-control form-control-sm" value={compose.useCases} onChange={e=>setCompose({...compose, useCases:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-6">
                    <label>Hypothesen (frei)</label>
                    <input className="form-control form-control-sm" value={compose.hypotheses} onChange={e=>setCompose({...compose, hypotheses:e.target.value})} placeholder="z.B. Bänder 50×2000 K80; Fiberscheiben Ø125 K60"/>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" type="submit">E-Mail generieren</button>
              </form>

              {mail && (
                <div className="mt-3">
                  <div className="mb-2"><strong>Betreff:</strong> {mail.subject}</div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="small text-muted mb-1">Text</div>
                      <pre className="p-2 rounded" style={{minHeight:120, background:'#141a20', color:'#e7ecf2'}}>{mail.text}</pre>
                    </div>
                    <div className="col-md-6">
                      <div className="small text-muted mb-1">HTML Vorschau</div>
                      <div className="bg-light text-dark p-2 rounded" dangerouslySetInnerHTML={{__html: mail.html}} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab==='sales' && (
        <div>
          {/* Filter Section */}
          <div className="card mb-3">
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <label className="small text-muted mb-1">Warengruppe</label>
                  <select 
                    className="form-control form-control-sm" 
                    multiple 
                    size="3"
                    value={selectedWarengruppen}
                    onChange={(e) => setSelectedWarengruppen(Array.from(e.target.selectedOptions, option => option.value))}>
                    {availableWarengruppen.map(wg => (
                      <option key={wg} value={wg}>{wg}</option>
                    ))}
                    {availableWarengruppen.length === 0 && <option disabled>Lade...</option>}
                  </select>
                  <div className="small text-muted mt-1">{selectedWarengruppen.length} ausgewählt</div>
                </div>
                
                <div className="col-md-4">
                  <label className="small text-muted mb-1">Hersteller</label>
                  <select 
                    className="form-control form-control-sm" 
                    multiple 
                    size="3"
                    value={selectedHersteller}
                    onChange={(e) => setSelectedHersteller(Array.from(e.target.selectedOptions, option => option.value))}>
                    {availableHersteller.map(herst => (
                      <option key={herst} value={herst}>{herst}</option>
                    ))}
                    {availableHersteller.length === 0 && <option disabled>Lade...</option>}
                  </select>
                  <div className="small text-muted mt-1">{selectedHersteller.length} ausgewählt</div>
                </div>
                
                <div className="col-md-4">
                  <label className="small text-muted mb-1">Lieferant</label>
                  <select 
                    className="form-control form-control-sm" 
                    multiple 
                    size="3"
                    value={selectedLieferanten}
                    onChange={(e) => setSelectedLieferanten(Array.from(e.target.selectedOptions, option => option.value))}>
                    {availableLieferanten.map(lief => (
                      <option key={lief} value={lief}>{lief}</option>
                    ))}
                    {availableLieferanten.length === 0 && <option disabled>Lade...</option>}
                  </select>
                  <div className="small text-muted mt-1">{selectedLieferanten.length} ausgewählt</div>
                </div>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-3">
                <button 
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setSelectedWarengruppen([])
                    setSelectedHersteller([])
                    setSelectedLieferanten([])
                  }}>
                  <i className="bi bi-x-circle mr-1"/>Filter zurücksetzen
                </button>
                
                <div className="d-flex align-items-center">
                  <div className="mr-2 small text-muted">Limit:</div>
                  <select className="form-control form-control-sm" style={{maxWidth:120}} value={limit} onChange={e=>setLimit(parseInt(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item"><a className={`nav-link ${salesTab==='products'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('products')}}>Top-Produkte</a></li>
            <li className="nav-item"><a className={`nav-link ${salesTab==='categories'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('categories')}}>Top-Warengruppen</a></li>
            <li className="nav-item"><a className={`nav-link ${salesTab==='platforms'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('platforms')}}>Top-Plattformen</a></li>
            <li className="nav-item"><a className={`nav-link ${salesTab==='manufacturers'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('manufacturers')}}>Top-Hersteller</a></li>
          </ul>

          {salesTab==='products' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Top-Produkte</span>
                <button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV(topProducts, 'top-products.csv')}>CSV</button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{maxHeight:420}}>
                  <table className="table table-dark table-hover table-sm mb-0">
                    <thead className="thead-dark"><tr><th>ArtikelNr</th><th>Name</th><th>Menge</th><th>Umsatz (Netto)</th></tr></thead>
                    <tbody>
                      {(topProducts||[]).map((r,idx)=> (
                        <tr key={idx}><td>{r.sku||r.artikelNr}</td><td>{r.name}</td><td>{r.quantity||'-'}</td><td>{fmtCurrency(r.revenue||r.umsatz)}</td></tr>
                      ))}
                      {topProducts?.length===0 && <tr><td colSpan={4} className="text-center text-muted">Keine Daten</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {salesTab==='categories' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Top-Warengruppen</span>
                <button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV(topCategories, 'top-warengruppen.csv')}>CSV</button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{maxHeight:420}}>
                  <table className="table table-dark table-hover table-sm mb-0">
                    <thead className="thead-dark"><tr><th>Kategorie</th><th>Artikel</th><th>Umsatz (Netto)</th></tr></thead>
                    <tbody>
                      {(topCategories||[]).map((r,idx)=> (
                        <tr key={idx}><td>{r.category||r.kategorie}</td><td>{r.items||'-'}</td><td>{fmtCurrency(r.revenue||r.umsatz)}</td></tr>
                      ))}
                      {topCategories?.length===0 && <tr><td colSpan={3} className="text-center text-muted">Keine Daten</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {salesTab==='platforms' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Top-Plattformen nach Umsatz & Marge</span>
                <button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV(topPlatforms, 'top-plattformen.csv')}>CSV</button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{maxHeight:420}}>
                  <table className="table table-dark table-hover table-sm mb-0">
                    <thead className="thead-dark">
                      <tr>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'platform', direction: sortBy.field==='platform' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Plattform {sortBy.field==='platform' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'orders', direction: sortBy.field==='orders' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Bestellungen {sortBy.field==='orders' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'revenue', direction: sortBy.field==='revenue' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Umsatz (Netto) {sortBy.field==='revenue' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'cost', direction: sortBy.field==='cost' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Kosten {sortBy.field==='cost' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'margin', direction: sortBy.field==='margin' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Marge (Netto) {sortBy.field==='margin' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'marginPct', direction: sortBy.field==='marginPct' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Marge % {sortBy.field==='marginPct' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(topPlatforms||[])].sort((a,b)=>{
                        const aVal = sortBy.field==='platform' ? a[sortBy.field] : parseFloat(a[sortBy.field])
                        const bVal = sortBy.field==='platform' ? b[sortBy.field] : parseFloat(b[sortBy.field])
                        return sortBy.direction==='asc' ? (aVal>bVal?1:-1) : (aVal<bVal?1:-1)
                      }).map((p,idx)=> {
                        const platformNames = {
                          '1': 'Direktvertrieb',
                          '2': 'Onlineshop',
                          '8': 'Otto',
                          '31': 'ebay.de',
                          '32': 'ebay.com',
                          '34': 'ebay.co.uk',
                          '36': 'ebay.at',
                          '38': 'ebay.fr',
                          '39': 'ebay.it',
                          '42': 'ebay.es',
                          '43': 'ebay.ch',
                          '44': 'ebay.ie',
                          '51': 'Amazon.de',
                          '54': 'Amazon.fr',
                          '56': 'Amazon.it',
                          '57': 'Amazon.es',
                          '60': 'Amazon.nl',
                          '65': 'Amazon.com.be'
                        }
                        const name = platformNames[p.platform] || `Plattform #${p.platform}`
                        return (
                          <tr key={idx}>
                            <td>{name}</td>
                            <td>{p.orders}</td>
                            <td>{fmtCurrency(p.revenue)}</td>
                            <td>{fmtCurrency(p.cost)}</td>
                            <td className="text-success">{fmtCurrency(p.margin)}</td>
                            <td>{p.marginPct}%</td>
                          </tr>
                        )
                      })}
                      {topPlatforms?.length===0 && <tr><td colSpan={6} className="text-center text-muted">Keine Daten</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {salesTab==='manufacturers' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Top-Hersteller nach Umsatz & Marge</span>
                <button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV(topManufacturers, 'top-hersteller.csv')}>CSV</button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{maxHeight:420}}>
                  <table className="table table-dark table-hover table-sm mb-0">
                    <thead className="thead-dark">
                      <tr>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'manufacturer', direction: sortBy.field==='manufacturer' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Hersteller {sortBy.field==='manufacturer' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'orders', direction: sortBy.field==='orders' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Bestellungen {sortBy.field==='orders' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'revenue', direction: sortBy.field==='revenue' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Umsatz (Netto) {sortBy.field==='revenue' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'cost', direction: sortBy.field==='cost' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Kosten {sortBy.field==='cost' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'margin', direction: sortBy.field==='margin' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Marge (Netto) {sortBy.field==='margin' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                        <th style={{cursor:'pointer'}} onClick={()=>setSortBy({field:'marginPct', direction: sortBy.field==='marginPct' && sortBy.direction==='asc'?'desc':'asc'})}>
                          Marge % {sortBy.field==='marginPct' && (sortBy.direction==='asc'?'↑':'↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(topManufacturers||[])].sort((a,b)=>{
                        const aVal = sortBy.field==='manufacturer' ? a[sortBy.field] : parseFloat(a[sortBy.field])
                        const bVal = sortBy.field==='manufacturer' ? b[sortBy.field] : parseFloat(b[sortBy.field])
                        return sortBy.direction==='asc' ? (aVal>bVal?1:-1) : (aVal<bVal?1:-1)
                      }).map((m,idx)=> (
                        <tr key={idx}>
                          <td>{m.manufacturer}</td>
                          <td>{m.orders}</td>
                          <td>{fmtCurrency(m.revenue)}</td>
                          <td>{fmtCurrency(m.cost)}</td>
                          <td className="text-success">{fmtCurrency(m.margin)}</td>
                          <td>{m.marginPct}%</td>
                        </tr>
                      ))}
                      {topManufacturers?.length===0 && <tr><td colSpan={6} className="text-center text-muted">Keine Daten</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab==='marketing' && (
        <div>
          <div className="mb-4">
            <h2 className="mb-3"><i className="bi bi-bullseye mr-2"/>Marketing & Analytics</h2>
            
            {/* Sub-Navigation */}
            <ul className="nav nav-tabs mb-4">
              <li className="nav-item">
                <a className={`nav-link ${marketingSub==='analytics'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setMarketingSub('analytics')}}>
                  <i className="bi bi-graph-up mr-1"/>Analytics
                </a>
              </li>
              <li className="nav-item">
                <a className={`nav-link ${marketingSub==='googleads'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setMarketingSub('googleads')}}>
                  <i className="bi bi-badge-ad mr-1"/>Google Ads
                </a>
              </li>
            </ul>
          </div>

          {/* Analytics (GA4) Tab */}
          {marketingSub==='analytics' && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-4">
                <h3 className="mb-0">Google Analytics 4</h3>
                <div className="btn-group btn-group-sm">
                  <button className={`btn ${analyticsDateRange==='7daysAgo'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setAnalyticsDateRange('7daysAgo')}>7 Tage</button>
                  <button className={`btn ${analyticsDateRange==='30daysAgo'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setAnalyticsDateRange('30daysAgo')}>30 Tage</button>
                  <button className={`btn ${analyticsDateRange==='90daysAgo'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setAnalyticsDateRange('90daysAgo')}>90 Tage</button>
                </div>
              </div>

              {analyticsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"><span className="sr-only">Laden...</span></div>
                  <p className="mt-3 text-muted">Analytics-Daten werden geladen...</p>
                </div>
              ) : (
                <>
                  {/* KPI Tiles - 8 Metriken */}
                  {analyticsMetrics && (
                    <>
                      <div className="row mb-4">
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Sessions</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Anzahl der Besuche auf Ihrer Website. Eine Session beginnt, wenn ein Nutzer die Seite öffnet und endet nach 30 Min Inaktivität."/>
                              </div>
                              <div className="value h2 mb-0">{analyticsMetrics.sessions?.toLocaleString('de-DE') || 0}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Nutzer</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Einzigartige Besucher Ihrer Website (basierend auf Cookies/Client-ID). Ein Nutzer kann mehrere Sessions haben."/>
                              </div>
                              <div className="value h2 mb-0">{analyticsMetrics.users?.toLocaleString('de-DE') || 0}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Seitenaufrufe</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Gesamtzahl der aufgerufenen Seiten. Mehrfache Aufrufe derselben Seite werden gezählt."/>
                              </div>
                              <div className="value h2 mb-0">{analyticsMetrics.pageViews?.toLocaleString('de-DE') || 0}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Conversions</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Anzahl der Kaufabschlüsse (purchase Events) in Ihrem Online-Shop."/>
                              </div>
                              <div className="value h2 mb-0">{analyticsMetrics.conversions?.toLocaleString('de-DE') || 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="row mb-4">
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Umsatz</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Gesamtumsatz aus abgeschlossenen Käufen (E-Commerce Tracking). Basiert auf purchase-Events mit revenue-Wert."/>
                              </div>
                              <div className="value h2 mb-0">{fmtCurrency(analyticsMetrics.revenue || 0)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Ø Session-Dauer</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Durchschnittliche Dauer einer Session in Sekunden. Zeigt, wie lange Nutzer auf Ihrer Website verweilen."/>
                              </div>
                              <div className="value h2 mb-0">{Math.round(analyticsMetrics.avgSessionDuration || 0)}s</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Bounce Rate</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Prozentsatz der Besuche, bei denen nur eine Seite aufgerufen wurde. Niedrige Werte = besseres Engagement."/>
                              </div>
                              <div className="value h2 mb-0">{((analyticsMetrics.bounceRate || 0) * 100).toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="label text-uppercase small text-muted">Conv. Rate</div>
                                <i className="bi bi-info-circle text-muted" style={{cursor:'help'}} title="Conversion Rate: Prozentsatz der Sessions, die zu einem Kauf geführt haben. Zeigt die Effektivität Ihrer Website."/>
                              </div>
                              <div className="value h2 mb-0">{analyticsMetrics.sessions > 0 ? ((analyticsMetrics.conversions / analyticsMetrics.sessions) * 100).toFixed(2) : 0}%</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* KPI Charts mit Tabs - ALLE 8 Metriken */}
                      {metricsTimeSeries.length > 0 && (
                        <div className="card mb-4">
                          <div className="card-header bg-transparent border-0 pb-0">
                            <ul className="nav nav-tabs card-header-tabs">
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='sessions'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('sessions')}}>
                                  Sessions
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='users'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('users')}}>
                                  Nutzer
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='pageViews'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('pageViews')}}>
                                  Seitenaufrufe
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='conversions'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('conversions')}}>
                                  Conversions
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='revenue'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('revenue')}}>
                                  Umsatz
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='avgSessionDuration'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('avgSessionDuration')}}>
                                  Ø Session-Dauer
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='bounceRate'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('bounceRate')}}>
                                  Bounce Rate
                                </a>
                              </li>
                              <li className="nav-item">
                                <a className={`nav-link ${selectedKpiMetric==='conversionRate'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSelectedKpiMetric('conversionRate')}}>
                                  Conv. Rate
                                </a>
                              </li>
                            </ul>
                          </div>
                          <div className="card-body" style={{height: '300px'}}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metricsTimeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                <XAxis dataKey="date" stroke="#999" />
                                <YAxis stroke="#999" />
                                <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                                <Line type="monotone" dataKey={selectedKpiMetric} stroke="#0d6efd" strokeWidth={2} dot={{fill: '#0d6efd'}} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Traffic Sources */}
                  <div className="card mb-4">
                    <div className="card-header bg-transparent border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0"><i className="bi bi-diagram-3 mr-2"/>Traffic-Quellen</h5>
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowTrafficChart(!showTrafficChart)}>
                          <i className={`bi bi-${showTrafficChart?'chevron-up':'chevron-down'} mr-1`}/>
                          {showTrafficChart ? 'Chart ausblenden' : 'Chart anzeigen'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Chart Bereich */}
                    {showTrafficChart && selectedTrafficSource && trafficSourceTimeSeries.length > 0 && (
                      <div className="card-body border-bottom" style={{height: '300px'}}>
                        <div className="mb-2 small text-muted">
                          <strong>{selectedTrafficSource.source} / {selectedTrafficSource.medium}</strong> - Zeitverlauf
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                          <LineChart data={trafficSourceTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="date" stroke="#999" />
                            <YAxis stroke="#999" />
                            <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                            <Line type="monotone" dataKey="sessions" stroke="#28a745" strokeWidth={2} name="Sessions" />
                            <Line type="monotone" dataKey="users" stroke="#0d6efd" strokeWidth={2} name="Nutzer" />
                            <Line type="monotone" dataKey="conversions" stroke="#ffc107" strokeWidth={2} name="Conversions" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Quelle / Medium</th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(trafficSort, setTrafficSort, 'sessions')}>
                                Sessions {trafficSort.field === 'sessions' && (trafficSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(trafficSort, setTrafficSort, 'users')}>
                                Nutzer {trafficSort.field === 'users' && (trafficSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(trafficSort, setTrafficSort, 'conversions')}>
                                Conversions {trafficSort.field === 'conversions' && (trafficSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortData(analyticsTrafficSources, trafficSort.field, trafficSort.order).slice(0, showAllTraffic ? undefined : 10).map((src, i) => (
                              <tr key={i}>
                                <td><strong>{src.source}</strong> / {src.medium}</td>
                                <td className="text-right">{src.sessions.toLocaleString('de-DE')}</td>
                                <td className="text-right">{src.users.toLocaleString('de-DE')}</td>
                                <td className="text-right">{src.conversions.toLocaleString('de-DE')}</td>
                              </tr>
                            ))}
                          </tbody>
                          {analyticsTrafficSources.length > 10 && (
                            <tfoot>
                              <tr>
                                <td colSpan={4} className="text-center" style={{cursor:'pointer', padding:'12px'}} onClick={()=>setShowAllTraffic(!showAllTraffic)}>
                                  <i className={`bi bi-chevron-${showAllTraffic?'up':'down'} mr-2`}/>
                                  {showAllTraffic ? 'Weniger anzeigen' : `${analyticsTrafficSources.length - 10} weitere anzeigen`}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Kategorie-Seiten */}
                  <div className="card mb-4">
                    <div className="card-header bg-transparent border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0"><i className="bi bi-folder mr-2"/>Kategorie-Seiten Performance</h5>
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowCategoryChart(!showCategoryChart)}>
                          <i className={`bi bi-${showCategoryChart?'chevron-up':'chevron-down'} mr-1`}/>
                          {showCategoryChart ? 'Chart ausblenden' : 'Chart anzeigen'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Chart Bereich */}
                    {showCategoryChart && selectedCategoryPage && categoryPageTimeSeries.length > 0 && (
                      <div className="card-body border-bottom" style={{height: '300px'}}>
                        <div className="mb-2 small text-muted">
                          <strong>{selectedCategoryPage.pageTitle}</strong> - Zeitverlauf
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                          <LineChart data={categoryPageTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="date" stroke="#999" />
                            <YAxis stroke="#999" />
                            <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                            <Line type="monotone" dataKey="pageViews" stroke="#28a745" strokeWidth={2} name="Impressionen" />
                            <Line type="monotone" dataKey="uniquePageViews" stroke="#0d6efd" strokeWidth={2} name="Besucher" />
                            <Line type="monotone" dataKey="avgTimeOnPage" stroke="#ffc107" strokeWidth={2} name="Ø Verweildauer (Sek.)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Seite</th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(categorySort, setCategorySort, 'pageViews')}>
                                Impressionen {categorySort.field === 'pageViews' && (categorySort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(categorySort, setCategorySort, 'uniquePageViews')}>
                                Besucher {categorySort.field === 'uniquePageViews' && (categorySort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(categorySort, setCategorySort, 'avgTimeOnPage')}>
                                Ø Verweildauer (Sek.) {categorySort.field === 'avgTimeOnPage' && (categorySort.order === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortData(analyticsCategoryPages, categorySort.field, categorySort.order).slice(0, showAllCategories ? undefined : 10).map((page, i) => (
                              <tr key={i} 
                                  style={{cursor: 'pointer'}} 
                                  className={selectedCategoryPage?.pagePath === page.pagePath ? 'table-active' : ''}
                                  onClick={()=>{
                                    setSelectedCategoryPage(page)
                                    setShowCategoryChart(true)
                                    loadPageTimeSeries(page.pagePath, setCategoryPageTimeSeries)
                                  }}>
                                <td>
                                  <div className="font-weight-bold">{page.pageTitle}</div>
                                  <div className="small text-muted">{page.pagePath}</div>
                                </td>
                                <td className="text-right">{page.pageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{page.uniquePageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{Math.round(page.avgTimeOnPage)}</td>
                              </tr>
                            ))}
                          </tbody>
                          {analyticsCategoryPages.length > 10 && (
                            <tfoot>
                              <tr>
                                <td colSpan={4} className="text-center" style={{cursor:'pointer', padding:'12px'}} onClick={()=>setShowAllCategories(!showAllCategories)}>
                                  <i className={`bi bi-chevron-${showAllCategories?'up':'down'} mr-2`}/>
                                  {showAllCategories ? 'Weniger anzeigen' : `${analyticsCategoryPages.length - 10} weitere anzeigen`}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Top 100 Produktseiten */}
                  <div className="card mb-4">
                    <div className="card-header bg-transparent border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0"><i className="bi bi-box mr-2"/>Top 100 Produktseiten</h5>
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowProductChart(!showProductChart)}>
                          <i className={`bi bi-${showProductChart?'chevron-up':'chevron-down'} mr-1`}/>
                          {showProductChart ? 'Chart ausblenden' : 'Chart anzeigen'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Chart Bereich */}
                    {showProductChart && selectedProductPage && productPageTimeSeries.length > 0 && (
                      <div className="card-body border-bottom" style={{height: '300px'}}>
                        <div className="mb-2 small text-muted">
                          <strong>{selectedProductPage.pageTitle || selectedProductPage.pagePath}</strong> - Zeitverlauf
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                          <LineChart data={productPageTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="date" stroke="#999" />
                            <YAxis stroke="#999" />
                            <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                            <Line type="monotone" dataKey="pageViews" stroke="#28a745" strokeWidth={2} name="Impressionen" />
                            <Line type="monotone" dataKey="uniquePageViews" stroke="#0d6efd" strokeWidth={2} name="Besucher" />
                            <Line type="monotone" dataKey="avgTimeOnPage" stroke="#ffc107" strokeWidth={2} name="Ø Verweildauer (Sek.)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-sm mb-0">
                          <thead>
                            <tr>
                              <th style={{width: '60px'}}>#</th>
                              <th>Produktseite</th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(productSort, setProductSort, 'pageViews')}>
                                Impressionen {productSort.field === 'pageViews' && (productSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(productSort, setProductSort, 'uniquePageViews')}>
                                Besucher {productSort.field === 'uniquePageViews' && (productSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(productSort, setProductSort, 'avgTimeOnPage')}>
                                Ø Verweildauer (Sek.) {productSort.field === 'avgTimeOnPage' && (productSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortData(analyticsProductPages, productSort.field, productSort.order).slice(0, showAllProducts ? 100 : 10).map((page, i) => (
                              <tr key={i}
                                  style={{cursor: 'pointer'}}
                                  className={selectedProductPage?.pagePath === page.pagePath ? 'table-active' : ''}
                                  onClick={()=>{
                                    setSelectedProductPage(page)
                                    setShowProductChart(true)
                                    loadPageTimeSeries(page.pagePath, setProductPageTimeSeries)
                                  }}>
                                <td className="text-muted">{i + 1}</td>
                                <td>
                                  <div className="font-weight-bold small">{page.pageTitle || page.pagePath}</div>
                                  <div className="small text-muted text-truncate" style={{maxWidth: '500px'}}>{page.pagePath}</div>
                                </td>
                                <td className="text-right">{page.pageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{page.uniquePageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{Math.round(page.avgTimeOnPage)}</td>
                              </tr>
                            ))}
                          </tbody>
                          {analyticsProductPages.length > 10 && (
                            <tfoot>
                              <tr>
                                <td colSpan={5} className="text-center" style={{cursor:'pointer', padding:'12px'}} onClick={()=>setShowAllProducts(!showAllProducts)}>
                                  <i className={`bi bi-chevron-${showAllProducts?'up':'down'} mr-2`}/>
                                  {showAllProducts ? 'Weniger anzeigen' : `${analyticsProductPages.length - 10} weitere anzeigen (bis zu ${Math.min(analyticsProductPages.length, 100)})`}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Info-Seiten */}
                  {analyticsInfoPages.length > 0 && (
                    <div className="card mb-4">
                      <div className="card-header bg-transparent border-0">
                        <div className="d-flex justify-content-between align-items-center">
                          <h5 className="mb-0"><i className="bi bi-info-circle mr-2"/>Info-Seiten Performance</h5>
                          <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowInfoChart(!showInfoChart)}>
                            <i className={`bi bi-${showInfoChart?'chevron-up':'chevron-down'} mr-1`}/>
                            {showInfoChart ? 'Chart ausblenden' : 'Chart anzeigen'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Chart Bereich */}
                      {showInfoChart && selectedInfoPage && infoPageTimeSeries.length > 0 && (
                        <div className="card-body border-bottom" style={{height: '300px'}}>
                          <div className="mb-2 small text-muted">
                            <strong>{selectedInfoPage.pageTitle || selectedInfoPage.pagePath}</strong> - Zeitverlauf
                          </div>
                          <ResponsiveContainer width="100%" height="85%">
                            <LineChart data={infoPageTimeSeries}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                              <XAxis dataKey="date" stroke="#999" />
                              <YAxis stroke="#999" />
                              <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                              <Line type="monotone" dataKey="pageViews" stroke="#28a745" strokeWidth={2} name="Impressionen" />
                              <Line type="monotone" dataKey="uniquePageViews" stroke="#0d6efd" strokeWidth={2} name="Besucher" />
                              <Line type="monotone" dataKey="avgTimeOnPage" stroke="#ffc107" strokeWidth={2} name="Ø Verweildauer (Sek.)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="card-body p-0">
                        <div className="table-responsive">
                          <table className="table table-dark table-hover table-sm mb-0">
                            <thead>
                              <tr>
                                <th>Seite</th>
                                <th className="text-right">Impressionen</th>
                                <th className="text-right">Besucher</th>
                                <th className="text-right">Ø Verweildauer (Sek.)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsInfoPages.map((page, i) => (
                                <tr key={i}
                                    style={{cursor: 'pointer'}}
                                    className={selectedInfoPage?.pagePath === page.pagePath ? 'table-active' : ''}
                                    onClick={()=>{
                                      setSelectedInfoPage(page)
                                      setShowInfoChart(true)
                                      loadPageTimeSeries(page.pagePath, setInfoPageTimeSeries)
                                    }}>
                                  <td>
                                    <div className="font-weight-bold">{page.pageTitle || page.pagePath}</div>
                                    <div className="small text-muted">{page.pagePath}</div>
                                  </td>
                                  <td className="text-right">{page.pageViews.toLocaleString('de-DE')}</td>
                                  <td className="text-right">{page.uniquePageViews.toLocaleString('de-DE')}</td>
                                  <td className="text-right">{Math.round(page.avgTimeOnPage)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Erfolg von Beileger */}
                  {analyticsBeilegerData && (
                    <div className="card mb-4">
                      <div className="card-header bg-transparent border-0">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className="mb-0"><i className="bi bi-qr-code mr-2"/>Erfolg von Beileger (QR Code)</h5>
                            <div className="small text-muted mt-1">
                              <i className="bi bi-info-circle mr-1"/>Nur Direct Traffic zu /account/ (Besucher vom QR Code ohne Referrer)
                            </div>
                          </div>
                          <div className="d-flex gap-3">
                            <div className="text-right">
                              <div className="small text-muted">Gesamt Besuche</div>
                              <div className="h5 mb-0 text-success">{analyticsBeilegerData.totalVisits?.toLocaleString('de-DE') || 0}</div>
                            </div>
                            <div className="text-right ml-3">
                              <div className="small text-muted">Unique Besucher</div>
                              <div className="h5 mb-0 text-info">{analyticsBeilegerData.uniqueVisitors?.toLocaleString('de-DE') || 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {analyticsBeilegerData.pages && analyticsBeilegerData.pages.length > 0 && (
                        <div className="card-body p-0">
                          <div className="table-responsive">
                            <table className="table table-dark table-hover table-sm mb-0">
                              <thead>
                                <tr>
                                  <th>Account-Seite</th>
                                  <th className="text-right">Impressionen</th>
                                  <th className="text-right">Besucher</th>
                                  <th className="text-right">Ø Verweildauer (Sek.)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analyticsBeilegerData.pages.map((page, i) => (
                                  <tr key={i}>
                                    <td>
                                      <div className="font-weight-bold small">{page.pageTitle || page.pagePath}</div>
                                      <div className="small text-muted">{page.pagePath}</div>
                                    </td>
                                    <td className="text-right">{page.pageViews.toLocaleString('de-DE')}</td>
                                    <td className="text-right">{page.uniquePageViews.toLocaleString('de-DE')}</td>
                                    <td className="text-right">{Math.round(page.avgTimeOnPage)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top 100 Alle Seiten */}
                  <div className="card">
                    <div className="card-header bg-transparent border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0"><i className="bi bi-file-earmark-text mr-2"/>Top 100 Alle Seiten</h5>
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowAllPagesChart(!showAllPagesChart)}>
                          <i className={`bi bi-${showAllPagesChart?'chevron-up':'chevron-down'} mr-1`}/>
                          {showAllPagesChart ? 'Chart ausblenden' : 'Chart anzeigen'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Chart Bereich */}
                    {showAllPagesChart && selectedAllPage && allPageTimeSeries.length > 0 && (
                      <div className="card-body border-bottom" style={{height: '300px'}}>
                        <div className="mb-2 small text-muted">
                          <strong>{selectedAllPage.pageTitle || selectedAllPage.pagePath}</strong> - Zeitverlauf
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                          <LineChart data={allPageTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="date" stroke="#999" />
                            <YAxis stroke="#999" />
                            <Tooltip contentStyle={{backgroundColor: '#2d2d2d', border: '1px solid #444'}} />
                            <Line type="monotone" dataKey="pageViews" stroke="#28a745" strokeWidth={2} name="Impressionen" />
                            <Line type="monotone" dataKey="uniquePageViews" stroke="#0d6efd" strokeWidth={2} name="Besucher" />
                            <Line type="monotone" dataKey="avgTimeOnPage" stroke="#ffc107" strokeWidth={2} name="Ø Verweildauer (Sek.)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-sm mb-0">
                          <thead>
                            <tr>
                              <th style={{width: '60px'}}>#</th>
                              <th>Seite</th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(allPagesSort, setAllPagesSort, 'pageViews')}>
                                Impressionen {allPagesSort.field === 'pageViews' && (allPagesSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(allPagesSort, setAllPagesSort, 'uniquePageViews')}>
                                Besucher {allPagesSort.field === 'uniquePageViews' && (allPagesSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="text-right" style={{cursor:'pointer'}} onClick={()=>toggleSort(allPagesSort, setAllPagesSort, 'avgTimeOnPage')}>
                                Ø Verweildauer (Sek.) {allPagesSort.field === 'avgTimeOnPage' && (allPagesSort.order === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortData(analyticsTopPages, allPagesSort.field, allPagesSort.order).slice(0, 100).map((page, i) => (
                              <tr key={i}
                                  style={{cursor: 'pointer'}}
                                  className={selectedAllPage?.pagePath === page.pagePath ? 'table-active' : ''}
                                  onClick={()=>{
                                    setSelectedAllPage(page)
                                    setShowAllPagesChart(true)
                                    loadPageTimeSeries(page.pagePath, setAllPageTimeSeries)
                                  }}>
                                <td className="text-muted">{i + 1}</td>
                                <td>
                                  <div className="font-weight-bold small">{page.pageTitle || page.pagePath}</div>
                                  <div className="small text-muted text-truncate" style={{maxWidth: '500px'}}>{page.pagePath}</div>
                                </td>
                                <td className="text-right">{page.pageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{page.uniquePageViews.toLocaleString('de-DE')}</td>
                                <td className="text-right">{Math.round(page.avgTimeOnPage)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Google Ads Tab */}
          {marketingSub==='googleads' && (
            <div>
              <h3 className="mb-4">Google Ads Kampagnen</h3>

              {googleAdsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"><span className="sr-only">Laden...</span></div>
                  <p className="mt-3 text-muted">Google Ads Daten werden geladen...</p>
                </div>
              ) : googleAdsCampaigns.length > 0 ? (
                <div className="card">
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-dark table-hover table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Kampagne</th>
                            <th>Status</th>
                            <th className="text-right">Impressionen</th>
                            <th className="text-right">Klicks</th>
                            <th className="text-right">CTR</th>
                            <th className="text-right">Kosten</th>
                            <th className="text-right">CPC</th>
                            <th className="text-right">Conversions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {googleAdsCampaigns.map((camp, i) => (
                            <tr key={i}>
                              <td className="font-weight-bold">{camp.campaignName}</td>
                              <td>
                                <span className={`badge badge-${camp.status==='ENABLED'?'success':'secondary'}`}>
                                  {camp.status}
                                </span>
                              </td>
                              <td className="text-right">{camp.impressions.toLocaleString('de-DE')}</td>
                              <td className="text-right">{camp.clicks.toLocaleString('de-DE')}</td>
                              <td className="text-right">{camp.ctr.toFixed(2)}%</td>
                              <td className="text-right">{fmtCurrency(camp.costAmount)}</td>
                              <td className="text-right">{fmtCurrency(camp.cpcAmount)}</td>
                              <td className="text-right">{camp.conversions.toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-info">
                  <i className="bi bi-info-circle mr-2"/>
                  Google Ads API ist derzeit noch in Entwicklung. Die Daten werden bald verfügbar sein.
                </div>
              )}
            </div>
          )}

          {/* Glossar Tab - REMOVED (moved to main menu) */}
          {false && marketingSub==='glossar' && (
            <div>
              <h3 className="mb-4"><i className="bi bi-book mr-2"/>Produkt-Glossar</h3>
              
              <div className="alert alert-info mb-4">
                <i className="bi bi-info-circle mr-2"/>
                <strong>Kontrolliertes Vokabular</strong> für die Kaltakquise-Analyse. Diese Begriffe werden automatisch auf Firmen-Websites erkannt.
              </div>

              {/* Sub-Tabs für Glossar-Kategorien */}
              <ul className="nav nav-pills mb-4">
                <li className="nav-item">
                  <a className={`nav-link ${glossarSub==='anwendungen'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('anwendungen')}}>
                    <i className="bi bi-tools mr-1"/>Anwendungen <span className="badge badge-light ml-1">71</span>
                  </a>
                </li>
                <li className="nav-item ml-2">
                  <a className={`nav-link ${glossarSub==='kategorien'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('kategorien')}}>
                    <i className="bi bi-grid mr-1"/>Kategorien <span className="badge badge-light ml-1">88</span>
                  </a>
                </li>
                <li className="nav-item ml-2">
                  <a className={`nav-link ${glossarSub==='werkstoffe'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('werkstoffe')}}>
                    <i className="bi bi-layers mr-1"/>Werkstoffe <span className="badge badge-light ml-1">90</span>
                  </a>
                </li>
                <li className="nav-item ml-2">
                  <a className={`nav-link ${glossarSub==='maschinen'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('maschinen')}}>
                    <i className="bi bi-gear mr-1"/>Maschinentypen <span className="badge badge-light ml-1">62</span>
                  </a>
                </li>
              </ul>

              {/* Glossar Content */}
              <div className="card">
                <div className="card-body">
                  <div className="mb-3">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Begriffe durchsuchen..."
                      value={glossarSearch}
                      onChange={(e) => setGlossarSearch(e.target.value)}
                    />
                  </div>

                  {glossarSub === 'anwendungen' && (
                    <div>
                      <h5 className="mb-3">Anwendungen (71 Begriffe)</h5>
                      <div className="alert alert-secondary">
                        <small>Abrichten, Anfasen, Anrauen, Anschleifen, Aufrauen, Bürsten, Definiertes Schliffbild, Egalisieren, Entgraten, Entlacken, Entrosten, Entzundern, Feilen, Feinschleifen, Flachschleifen, Fräsen, Gleitschleifen, Glätten, Gravieren, Hochglanzpolieren, Hochglanzverdichten, Honen, Kalibrieren, Kantenbrechen, Kantenverrunden, Läppen, Materialabtragung, Materialtrennung, Mattieren, Oberflächenfinish, Oberflächenveredelung, Oberflächenvorbereitung, Polieren, Raspeln, Reinigen, Rundschleifen, Satinieren, Säubern, Schärfen, Schleifen, Schruppschleifen, Schwabbeln, Schweißnahtbearbeitung, Schweißnahtvorbereitung, Strukturieren, Superfinish, Trennen, Trowalisieren, Innenrundschleifen, Kehlnahtbearbeitung, Besäumen, Feinschliff, Grobschliff, Mittelschliff, Nachschliff, Vorschliff, Glättung, Gravur, Kantenverrundung, Mattierung, Politur, Reinigung, Schliff, Schruppschliff, Strukturierung, Nassschliff, Nassschleifen, Flächenbearbeitung, Kantenbearbeitung</small>
                      </div>
                    </div>
                  )}

                  {glossarSub === 'kategorien' && (
                    <div>
                      <h5 className="mb-3">Produktkategorien (88 Begriffe)</h5>
                      <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                        <small>Schleifbänder, Schleifpapier / Schleifrollen / Schleifbögen, Schleifscheiben / Schleifblätter, Trennscheiben, Fächerscheiben, Fiberscheiben, Diamanttrennscheiben, Spezielle Schleifscheiben, Vliesprodukte, Fräser / Frässtifte, Technische Bürsten, Schleifstifte, Schleifsteine, Fächerschleifer / Schleifmops, Feilen, Fächerräder / Schleifräder / Schleifwalzen, Graphitbelag, Klettbelag, Schleifteller / Schleifmittelträger, Sonstige Schleif-, Trenn- und Bohrwerkzeuge, Schruppscheiben, Polierscheiben, Schleifbockscheiben, Grobreinigungsscheiben, Gitterscheiben, Vliesscheiben, Kompaktscheiben, Schnellwechselscheiben, Schleiftöpfe, Vliesbänder, Vliesstifte, Vliesräder, Vliesscheiben / Fächerscheiben / Schleifmopteller, Vlies Combidiscs / Vlies Quick Change Discs, Vlies-Bögen / Handpads, Vliesrollen, Rundbürsten, Rundbürsten mit Schaft, Handbürsten, Topfbürsten mit Gewinde, Topfbürsten mit Schaft, Kegelbürsten mit Gewinde, Kegelbürsten mit Schaft, Pinselbürsten mit Schaft, Walzenbürsten, Innenbürsten, Tellerbürsten Composite, INOX-TOTAL, Zubehör, Diamantfeilen, Nadelfeilen, Riffelfeilen, Werkstattfeilen, Schlüsselfeilen, Sägefeilen, Handy-Feilen / Handy-Raspeln, Messerfeilen, Entgratfeilen / Entgratklingen / Entgratsenker, Holzfeilen / Holzraspeln, Angelfeilen, Drehbankfeilen, Metallfeilen, Karosseriefeilen / Lackhobel, Huffeilen / Hufhobel, Hemmungsfeilen, Kabinettfeilen / -raspel, Halterungen / Hüllen / Hefte, Keramikfaserfeilen, CORINOX-Feilen, Sonstige Feilen, Fächerräder, Schleifräder, Schleifwalzen, Bohrer / Lochwerkzeuge, Schleifhülsen / Schleifkappen / Schleifrolls, Schleifschwämme / Schleifklötze, Schleifsterne, Tuchringe, Sonstiges und Zubehör, Stichsägeblätter, Säbelsägeblätter, Kreissägeblätter, Breitbänder, Feilenbänder, Bänder für Handbandschleifer, Langbänder & Kantenschleifbänder, Parkettschleifbänder, Bänder für Rohrbandschleifer, Bänder für Schärfmaschinen, Schmalbänder</small>
                      </div>
                    </div>
                  )}

                  {glossarSub === 'werkstoffe' && (
                    <div>
                      <h5 className="mb-3">Werkstoffe (90 Begriffe)</h5>
                      <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                        <small>Aluguss, Aluminium, Bleche, Chromstahl, Nickelstahl, Chrome, Edelstahl, Guss, Hochlegierte Stähle, Kohlenstoffstahl, Legierte Stähle, Legierungen, Leichtmetalle, NE-Metalle, Sandwichmaterial, Stahl, Titan, Abrasive Materialien, Altbeton, Altbeton armiert, Asphalt, Baustellenmaterialien, Beton, Bitumen, Dachziegel, Estrich, Estrichfugen, Feinsteinzeug, Fliesen, Frischbeton, Füller, Gasbeton, Gips, Gipskartonwände, Glas, Granit, Harte Bodenfliesen, Harte Wandfliesen, Hartes Feinsteinzeug, Hartgestein, Kacheln, Kalksandstein, Keramik, Klinker, Marmor, Mauerwerk, Naturstein, Ofenkacheln glasiert, Porenbeton, Porphyr/Quarzit, Porzellan, Putz, Sandstein, Schamotte, Stein, Terrazzo, Ziegel, Beschichtete Platten, Brennholz, Grünholz, HPL Platten, Hartholz, Holz mit Nägeln, Holzwerkstoffe, Konstruktionsholz, Küchenarbeitsplatten, Laminat, MDF Platten, Multiplexplatten, Spanplatten, Sperrholz, Tischlerplatten, Weichholz, Coatings, Farbe, Gel-Coats, Grundierung, Gummi, Klebstoff, Lack, Leim, Spachtelmasse, Epoxidharz, Faserverstärkte Kunststoffe, Kompositwerkstoffe, Kunststoff, Leder, Metall, Holz, Alu</small>
                      </div>
                    </div>
                  )}

                  {glossarSub === 'maschinen' && (
                    <div>
                      <h5 className="mb-3">Maschinentypen (62 Begriffe)</h5>
                      <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                        <small>Schleifklotz, Handpad, Handfeile, Handschleifbogen, Schleifvlies, Schleifschwamm, Poliertuch, Exzenterschleifer, Schwingschleifer, Dreieckschleifer, Bandschleifer, Geradschleifer, Winkelschleifer, Drehzahlgeregelter Winkelschleifer, Bohrmaschine, Poliermaschine, Satiniermaschine, Kehlnahtschleifer, Parkettschleifer, Mauerschlitzfräse, Fugenschneider, Akkuschrauber, Stichsäge, Säbelsäge, Handbandfeile, Breitbandschleifmaschine, Kantenschleifmaschine, Tischschleifmaschine, Ständerschleifmaschine, Tellerschleifmaschine, Bandschleifmaschine, Schleifbock, Centerless-Schleifmaschine, Flachschleifmaschine, Langbandschleifmaschine, Profilschleifmaschine, Trenn- und Schleifmaschine, Hubbalkenschleifmaschine, Rohrschleifmaschine, Profilbandschleifmaschine, Kantenfräsmaschine, Langhals-Deckenschleifer, Glas- & Steinbearbeitungsmaschine, Roboter-Schleifanlage, CNC-Schleifmaschine, Automatisierte Polieranlage, Automatisches Entgrat-/Finishsystem, Entgratstation, Polierstation, Finishmodul, Kombi-Schleifstation, Cobot-Schleifer, Laserunterstütztes Schleifsystem, Druckluftschleifer, Elektroschleifer, Akku-Schleifer, Hydraulik-Schleifer, Magnetband-Schleifmodul, Vibrations-Schleifer</small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Glossar (eigener Tab) */}
      {activeTab==='glossar' && (
        <div>
          <h3 className="mb-4"><i className="bi bi-book mr-2"/>Produkt-Glossar</h3>
          
          <div className="alert alert-info mb-4">
            <i className="bi bi-info-circle mr-2"/>
            <strong>Kontrolliertes Vokabular</strong> für die Kaltakquise-Analyse. Diese Begriffe werden automatisch auf Firmen-Websites erkannt.
          </div>

          {/* Sub-Tabs für Glossar-Kategorien */}
          <ul className="nav nav-pills mb-4">
            <li className="nav-item">
              <a className={`nav-link ${glossarSub==='anwendungen'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('anwendungen')}}>
                <i className="bi bi-tools mr-1"/>Anwendungen <span className="badge badge-light ml-1">71</span>
              </a>
            </li>
            <li className="nav-item ml-2">
              <a className={`nav-link ${glossarSub==='kategorien'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('kategorien')}}>
                <i className="bi bi-grid mr-1"/>Kategorien <span className="badge badge-light ml-1">88</span>
              </a>
            </li>
            <li className="nav-item ml-2">
              <a className={`nav-link ${glossarSub==='werkstoffe'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('werkstoffe')}}>
                <i className="bi bi-layers mr-1"/>Werkstoffe <span className="badge badge-light ml-1">90</span>
              </a>
            </li>
            <li className="nav-item ml-2">
              <a className={`nav-link ${glossarSub==='maschinen'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('maschinen')}}>
                <i className="bi bi-gear mr-1"/>Maschinentypen <span className="badge badge-light ml-1">62</span>
              </a>
            </li>
            <li className="nav-item ml-2">
              <a className={`nav-link ${glossarSub==='branchen'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setGlossarSub('branchen')}}>
                <i className="bi bi-building mr-1"/>Branchen <span className="badge badge-light ml-1">8</span>
              </a>
            </li>
          </ul>

          {/* Glossar Content */}
          <div className="card">
            <div className="card-body">
              <div className="mb-3">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Begriffe durchsuchen..."
                  value={glossarSearch}
                  onChange={(e) => setGlossarSearch(e.target.value)}
                />
              </div>

              {glossarSub === 'anwendungen' && (
                <div>
                  <h5 className="mb-3">Anwendungen (71 Begriffe)</h5>
                  <div className="alert alert-secondary">
                    <small>Abrichten, Anfasen, Anrauen, Anschleifen, Aufrauen, Bürsten, Definiertes Schliffbild, Egalisieren, Entgraten, Entlacken, Entrosten, Entzundern, Feilen, Feinschleifen, Flachschleifen, Fräsen, Gleitschleifen, Glätten, Gravieren, Hochglanzpolieren, Hochglanzverdichten, Honen, Kalibrieren, Kantenbrechen, Kantenverrunden, Läppen, Materialabtragung, Materialtrennung, Mattieren, Oberflächenfinish, Oberflächenveredelung, Oberflächenvorbereitung, Polieren, Raspeln, Reinigen, Rundschleifen, Satinieren, Säubern, Schärfen, Schleifen, Schruppschleifen, Schwabbeln, Schweißnahtbearbeitung, Schweißnahtvorbereitung, Strukturieren, Superfinish, Trennen, Trowalisieren, Innenrundschleifen, Kehlnahtbearbeitung, Besäumen, Feinschliff, Grobschliff, Mittelschliff, Nachschliff, Vorschliff, Glättung, Gravur, Kantenverrundung, Mattierung, Politur, Reinigung, Schliff, Schruppschliff, Strukturierung, Nassschliff, Nassschleifen, Flächenbearbeitung, Kantenbearbeitung</small>
                  </div>
                </div>
              )}

              {glossarSub === 'kategorien' && (
                <div>
                  <h5 className="mb-3">Produktkategorien (88 Begriffe)</h5>
                  <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <small>Schleifbänder, Schleifpapier / Schleifrollen / Schleifbögen, Schleifscheiben / Schleifblätter, Trennscheiben, Fächerscheiben, Fiberscheiben, Diamanttrennscheiben, Spezielle Schleifscheiben, Vliesprodukte, Fräser / Frässtifte, Technische Bürsten, Schleifstifte, Schleifsteine, Fächerschleifer / Schleifmops, Feilen, Fächerräder / Schleifräder / Schleifwalzen, Graphitbelag, Klettbelag, Schleifteller / Schleifmittelträger, Sonstige Schleif-, Trenn- und Bohrwerkzeuge, Schruppscheiben, Polierscheiben, Schleifbockscheiben, Grobreinigungsscheiben, Gitterscheiben, Vliesscheiben, Kompaktscheiben, Schnellwechselscheiben, Schleiftöpfe, Vliesbänder, Vliesstifte, Vliesräder, und weitere...</small>
                  </div>
                </div>
              )}

              {glossarSub === 'werkstoffe' && (
                <div>
                  <h5 className="mb-3">Werkstoffe (90 Begriffe)</h5>
                  <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <small>Aluguss, Aluminium, Bleche, Chromstahl, Nickelstahl, Chrome, Edelstahl, Guss, Hochlegierte Stähle, Kohlenstoffstahl, Legierte Stähle, Legierungen, Leichtmetalle, NE-Metalle, Sandwichmaterial, Stahl, Titan, Abrasive Materialien, Beton, Glas, Granit, Keramik, Marmor, Naturstein, Holz, Kunststoff, und weitere...</small>
                  </div>
                </div>
              )}

              {glossarSub === 'maschinen' && (
                <div>
                  <h5 className="mb-3">Maschinentypen (62 Begriffe)</h5>
                  <div className="alert alert-secondary" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <small>Schleifklotz, Handpad, Handfeile, Exzenterschleifer, Schwingschleifer, Dreieckschleifer, Bandschleifer, Geradschleifer, Winkelschleifer, Poliermaschine, Satiniermaschine, Breitbandschleifmaschine, Kantenschleifmaschine, Schleifbock, CNC-Schleifmaschine, Roboter-Schleifanlage, und weitere...</small>
                  </div>
                </div>
              )}

              {glossarSub === 'branchen' && (
                <div>
                  <h5 className="mb-3">Relevante Branchen (8 Hauptbranchen)</h5>
                  <div className="alert alert-info mb-3">
                    <i className="bi bi-info-circle mr-2"/>
                    Diese Branchen sind primäre Zielgruppen für Schleif-, Trenn- und Polierwerkzeuge im DACH-Raum.
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-car-front mr-2"/>Automobilindustrie</h6>
                          <p className="text-muted small mb-0">Fahrzeug- und Karosseriebau</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-wrench mr-2"/>Metallverarbeitung</h6>
                          <p className="text-muted small mb-0">Schlosserei & Stahlbau</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-gear mr-2"/>Maschinen- und Apparatebau</h6>
                          <p className="text-muted small mb-0">inkl. Behälter- und Rohrbau</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-airplane mr-2"/>Luft- und Raumfahrt</h6>
                          <p className="text-muted small mb-0">Flugzeugbau, -wartung</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-train-front mr-2"/>Schiff- und Bahnindustrie</h6>
                          <p className="text-muted small mb-0">Schiffbau, Schienenfahrzeuge</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-tree mr-2"/>Holz- und Möbelindustrie</h6>
                          <p className="text-muted small mb-0">Innenausbau, Parkett</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-hammer mr-2"/>Gießereien und Schmieden</h6>
                          <p className="text-muted small mb-0">Metallguss, Schmiedearbeiten</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body">
                          <h6 className="text-primary"><i className="bi bi-paint-bucket mr-2"/>Maler- und Ausbauhandwerk</h6>
                          <p className="text-muted small mb-0">Trockenbau, Ausbau</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert alert-secondary mt-3">
                    <h6 className="mb-2">📊 Branchenfamilien (Cluster)</h6>
                    <ul className="mb-0">
                      <li><strong>Metallbau / Apparate-/Maschinenbau:</strong> Schlossereibetriebe, Stahlbau, Anlagen- und Behälterbau</li>
                      <li><strong>Fahrzeug- und Schienenbau:</strong> Automobilhersteller, Nutzfahrzeuge, Schienen- und Schiffbaubetriebe</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warmakquise */}
      {activeTab==='warmakquise' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h3 className="mb-0"><i className="bi bi-people mr-2"/>Warmakquise</h3>
              <div className="text-muted small">Aktive, wertige Kunden – Score-basiert priorisiert</div>
            </div>
            <div>
              <button className="btn btn-primary btn-sm mr-2" disabled={importing} onClick={runImport}>{importing? 'Import läuft…' : 'Kunden importieren / aktualisieren'}</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={exportLeadsCSV}>CSV Export</button>
            </div>
          </div>

          {/* Filterleiste */}
          <div className="card mb-3">
            <div className="card-body d-flex align-items-center flex-wrap">
              <div className="mr-2 mb-2">
                <label className="small mb-1">Status</label>
                <select className="form-control form-control-sm" value={statusF} onChange={e=>{ setStatusF(e.target.value); setPageF(1) }}>
                  <option value="">Alle</option>
                  <option value="open">open</option>
                  <option value="called">called</option>
                  <option value="qualified">qualified</option>
                  <option value="discarded">discarded</option>
                </select>
              </div>
              <div className="mr-2 mb-2">
                <label className="small mb-1">B2B</label>
                <select className="form-control form-control-sm" value={b2bF} onChange={e=>{ setB2bF(e.target.value); setPageF(1) }}>
                  <option value="">Alle</option>
                  <option value="true">nur B2B</option>
                  <option value="false">nur B2C</option>
                </select>
              </div>
              <div className="mr-2 mb-2">
                <label className="small mb-1">Min-Score</label>
                <input type="number" className="form-control form-control-sm" min={0} max={100} value={minScoreF} onChange={e=>{ setMinScoreF(e.target.value); setPageF(1) }} style={{width:110}}/>
              </div>
              <div className="ml-auto mb-2 d-flex align-items-center" style={{gap:8}}>
                <input type="text" className="form-control form-control-sm" placeholder="Suchen (Name/Telefon/Email/Nr)" value={qTyping} onChange={e=>setQTyping(e.target.value)} style={{minWidth:260}}/>
              </div>
            </div>
          </div>

          {/* Tabelle */}
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover table-sm mb-0">
                  <thead className="thead-dark">
                    <tr>
                      <th style={{width:90}}>Score</th>
                      <th>Name</th>
                      <th style={{width:80}}>B2B</th>
                      <th style={{width:140}}>Letzte Bestellung</th>
                      <th style={{width:90}}>Orders</th>
                      <th style={{width:160}}>Umsatz netto</th>
                      <th style={{width:220}}>Kontakt</th>
                      <th style={{width:120}}>Status</th>
                      <th style={{width:120}}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsLoading && Array.from({length:5}).map((_,i)=> (
                      <tr key={`sk-${i}`}>
                        <td><div className="bg-secondary" style={{height:16, width:40, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:180, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:50, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:100, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:40, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:100, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:160, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:80, borderRadius:6}}/></td>
                        <td><div className="bg-secondary" style={{height:14, width:80, borderRadius:6}}/></td>
                      </tr>
                    ))}

                    {!leadsLoading && leads.map(lead => (
                      <tr key={lead.id}>
                        <td className="align-middle"><ScoreBadge v={lead.warmScore}/></td>
                        <td className="align-middle">
                          <div className="font-weight-bold">{lead.name||lead.kundennr||'—'}</div>
                          <div className="text-muted small">Nr: {lead.kundennr||'—'}</div>
                        </td>
                        <td className="align-middle"><B2BBadge b={lead.isB2B}/></td>
                        <td className="align-middle">{lead.lastOrder||'—'}</td>
                        <td className="align-middle">{lead.ordersCount??'—'}</td>
                        <td className="align-middle">{fmtCurrency(lead.totalRevenueNetto||0)}</td>
                        <td className="align-middle">
                          <div><a className="text-info" href={`tel:${lead?.contact?.phone||''}`}><i className="bi bi-telephone mr-1"/>{lead?.contact?.phone||'—'}</a></div>
                          <div><a className="text-info" href={`mailto:${lead?.contact?.email||''}`}><i className="bi bi-envelope mr-1"/>{lead?.contact?.email||'—'}</a></div>
                        </td>
                        <td className="align-middle">
                          <div className="dropdown">
                            <button className="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-toggle="dropdown">{lead.status||'open'}</button>
                            <div className="dropdown-menu dropdown-menu-right">
                              {['open','called','qualified','discarded'].map(s => (
                                <a key={s} className="dropdown-item" href="#" onClick={(e)=>{e.preventDefault(); changeStatus(lead, s)}}>{s}</a>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="align-middle">
                          <button className="btn btn-outline-primary btn-sm" onClick={()=>{ setNoteFor(lead); setNoteText('') }}>
                            <i className="bi bi-chat-left-text mr-1"/>Notiz
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!leadsLoading && leads?.length===0 && (
                      <tr><td colSpan={9} className="text-center text-muted p-4">Kein Ergebnis für diese Filter</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="d-flex align-items-center justify-content-between p-2">
                <div className="text-muted small">{leadsTotal.toLocaleString('de-DE')} Einträge</div>
                <div className="d-flex align-items-center">
                  <button className="btn btn-sm btn-outline-secondary mr-2" disabled={pageF<=1} onClick={()=>setPageF(p=>Math.max(1,p-1))}>Zurück</button>
                  <div className="mr-2 small">Seite {pageF}</div>
                  <button className="btn btn-sm btn-outline-secondary mr-3" disabled={(pageF*limitF)>=leadsTotal} onClick={()=>setPageF(p=>p+1)}>Weiter</button>
                  <select className="form-control form-control-sm" style={{width:100}} value={limitF} onChange={e=>{ setLimitF(parseInt(e.target.value)); setPageF(1) }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notizen-History Sektion */}
          {leads.length > 0 && (
            <div className="card mt-3">
              <div className="card-header">
                <i className="bi bi-clock-history mr-2"/>Kontakt-History & Notizen
              </div>
              <div className="card-body">
                <p className="text-muted small mb-0">Notizen werden pro Kunde gespeichert. Klicken Sie auf "Notiz" bei einem Kunden um History zu sehen.</p>
              </div>
            </div>
          )}

          {/* Notiz Modal */}
          {noteFor && (
            <div className="modal d-block" tabIndex="-1" role="dialog" style={{background:'rgba(0,0,0,.5)'}}>
              <div className="modal-dialog modal-lg" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      <i className="bi bi-chat-left-text mr-2"/>Notiz für {noteFor?.name || noteFor?.kundennr}
                    </h5>
                    <button type="button" className="close" onClick={()=>setNoteFor(null)}><span>&times;</span></button>
                  </div>
                  <div className="modal-body">
                    {/* History anzeigen */}
                    {noteFor.notes && noteFor.notes.length > 0 && (
                      <div className="mb-3">
                        <h6 className="text-muted">Bisherige Notizen:</h6>
                        <div className="list-group mb-3">
                          {noteFor.notes.map((note, idx) => (
                            <div key={idx} className="list-group-item list-group-item-dark">
                              <div className="d-flex justify-content-between align-items-start">
                                <div className="flex-grow-1">
                                  <p className="mb-1">{note.text}</p>
                                  <small className="text-muted">{new Date(note.createdAt).toLocaleString('de-DE')}</small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <label className="font-weight-bold">Neue Notiz hinzufügen:</label>
                    <textarea className="form-control" rows={4} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Notiz eintragen (z.B. Telefonat, Meeting, Follow-up)..." />
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={()=>setNoteFor(null)}>Abbrechen</button>
                    <button className="btn btn-primary" onClick={saveNote}>
                      <i className="bi bi-save mr-1"/>Speichern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kaltakquise */}
      {activeTab==='kaltakquise' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h2 className="mb-1"><i className="bi bi-search mr-2"/>Kaltakquise-Tool</h2>
              <p className="text-muted small mb-0">B2B-Kundenakquise mit KI-gestützter Analyse</p>
            </div>
          </div>
          
          {/* Autopilot Control Panel */}
          <div className="card border-0 shadow-sm mb-4" style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="text-white mb-2">
                    <i className="bi bi-robot mr-2"/>
                    Autopilot System
                    {autopilotState.running && <span className="badge badge-success ml-2 animate-pulse">AKTIV</span>}
                    {!autopilotState.running && <span className="badge badge-secondary ml-2">INAKTIV</span>}
                  </h5>
                  <div className="text-white-50 small">
                    Automatische Suche, Analyse & Email-Versand (1 Email/Minute)
                  </div>
                  {autopilotState.running && (
                    <div className="mt-2">
                      <span className={`badge badge-${
                        autopilotState.currentPhase === 'searching' ? 'primary' :
                        autopilotState.currentPhase === 'analyzing' ? 'info' :
                        autopilotState.currentPhase === 'sending_email' ? 'success' :
                        autopilotState.currentPhase === 'error' ? 'danger' : 'secondary'
                      }`}>
                        {autopilotState.currentPhase === 'searching' && '🔍 Suche neue Firmen...'}
                        {autopilotState.currentPhase === 'analyzing' && '🧠 Analyse läuft...'}
                        {autopilotState.currentPhase === 'sending_email' && '📧 Sende Email...'}
                        {autopilotState.currentPhase === 'idle' && '⏸️ Bereit für nächste Email'}
                        {autopilotState.currentPhase === 'error' && '⚠️ Fehler aufgetreten'}
                        {!autopilotState.currentPhase && '⏳ Initialisiert...'}
                      </span>
                      {autopilotState.lastActivity && (
                        <span className="text-white-50 small ml-2">
                          • Letzte Aktivität: {new Date(autopilotState.lastActivity).toLocaleTimeString('de-DE')}
                        </span>
                      )}
                      <div className="text-white-50 small mt-1">
                        {autopilotState.dailyCount === 0 && autopilotState.currentPhase === 'idle' && '💡 Tipp: Autopilot arbeitet automatisch - 1 Email pro Minute'}
                        {autopilotState.dailyCount > 0 && `✉️ Heute versendet: ${autopilotState.dailyCount} von ${autopilotState.dailyLimit}`}
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center justify-content-end">
                    <div className="mr-3">
                      <div className="text-white small mb-1">Session-Limit</div>
                      <input 
                        type="number" 
                        className="form-control form-control-sm bg-white text-dark" 
                        style={{width:'100px', color: '#000 !important', backgroundColor: '#fff !important'}}
                        value={autopilotLimit}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value)
                          if (val === '' || (val >= 1 && val <= 500)) {
                            setAutopilotLimit(val === '' ? 1 : val)
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        min="1"
                        max="500"
                      />
                    </div>
                    <div className="mr-3 text-center">
                      <div className="text-white small mb-1">Session</div>
                      <div className="h5 text-white mb-0 font-weight-bold">
                        {autopilotState.dailyCount}/{autopilotState.dailyLimit}
                      </div>
                    </div>
                    <div>
                      {!autopilotState.running ? (
                        <button 
                          className="btn btn-success btn-lg"
                          onClick={startAutopilot}
                        >
                          <i className="bi bi-play-fill mr-1"/>Start
                        </button>
                      ) : (
                        <button 
                          className="btn btn-danger btn-lg"
                          onClick={stopAutopilot}
                        >
                          <i className="bi bi-stop-fill mr-1"/>Stop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistiken - kompakter und moderner */}
          <div className="row mb-4">
            <div className="col-md-3 mb-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-3">
                  <div className="h4 mb-1 font-weight-bold">{coldStats.total}</div>
                  <div className="text-muted small">Gesamt Firmen</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div className="card border-0 shadow-sm" style={{borderLeft:'3px solid #6c757d'}}>
                <div className="card-body text-center py-3">
                  <div className="h4 mb-1 font-weight-bold text-secondary">{coldStats.new}</div>
                  <div className="text-muted small">Neu gefunden</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div className="card border-0 shadow-sm" style={{borderLeft:'3px solid #17a2b8'}}>
                <div className="card-body text-center py-3">
                  <div className="h4 mb-1 font-weight-bold text-info">{coldStats.analyzed}</div>
                  <div className="text-muted small">Analysiert</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div className="card border-0 shadow-sm" style={{borderLeft:'3px solid #28a745'}}>
                <div className="card-body text-center py-3">
                  <div className="h4 mb-1 font-weight-bold text-success">{coldStats.contacted}</div>
                  <div className="text-muted small">Kontaktiert</div>
                </div>
              </div>
            </div>
          </div>

          {/* DACH Crawler - Direkt anzeigen (Google-Suche entfernt) */}
          {coldStatusFilter === 'all' && false && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <div className="d-flex align-items-center mb-3">
                  <i className="bi bi-search text-primary mr-2" style={{fontSize:'1.5rem'}}/>
                  <div>
                    <h5 className="mb-0">Neue Firmen finden</h5>
                    <small className="text-muted">Durchsuche das Web nach passenden B2B-Kunden</small>
                  </div>
                </div>
              <div className="row">
                <div className="col-md-4 mb-2">
                  <label className="small text-muted mb-1">Branche *</label>
                  <select 
                    className="form-control" 
                    value={coldSearchForm.industry}
                    onChange={e => setColdSearchForm({...coldSearchForm, industry: e.target.value})}
                  >
                    <option value="">-- Branche wählen --</option>
                    <optgroup label="🔩 Metallverarbeitung">
                      <option value="Metallbau">🔩 Metallbau</option>
                      <option value="Stahlbau">🏭 Stahlbau</option>
                      <option value="Edelstahlverarbeitung">✨ Edelstahlverarbeitung</option>
                      <option value="Maschinenbau">⚙️ Maschinenbau</option>
                      <option value="Anlagenbau">🏭 Anlagenbau</option>
                      <option value="Schlosserei">🔑 Schlosserei</option>
                      <option value="Schweißtechnik">🔥 Schweißtechnik</option>
                    </optgroup>
                    <optgroup label="🚗 Automotive">
                      <option value="Karosseriebau">🚗 Karosseriebau</option>
                      <option value="Automotive Zulieferer">🚙 Automotive Zulieferer</option>
                    </optgroup>
                    <optgroup label="🪵 Holzverarbeitung">
                      <option value="Schreinerei">🪵 Schreinerei</option>
                      <option value="Tischlerei">🪵 Tischlerei</option>
                      <option value="Möbelbau">🛋️ Möbelbau</option>
                      <option value="Holzbearbeitung">🌲 Holzbearbeitung</option>
                    </optgroup>
                    <optgroup label="✨ Oberflächenbearbeitung">
                      <option value="Lackiererei">🎨 Lackiererei</option>
                      <option value="Oberflächentechnik">✨ Oberflächentechnik</option>
                      <option value="Schleiferei">🔩 Schleiferei</option>
                      <option value="Poliererei">✨ Poliererei</option>
                    </optgroup>
                    <optgroup label="🏭 Fertigung">
                      <option value="Fertigungsbetrieb">🏭 Fertigungsbetrieb</option>
                      <option value="Industriebetrieb">🏭 Industriebetrieb</option>
                      <option value="Werkstatt">🔧 Werkstatt</option>
                    </optgroup>
                  </select>
                </div>
                <div className="col-md-4 mb-2">
                  <label className="small text-muted mb-1">Region *</label>
                  <select 
                    className="form-control" 
                    value={coldSearchForm.region}
                    onChange={e => setColdSearchForm({...coldSearchForm, region: e.target.value})}
                  >
                    <option value="">-- Region wählen --</option>
                    <optgroup label="📍 Bundesländer">
                      <option value="Baden-Württemberg">Baden-Württemberg</option>
                      <option value="Bayern">Bayern</option>
                      <option value="Berlin">Berlin</option>
                      <option value="Brandenburg">Brandenburg</option>
                      <option value="Bremen">Bremen</option>
                      <option value="Hamburg">Hamburg</option>
                      <option value="Hessen">Hessen</option>
                      <option value="Niedersachsen">Niedersachsen</option>
                      <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                      <option value="Rheinland-Pfalz">Rheinland-Pfalz</option>
                      <option value="Saarland">Saarland</option>
                      <option value="Sachsen">Sachsen</option>
                      <option value="Schleswig-Holstein">Schleswig-Holstein</option>
                      <option value="Thüringen">Thüringen</option>
                    </optgroup>
                    <optgroup label="🏛️ NRW - Top Städte">
                      <option value="Köln">Köln</option>
                      <option value="Düsseldorf">Düsseldorf</option>
                      <option value="Dortmund">Dortmund</option>
                      <option value="Essen">Essen</option>
                      <option value="Duisburg">Duisburg</option>
                      <option value="Bochum">Bochum</option>
                      <option value="Wuppertal">Wuppertal</option>
                      <option value="Bielefeld">Bielefeld</option>
                      <option value="Bonn">Bonn</option>
                      <option value="Münster">Münster</option>
                    </optgroup>
                    <optgroup label="🏛️ Bayern - Top Städte">
                      <option value="München">München</option>
                      <option value="Nürnberg">Nürnberg</option>
                      <option value="Augsburg">Augsburg</option>
                      <option value="Regensburg">Regensburg</option>
                      <option value="Ingolstadt">Ingolstadt</option>
                      <option value="Würzburg">Würzburg</option>
                      <option value="Fürth">Fürth</option>
                      <option value="Erlangen">Erlangen</option>
                      <option value="Bayreuth">Bayreuth</option>
                      <option value="Bamberg">Bamberg</option>
                    </optgroup>
                    <optgroup label="🏛️ BW - Top Städte">
                      <option value="Stuttgart">Stuttgart</option>
                      <option value="Mannheim">Mannheim</option>
                      <option value="Karlsruhe">Karlsruhe</option>
                      <option value="Freiburg">Freiburg</option>
                      <option value="Heidelberg">Heidelberg</option>
                      <option value="Ulm">Ulm</option>
                      <option value="Heilbronn">Heilbronn</option>
                      <option value="Pforzheim">Pforzheim</option>
                      <option value="Reutlingen">Reutlingen</option>
                      <option value="Esslingen">Esslingen</option>
                    </optgroup>
                    <optgroup label="🏛️ Weitere Top-Städte">
                      <option value="Frankfurt am Main">Frankfurt am Main</option>
                      <option value="Leipzig">Leipzig</option>
                      <option value="Dresden">Dresden</option>
                      <option value="Hannover">Hannover</option>
                      <option value="Bremen">Bremen</option>
                    </optgroup>
                  </select>
                </div>
                <div className="col-md-2 mb-2">
                  <label className="small text-muted mb-1">Anzahl</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="10" 
                    value={coldSearchForm.limit}
                    onChange={e => setColdSearchForm({...coldSearchForm, limit: parseInt(e.target.value) || 10})}
                    min="1"
                    max="50"
                  />
                </div>
                <div className="col-md-2 mb-2">
                  <label className="small text-muted mb-1">&nbsp;</label>
                  <button 
                    className="btn btn-primary btn-block" 
                    onClick={searchColdLeads}
                    disabled={coldLoading || !coldSearchForm.industry || !coldSearchForm.region}
                  >
                    {coldLoading ? <><span className="spinner-border spinner-border-sm mr-2"/>Suche...</> : <><i className="bi bi-search mr-1"/>Suchen</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* DACH Crawler - Optimiert & vereinfacht */}
          {coldStatusFilter === 'all' && (
            <div className="card border-0 shadow-lg mb-4" style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center">
                    <div className="bg-white rounded-circle p-3 mr-3 shadow">
                      <i className="bi bi-globe-europe-africa text-primary" style={{fontSize:'2rem'}}/>
                    </div>
                    <div>
                      <h4 className="mb-1 text-white font-weight-bold">DACH Firmen-Crawler</h4>
                      <p className="mb-0 text-white-50">Systematische B2B-Suche • 🇩🇪 Deutschland • 🇦🇹 Österreich • 🇨🇭 Schweiz</p>
                    </div>
                  </div>
                  <button 
                    className="btn btn-light btn-sm shadow-sm"
                    onClick={() => { loadDachStats(); loadDachProgress(); }}
                  >
                    <i className="bi bi-arrow-clockwise mr-1"/>Aktualisieren
                  </button>
                </div>

                {/* Statistiken - Verbessert */}
                {dachCrawlerStats && (
                  <div className="row mb-4">
                    <div className="col-md-3 mb-3">
                      <div className="card bg-white border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                          <div className="text-info mb-2"><i className="bi bi-list-task" style={{fontSize:'2rem'}}/></div>
                          <div className="h3 mb-1 font-weight-bold text-dark">{dachCrawlerStats.stats.total_crawl_jobs || 0}</div>
                          <div className="text-muted font-weight-semibold">Kombinationen</div>
                          <div className="progress mt-2" style={{height: '4px'}}>
                            <div className="progress-bar bg-info" style={{width: '100%'}}></div>
                          </div>
                          <small className="text-muted d-block mt-1">Region × Branche</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="card bg-white border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                          <div className="text-success mb-2"><i className="bi bi-check-circle-fill" style={{fontSize:'2rem'}}/></div>
                          <div className="h3 mb-1 font-weight-bold text-dark">{dachCrawlerStats.stats.completed_jobs || 0}</div>
                          <div className="text-muted font-weight-semibold">Abgeschlossen</div>
                          <div className="progress mt-2" style={{height: '4px'}}>
                            <div 
                              className="progress-bar bg-success" 
                              style={{width: `${dachCrawlerStats.stats.total_crawl_jobs > 0 ? Math.round((dachCrawlerStats.stats.completed_jobs / dachCrawlerStats.stats.total_crawl_jobs) * 100) : 0}%`}}
                            ></div>
                          </div>
                          <small className="text-muted d-block mt-1">
                            {dachCrawlerStats.stats.total_crawl_jobs > 0 
                              ? `${Math.round((dachCrawlerStats.stats.completed_jobs / dachCrawlerStats.stats.total_crawl_jobs) * 100)}% durchsucht`
                              : 'Starte ersten Crawl'
                            }
                          </small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="card bg-white border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                          <div className="text-warning mb-2"><i className="bi bi-building" style={{fontSize:'2rem'}}/></div>
                          <div className="h3 mb-1 font-weight-bold text-dark">{(dachCrawlerStats.stats.total_companies_found || 0).toLocaleString('de-DE')}</div>
                          <div className="text-muted font-weight-semibold">Firmen gefunden</div>
                          <div className="progress mt-2" style={{height: '4px'}}>
                            <div className="progress-bar bg-warning" style={{width: '100%'}}></div>
                          </div>
                          <small className="text-muted d-block mt-1">Alle Crawls</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="card bg-white border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                          <div className="text-primary mb-2"><i className="bi bi-database-fill" style={{fontSize:'2rem'}}/></div>
                          <div className="h3 mb-1 font-weight-bold text-dark">{(dachCrawlerStats.stats.dach_prospects_in_db || 0).toLocaleString('de-DE')}</div>
                          <div className="text-muted font-weight-semibold">In Datenbank</div>
                          <div className="progress mt-2" style={{height: '4px'}}>
                            <div className="progress-bar bg-primary" style={{width: '100%'}}></div>
                          </div>
                          <small className="text-muted d-block mt-1">Bereit für Kontakt</small>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Crawler Form */}
                <div className="row">
                  <div className="col-md-3 mb-2">
                    <label className="small text-white mb-1">Land *</label>
                    <select 
                      className="form-control" 
                      value={dachCrawlerForm.country}
                      onChange={e => setDachCrawlerForm({...dachCrawlerForm, country: e.target.value, region: ''})}
                    >
                      <option value="DE">🇩🇪 Deutschland</option>
                      <option value="AT">🇦🇹 Österreich</option>
                      <option value="CH">🇨🇭 Schweiz</option>
                    </select>
                  </div>

                  <div className="col-md-3 mb-2">
                    <label className="small text-white mb-1">Region/Bundesland *</label>
                    <select 
                      className="form-control" 
                      value={dachCrawlerForm.region}
                      onChange={e => setDachCrawlerForm({...dachCrawlerForm, region: e.target.value})}
                    >
                      <option value="">-- Wählen --</option>
                      {dachCrawlerForm.country === 'DE' && (
                        <>
                          <option value="Baden-Württemberg">Baden-Württemberg</option>
                          <option value="Bayern">Bayern</option>
                          <option value="Berlin">Berlin</option>
                          <option value="Brandenburg">Brandenburg</option>
                          <option value="Bremen">Bremen</option>
                          <option value="Hamburg">Hamburg</option>
                          <option value="Hessen">Hessen</option>
                          <option value="Mecklenburg-Vorpommern">Mecklenburg-Vorpommern</option>
                          <option value="Niedersachsen">Niedersachsen</option>
                          <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                          <option value="Rheinland-Pfalz">Rheinland-Pfalz</option>
                          <option value="Saarland">Saarland</option>
                          <option value="Sachsen">Sachsen</option>
                          <option value="Sachsen-Anhalt">Sachsen-Anhalt</option>
                          <option value="Schleswig-Holstein">Schleswig-Holstein</option>
                          <option value="Thüringen">Thüringen</option>
                        </>
                      )}
                      {dachCrawlerForm.country === 'AT' && (
                        <>
                          <option value="Burgenland">Burgenland</option>
                          <option value="Kärnten">Kärnten</option>
                          <option value="Niederösterreich">Niederösterreich</option>
                          <option value="Oberösterreich">Oberösterreich</option>
                          <option value="Salzburg">Salzburg</option>
                          <option value="Steiermark">Steiermark</option>
                          <option value="Tirol">Tirol</option>
                          <option value="Vorarlberg">Vorarlberg</option>
                          <option value="Wien">Wien</option>
                        </>
                      )}
                      {dachCrawlerForm.country === 'CH' && (
                        <>
                          <option value="Zürich">Zürich</option>
                          <option value="Bern">Bern</option>
                          <option value="Luzern">Luzern</option>
                          <option value="Uri">Uri</option>
                          <option value="Schwyz">Schwyz</option>
                          <option value="Obwalden">Obwalden</option>
                          <option value="Nidwalden">Nidwalden</option>
                          <option value="Glarus">Glarus</option>
                          <option value="Zug">Zug</option>
                          <option value="Freiburg">Freiburg</option>
                          <option value="Solothurn">Solothurn</option>
                          <option value="Basel-Stadt">Basel-Stadt</option>
                          <option value="Basel-Landschaft">Basel-Landschaft</option>
                          <option value="Schaffhausen">Schaffhausen</option>
                          <option value="Appenzell Ausserrhoden">Appenzell Ausserrhoden</option>
                          <option value="Appenzell Innerrhoden">Appenzell Innerrhoden</option>
                          <option value="St. Gallen">St. Gallen</option>
                          <option value="Graubünden">Graubünden</option>
                          <option value="Aargau">Aargau</option>
                          <option value="Thurgau">Thurgau</option>
                          <option value="Tessin">Tessin</option>
                          <option value="Waadt">Waadt</option>
                          <option value="Wallis">Wallis</option>
                          <option value="Neuenburg">Neuenburg</option>
                          <option value="Genf">Genf</option>
                          <option value="Jura">Jura</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="col-md-3 mb-2">
                    <label className="small text-white mb-1">Branche *</label>
                    <select 
                      className="form-control" 
                      value={dachCrawlerForm.industry}
                      onChange={e => setDachCrawlerForm({...dachCrawlerForm, industry: e.target.value})}
                    >
                      <option value="">-- Wählen --</option>
                      <optgroup label="🚗 Automobilindustrie & Fahrzeugbau">
                        <option value="Automobilindustrie">Automobilindustrie</option>
                        <option value="Karosseriebau">Karosseriebau</option>
                        <option value="KFZ-Werkstatt">KFZ-Werkstatt</option>
                      </optgroup>
                      <optgroup label="🔩 Metallverarbeitung & Stahlbau">
                        <option value="Metallverarbeitung">Metallverarbeitung</option>
                        <option value="Schlosserei">Schlosserei</option>
                        <option value="Stahlbau">Stahlbau</option>
                        <option value="Schweißtechnik">Schweißtechnik</option>
                      </optgroup>
                      <optgroup label="⚙️ Maschinen- und Apparatebau">
                        <option value="Maschinenbau">Maschinenbau</option>
                        <option value="Apparatebau">Apparatebau (Behälter/Rohrbau)</option>
                        <option value="Werkzeugbau">Werkzeugbau</option>
                      </optgroup>
                      <optgroup label="✈️ Luft- und Raumfahrt">
                        <option value="Luftfahrt">Luftfahrt (Flugzeugbau)</option>
                        <option value="Raumfahrt">Raumfahrt</option>
                      </optgroup>
                      <optgroup label="🚢 Schiff- und Bahnindustrie">
                        <option value="Schiffbau">Schiffbau</option>
                        <option value="Bahnindustrie">Bahnindustrie</option>
                      </optgroup>
                      <optgroup label="🪵 Holz- und Möbelindustrie">
                        <option value="Holzverarbeitung">Holzverarbeitung</option>
                        <option value="Schreinerei">Schreinerei/Tischlerei</option>
                        <option value="Möbelindustrie">Möbelindustrie</option>
                        <option value="Parkettverlegung">Parkettverlegung</option>
                      </optgroup>
                      <optgroup label="🔥 Gießereien und Schmieden">
                        <option value="Gießerei">Gießerei</option>
                        <option value="Schmiede">Schmiede</option>
                      </optgroup>
                      <optgroup label="🏗️ Maler- und Ausbauhandwerk">
                        <option value="Malerhandwerk">Malerhandwerk</option>
                        <option value="Trockenbau">Trockenbau</option>
                        <option value="Stuckateur">Stuckateur</option>
                      </optgroup>
                      <optgroup label="🎨 Oberflächentechnik">
                        <option value="Oberflächentechnik">Oberflächentechnik</option>
                        <option value="Lackiererei">Lackiererei</option>
                        <option value="Galvanik">Galvanik</option>
                      </optgroup>
                      <optgroup label="💎 Glas, Stein & Keramik">
                        <option value="Glasverarbeitung">Glasverarbeitung</option>
                        <option value="Steinmetz">Steinmetz</option>
                      </optgroup>
                      <optgroup label="🦷 Dental & Medizintechnik">
                        <option value="Dentallabor">Dentallabor</option>
                      </optgroup>
                      <optgroup label="💍 Schmuck & Gravur">
                        <option value="Schmuckherstellung">Schmuckherstellung</option>
                        <option value="Gravurbetrieb">Gravurbetrieb</option>
                      </optgroup>
                      <optgroup label="🔧 Kunststoff & Sonstige">
                        <option value="Kunststoffverarbeitung">Kunststoffverarbeitung</option>
                        <option value="Modellbau">Modellbau</option>
                        <option value="Messerschmiede">Messerschmiede</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="col-md-1 mb-2">
                    <label className="small text-white mb-1">Limit</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={dachCrawlerForm.limit}
                      onChange={e => setDachCrawlerForm({...dachCrawlerForm, limit: parseInt(e.target.value) || 20})}
                      min="5"
                      max="50"
                    />
                  </div>

                  <div className="col-md-2 mb-2">
                    <label className="small text-white mb-1">&nbsp;</label>
                    <button 
                      className="btn btn-light btn-block font-weight-bold" 
                      onClick={startDachCrawl}
                      disabled={dachCrawlerLoading || !dachCrawlerForm.region || !dachCrawlerForm.industry}
                    >
                      {dachCrawlerLoading ? <><span className="spinner-border spinner-border-sm mr-2"/>Crawle...</> : <><i className="bi bi-play-fill mr-1"/>Start Crawl</>}
                    </button>
                  </div>
                </div>

                {/* Progress Tabelle */}
                {dachCrawlerProgress.length > 0 && (
                  <div className="mt-4">
                    <h6 className="text-white mb-3"><i className="bi bi-list-task mr-2"/>Letzte Crawls</h6>
                    <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                      <table className="table table-sm table-dark">
                        <thead>
                          <tr>
                            <th>Land</th>
                            <th>Region</th>
                            <th>Branche</th>
                            <th>Status</th>
                            <th>Gefunden</th>
                            <th>Datum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dachCrawlerProgress.map((p, i) => (
                            <tr key={i}>
                              <td>{p.country === 'DE' ? '🇩🇪' : p.country === 'AT' ? '🇦🇹' : '🇨🇭'}</td>
                              <td>{p.region}</td>
                              <td>{p.industry}</td>
                              <td>
                                <span className={`badge badge-${p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'warning' : p.status === 'failed' ? 'danger' : 'secondary'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td>{p.companies_found}</td>
                              <td className="small">{p.last_updated ? new Date(p.last_updated).toLocaleString('de-DE') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Tabs - IMMER sichtbar */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap">
                <div className="d-flex align-items-center flex-wrap">
                  {/* Mail-Ansicht Tabs */}
                  <div className="btn-group btn-group-sm mr-3 mb-2">
                    <button className={`btn ${mailView==='prospects'?'btn-primary':'btn-outline-secondary'}`} onClick={()=>setMailView('prospects')}>
                      <i className="bi bi-people-fill mr-1"/>Prospects
                    </button>
                    <button className={`btn ${mailView==='inbox'?'btn-info':'btn-outline-info'}`} onClick={()=>setMailView('inbox')}>
                      <i className="bi bi-inbox-fill mr-1"/>Posteingang
                    </button>
                    <button className={`btn ${mailView==='outbox'?'btn-success':'btn-outline-success'}`} onClick={()=>setMailView('outbox')}>
                      <i className="bi bi-send-fill mr-1"/>Postausgang
                    </button>
                  </div>
                  
                  {/* Prospects Filter - nur bei Prospects-Ansicht */}
                  {mailView === 'prospects' && (
                    <>
                      <button 
                        className="btn btn-outline-warning btn-sm mr-2 mb-2"
                        onClick={sendFollowups}
                        disabled={coldLoading}
                      >
                        <i className="bi bi-arrow-repeat mr-1"/>Follow-ups
                      </button>
                      <div className="btn-group btn-group-sm mb-2">
                        <button className={`btn ${coldStatusFilter==='all'?'btn-primary':'btn-outline-secondary'}`} onClick={()=>{setColdStatusFilter('all'); setShowColdProspectDetails(null)}}>
                          <i className="bi bi-list mr-1"/>Alle ({coldStats.total})
                        </button>
                        <button className={`btn ${coldStatusFilter==='new'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>{setColdStatusFilter('new'); setShowColdProspectDetails(null)}}>
                          🆕 Neu ({coldStats.new})
                        </button>
                        <button className={`btn ${coldStatusFilter==='analyzed'?'btn-info':'btn-outline-secondary'}`} onClick={()=>{setColdStatusFilter('analyzed'); setShowColdProspectDetails(null)}}>
                          🔍 Analysiert ({coldStats.analyzed})
                        </button>
                        <button className={`btn ${coldStatusFilter==='no_email'?'btn-warning':'btn-outline-secondary'}`} onClick={()=>{setColdStatusFilter('no_email'); setShowColdProspectDetails(null)}}>
                          ⚠️ Keine E-Mail ({coldStats.no_email || 0})
                        </button>
                        <button className={`btn ${coldStatusFilter==='contacted'?'btn-success':'btn-outline-secondary'}`} onClick={()=>{setColdStatusFilter('contacted'); setShowColdProspectDetails(null)}}>
                          📧 Kontaktiert ({coldStats.contacted})
                        </button>
                        <button className={`btn ${coldStatusFilter==='replied'?'btn-warning':'btn-outline-warning'}`} onClick={()=>{setColdStatusFilter('replied'); setShowColdProspectDetails(null)}}>
                          <i className="bi bi-envelope-check mr-1"/>Antworten ({coldStats.replied || 0})
                          {coldLeadStats.unreadReplies > 0 && <span className="badge badge-danger ml-1">{coldLeadStats.unreadReplies}</span>}
                        </button>
                        <button className={`btn ${coldStatusFilter==='prompts'?'btn-dark':'btn-outline-dark'}`} onClick={()=>{setColdStatusFilter('prompts'); setShowColdProspectDetails(null)}}>
                          <i className="bi bi-gear mr-1"/>Mail Prompts
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {coldProspects.length > 0 && (
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-building text-primary mr-2"/>
                    <h6 className="mb-0">{coldProspects.length} Firmen</h6>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ergebnis-Tabelle - moderner */}
          {coldProspects.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom">
              </div>
              
              {/* PROSPECTS-ANSICHT */}
              {mailView === 'prospects' && (
              <div className="card-body p-0">
                {/* Bulk-Analyse Controls (nur bei "Neu" Tab) */}
                {coldStatusFilter === 'new' && coldProspects.filter(p => p.status === 'new').length > 0 && (
                  <div className="p-3 bg-dark border-bottom">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <input 
                          type="checkbox"
                          className="mr-2"
                          checked={selectedProspectsForBulk.length === coldProspects.filter(p => p.status === 'new').length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProspectsForBulk(coldProspects.filter(p => p.status === 'new').map(p => p.id))
                            } else {
                              setSelectedProspectsForBulk([])
                            }
                          }}
                        />
                        <span className="text-muted small">
                          {selectedProspectsForBulk.length > 0 
                            ? `${selectedProspectsForBulk.length} ausgewählt` 
                            : 'Alle auswählen'
                          }
                        </span>
                      </div>
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-info"
                          onClick={bulkAnalyzeProspects}
                          disabled={selectedProspectsForBulk.length === 0 || bulkAnalyzing}
                        >
                          {bulkAnalyzing ? (
                            <>
                              <span className="spinner-border spinner-border-sm mr-2"/>
                              Analysiere {bulkAnalyzeProgress.current}/{bulkAnalyzeProgress.total}...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-search mr-1"/>
                              Ausgewählte analysieren ({selectedProspectsForBulk.length})
                            </>
                          )}
                        </button>
                        <button 
                          className="btn btn-primary"
                          onClick={bulkAnalyzeAllNew}
                          disabled={bulkAnalyzing}
                        >
                          {bulkAnalyzing ? (
                            <>
                              <span className="spinner-border spinner-border-sm mr-2"/>
                              {bulkAnalyzeProgress.current}/{bulkAnalyzeProgress.total}
                            </>
                          ) : (
                            <>
                              <i className="bi bi-magic mr-1"/>
                              Alle Neu analysieren ({coldProspects.filter(p => p.status === 'new').length})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    {bulkAnalyzing && (
                      <div className="progress mt-2" style={{height: '6px'}}>
                        <div 
                          className="progress-bar progress-bar-striped progress-bar-animated bg-info" 
                          style={{width: `${(bulkAnalyzeProgress.current / bulkAnalyzeProgress.total) * 100}%`}}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="table-responsive" style={{maxHeight: '70vh', overflowY: 'auto', overflowX: 'auto'}}>
                  <table className="table table-hover mb-0">
                    <thead className="thead-light sticky-top">
                      <tr>
                        {coldStatusFilter === 'new' && (
                          <th className="border-0" style={{width: '40px'}}>
                            <input 
                              type="checkbox"
                              checked={selectedProspectsForBulk.length === coldProspects.filter(p => p.status === 'new').length && coldProspects.filter(p => p.status === 'new').length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProspectsForBulk(coldProspects.filter(p => p.status === 'new').map(p => p.id))
                                } else {
                                  setSelectedProspectsForBulk([])
                                }
                              }}
                            />
                          </th>
                        )}
                        <th className="border-0" style={{width: '180px'}}><i className="bi bi-building mr-1"/>Firma</th>
                        <th className="border-0" style={{width: '200px'}}><i className="bi bi-globe mr-1"/>Website</th>
                        <th className="border-0" style={{width: '120px'}}><i className="bi bi-briefcase mr-1"/>Branche</th>
                        <th className="border-0" style={{width: '100px'}}><i className="bi bi-geo-alt mr-1"/>Region</th>
                        <th className="border-0 text-center" style={{width: '80px'}}><i className="bi bi-star mr-1"/>Score</th>
                        <th className="border-0 text-center" style={{width: '110px'}}>Status</th>
                        {coldStatusFilter === 'contacted' && <th className="border-0 text-center" style={{width: '140px'}}><i className="bi bi-calendar mr-1"/>Gesendet am</th>}
                        <th className="border-0 text-right" style={{width: '150px'}}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coldProspects.map((p, i) => (
                        <>
                          <tr key={`row-${i}`} style={{cursor: p.status === 'analyzed' ? 'pointer' : 'default'}}>
                            {coldStatusFilter === 'new' && p.status === 'new' && (
                              <td className="align-middle">
                                <input 
                                  type="checkbox"
                                  checked={selectedProspectsForBulk.includes(p.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedProspectsForBulk([...selectedProspectsForBulk, p.id])
                                    } else {
                                      setSelectedProspectsForBulk(selectedProspectsForBulk.filter(id => id !== p.id))
                                    }
                                  }}
                                />
                              </td>
                            )}
                            <td className="align-middle">
                              <div className="text-white font-weight-bold text-truncate" style={{maxWidth:'170px'}} title={p.company_name}>
                                {p.company_name || 'Unbekannt'}
                              </div>
                            </td>
                            <td className="align-middle">
                              <a href={p.website} target="_blank" rel="noopener" className="text-info text-truncate d-inline-block small" style={{maxWidth:'190px'}} title={p.website}>
                                {(() => {
                                  try {
                                    // Extrahiere nur Hostname (ohne /impressum/, /kontakt/ etc.)
                                    const url = new URL(p.website.startsWith('http') ? p.website : 'https://' + p.website)
                                    return url.hostname.replace('www.', '')
                                  } catch (e) {
                                    // Fallback bei ungültiger URL
                                    return p.website.replace('https://','').replace('http://','').replace('www.','').split('/')[0]
                                  }
                                })()}
                              </a>
                            </td>
                            <td className="align-middle">
                              <span className="badge badge-light small">{p.industry}</span>
                            </td>
                            <td className="align-middle small text-white">{p.region}</td>
                            <td className="align-middle text-center">{p.score ? <span className={`badge badge-${p.score>=70?'success':p.score>=50?'info':'secondary'}`}>{p.score}/100</span> : <span className="text-muted">-</span>}</td>
                            <td className="align-middle text-center">
                              <select 
                                className={`form-control form-control-sm badge badge-${p.status==='new'?'secondary':p.status==='analyzed'?'info':p.status==='contacted'?'warning':p.status==='replied'?'success':p.status==='called'?'primary':p.status==='customer'?'success':'danger'}`}
                                style={{minWidth:120, border:'none', fontWeight:'bold'}}
                                value={p.status}
                                onChange={(e) => changeProspectStatus(p.id, e.target.value, p.status)}
                              >
                                <option value="new">🆕 Neu</option>
                                <option value="analyzed">🔍 Analysiert</option>
                                <option value="contacted">📧 Kontaktiert</option>
                                <option value="replied">💬 Antwort</option>
                                <option value="called">📞 Angerufen</option>
                                <option value="customer">🎯 Kunde</option>
                                <option value="discarded">❌ Verworfen</option>
                              </select>
                            </td>
                            {coldStatusFilter === 'contacted' && (
                              <td className="align-middle text-center small">
                                {p.followup_schedule?.mail_1_sent_at ? (
                                  <>
                                    <div className="text-success font-weight-bold">
                                      {new Date(p.followup_schedule.mail_1_sent_at).toLocaleDateString('de-DE')}
                                    </div>
                                    <div className="text-muted" style={{fontSize:'0.75rem'}}>
                                      {new Date(p.followup_schedule.mail_1_sent_at).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                    <div className="mt-1">
                                      {!p.followup_schedule.mail_2_sent && !p.followup_schedule.mail_3_sent && (
                                        <span className="badge badge-success badge-pill" title="Erstansprache versendet">Kontaktiert</span>
                                      )}
                                      {p.followup_schedule.mail_2_sent && !p.followup_schedule.mail_3_sent && (
                                        <span className="badge badge-info badge-pill" title="1x nachgefasst">1x nachgefasst</span>
                                      )}
                                      {p.followup_schedule.mail_3_sent && (
                                        <span className="badge badge-warning badge-pill" title="2x nachgefasst">2x nachgefasst</span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                            )}
                            <td className="align-middle text-right" style={{whiteSpace: 'nowrap'}}>
                              {p.status === 'new' && (
                                <div className="btn-group btn-group-sm">
                                  <button className="btn btn-primary" onClick={() => analyzeProspect(p)} disabled={coldLoading}>
                                    <i className="bi bi-search mr-1"/>Analysieren
                                  </button>
                                  <button 
                                    className="btn btn-danger" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (confirm(`${p.company_name} wirklich löschen?`)) deleteProspect(p.id)
                                    }} 
                                    disabled={coldLoading} 
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </div>
                              )}
                              {p.status === 'analyzed' && (
                                <div className="btn-group btn-group-sm">
                                  <button className="btn btn-outline-info" onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedProspect(selectedProspect?.website === p.website ? null : p) 
                                  }} disabled={coldLoading} title="Details anzeigen">
                                    <i className={`bi bi-chevron-${selectedProspect?.website === p.website ? 'up' : 'down'}`}/>
                                  </button>
                                  <button 
                                    className="btn btn-warning" 
                                    onClick={(e) => { e.stopPropagation(); analyzeProspect(p) }} 
                                    disabled={coldLoading} 
                                    title="Erneut analysieren"
                                  >
                                    <i className="bi bi-arrow-repeat"/>
                                  </button>
                                  {p.email_sequence && (
                                    <button 
                                      className="btn btn-success" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setShowEmailPreview(showEmailPreview?.website === p.website ? null : p)
                                      }} 
                                      disabled={coldLoading} 
                                      title="Email-Vorschau & Versand"
                                    >
                                      <i className={`bi bi-${showEmailPreview?.website === p.website ? 'x-circle' : 'envelope'}`}/>
                                    </button>
                                  )}
                                  <button 
                                    className="btn btn-danger" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (confirm(`${p.company_name} wirklich löschen?`)) deleteProspect(p.id)
                                    }} 
                                    disabled={coldLoading} 
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </div>
                              )}
                              {p.status === 'contacted' && (
                                <div className="btn-group btn-group-sm">
                                  <button className="btn btn-outline-info" onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedProspect(selectedProspect?.website === p.website ? null : p) 
                                  }} disabled={coldLoading} title="Details & Emails anzeigen">
                                    <i className={`bi bi-chevron-${selectedProspect?.website === p.website ? 'up' : 'down'}`}/>
                                  </button>
                                  <button 
                                    className="btn btn-danger" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (confirm(`${p.company_name} wirklich löschen?`)) deleteProspect(p.id)
                                    }} 
                                    disabled={coldLoading} 
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          
                          {/* Details Accordion */}
                          {selectedProspect?.website === p.website && (
                            <tr key={`details-${i}`}>
                              <td colSpan={coldStatusFilter === 'new' && p.status === 'new' ? 8 : coldStatusFilter === 'contacted' ? 8 : 7} className="p-0">
                                {(!p.analysis_v3 && !p.analysis) ? (
                                  <div className="bg-warning text-dark p-4">
                                    <div className="d-flex align-items-center justify-content-between">
                                      <div className="d-flex align-items-center">
                                        <i className="bi bi-exclamation-triangle mr-3" style={{fontSize:'2rem'}}/>
                                        <div>
                                          <h6 className="mb-1">Keine Analyse-Daten verfügbar</h6>
                                          <p className="mb-0 small">Die Analyse konnte nicht vollständig durchgeführt werden oder wurde noch nicht gespeichert.</p>
                                        </div>
                                      </div>
                                      <button className="btn btn-dark btn-sm" onClick={() => { setSelectedProspect(null); analyzeProspect(p) }} disabled={coldLoading}>
                                        <i className="bi bi-arrow-repeat mr-2"/>Jetzt analysieren
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                <div className="bg-dark border-top border-bottom p-4">
                                  {/* SCORE Deep Analysis Display - NEU */}
                                  {p.analysis && p.analysis.firmenprofil && (
                                    <div className="mb-4">
                                      <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="text-white mb-0">
                                          <i className="bi bi-gem text-primary mr-2"/>
                                          SCORE Firmen-Analyse
                                        </h5>
                                        <span className={`badge badge-lg badge-${p.analysis_quality >= 70 ? 'success' : p.analysis_quality >= 50 ? 'warning' : 'secondary'} px-3 py-2`} style={{fontSize: '1.1rem'}}>
                                          Qualität: {p.analysis_quality || 0}%
                                        </span>
                                      </div>
                                      
                                      {/* Firmenprofil */}
                                      <div className="alert alert-info mb-3">
                                        <strong><i className="bi bi-building mr-2"/>Firmenprofil:</strong> {p.analysis.firmenprofil}
                                      </div>
                                      
                                      <div className="row">
                                        {/* Werkstoffe */}
                                        {p.analysis.werkstoffe && p.analysis.werkstoffe.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-warning mb-3"><i className="bi bi-layers-fill mr-2"/>Werkstoffe</h6>
                                                {p.analysis.werkstoffe.map((w, idx) => (
                                                  <div key={idx} className="mb-2">
                                                    <span className="badge badge-warning">{w.name}</span>
                                                    <small className="text-white-50 ml-2">{w.kontext}</small>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Werkstücke */}
                                        {p.analysis.werkstücke && p.analysis.werkstücke.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-success mb-3"><i className="bi bi-box-seam mr-2"/>Werkstücke</h6>
                                                {p.analysis.werkstücke.map((w, idx) => (
                                                  <div key={idx} className="mb-2">
                                                    <span className="badge badge-success">{w.name}</span>
                                                    <small className="text-white-50 ml-2">{w.beschreibung}</small>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Kontaktpersonen */}
                                        {p.analysis.kontaktpersonen && p.analysis.kontaktpersonen.length > 0 && (
                                          <div className="col-md-12 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                  <h6 className="text-primary mb-0"><i className="bi bi-person-badge-fill mr-2"/>Kontaktpersonen ({p.analysis.kontaktpersonen.length})</h6>
                                                  <button 
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => generateEmail(p)}
                                                    disabled={coldLoading}
                                                  >
                                                    <i className="bi bi-envelope-plus-fill mr-1"/>E-Mail generieren
                                                  </button>
                                                </div>
                                                {p.analysis.kontaktpersonen.map((k, idx) => (
                                                  <div key={idx} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-dark rounded">
                                                    <div>
                                                      <strong className="text-white">{k.name}</strong>
                                                      <span className="badge badge-info ml-2">{k.position}</span>
                                                      <span className="badge badge-secondary ml-1">{k.bereich}</span>
                                                    </div>
                                                    <div>
                                                      {k.email && (
                                                        <>
                                                          <a href={`mailto:${k.email}`} className="btn btn-sm btn-outline-primary mr-2">
                                                            <i className="bi bi-envelope mr-1"/>{k.email}
                                                          </a>
                                                          <button 
                                                            className="btn btn-sm btn-success"
                                                            onClick={() => generateEmail(p, idx)}
                                                            disabled={coldLoading}
                                                            title="E-Mail für diese Person generieren"
                                                          >
                                                            <i className="bi bi-send-fill"/>
                                                          </button>
                                                        </>
                                                      )}
                                                      {k.telefon && (
                                                        <span className="text-white-50 ml-2"><i className="bi bi-telephone mr-1"/>{k.telefon}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Potenzielle Produkte */}
                                        {p.analysis.potenzielle_produkte && p.analysis.potenzielle_produkte.length > 0 && (
                                          <div className="col-md-12 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-success mb-3"><i className="bi bi-cart-check-fill mr-2"/>Empfohlene SCORE-Produkte ({p.analysis.potenzielle_produkte.length})</h6>
                                                {p.analysis.potenzielle_produkte.map((prod, idx) => (
                                                  <div key={idx} className="alert alert-success mb-2">
                                                    <div className="d-flex justify-content-between align-items-start">
                                                      <div>
                                                        <strong className="text-dark">{prod.kategorie}</strong>
                                                        <br/>
                                                        <small>
                                                          <span className="badge badge-warning mr-1">Werkstoff: {prod.für_werkstoff}</span>
                                                          <span className="badge badge-info">Anwendung: {prod.für_anwendung}</span>
                                                        </small>
                                                        <br/>
                                                        <small className="text-muted">{prod.begründung}</small>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Anwendungen */}
                                        {p.analysis.anwendungen && p.analysis.anwendungen.length > 0 && (
                                          <div className="col-md-12 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-info mb-3"><i className="bi bi-tools mr-2"/>Anwendungen</h6>
                                                <div className="d-flex flex-wrap">
                                                  {p.analysis.anwendungen.map((app, idx) => (
                                                    <span key={idx} className="badge badge-info mr-1 mb-1">{app}</span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* V3 Analysis Display */}
                                  {p.analysis_v3 && (
                                    <div className="mb-4">
                                      <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="text-white mb-0">
                                          <i className="bi bi-star-fill text-warning mr-2"/>
                                          Analyse-Ergebnis V3
                                        </h5>
                                        <span className={`badge badge-lg badge-${p.score >= 70 ? 'success' : p.score >= 50 ? 'info' : 'secondary'} px-3 py-2`} style={{fontSize: '1.1rem'}}>
                                          Score: {p.score}/100
                                        </span>
                                      </div>
                                      
                                      {/* Recommended Brands */}
                                      {p.analysis_v3.recommended_brands && p.analysis_v3.recommended_brands.length > 0 && (
                                        <div className="alert alert-info mb-3">
                                          <strong><i className="bi bi-award mr-2"/>Empfohlene Marken:</strong> {p.analysis_v3.recommended_brands.join(', ')}
                                        </div>
                                      )}
                                      
                                      <div className="row">
                                        {/* Applications */}
                                        {p.analysis_v3.applications && p.analysis_v3.applications.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-primary mb-3"><i className="bi bi-tools mr-2"/>Anwendungen ({p.analysis_v3.applications.length})</h6>
                                                <div className="d-flex flex-wrap">
                                                  {p.analysis_v3.applications.slice(0, 7).map((app, idx) => (
                                                    <span key={idx} className="badge badge-primary mr-1 mb-1" title={app.evidence}>
                                                      {app.term}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Materials */}
                                        {p.analysis_v3.materials && p.analysis_v3.materials.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-warning mb-3"><i className="bi bi-layers mr-2"/>Werkstoffe ({p.analysis_v3.materials.length})</h6>
                                                <div className="d-flex flex-wrap">
                                                  {p.analysis_v3.materials.slice(0, 6).map((mat, idx) => (
                                                    <span key={idx} className="badge badge-warning mr-1 mb-1" title={mat.evidence}>
                                                      {mat.term}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Machines */}
                                        {p.analysis_v3.machines && p.analysis_v3.machines.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-success mb-3"><i className="bi bi-gear mr-2"/>Maschinentypen ({p.analysis_v3.machines.length})</h6>
                                                <div className="d-flex flex-wrap">
                                                  {p.analysis_v3.machines.slice(0, 5).map((mach, idx) => (
                                                    <span key={idx} className="badge badge-success mr-1 mb-1" title={mach.evidence}>
                                                      {mach.term}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Product Categories */}
                                        {p.analysis_v3.product_categories && p.analysis_v3.product_categories.length > 0 && (
                                          <div className="col-md-6 mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body">
                                                <h6 className="text-info mb-3"><i className="bi bi-grid mr-2"/>Produkt-Kategorien ({p.analysis_v3.product_categories.length})</h6>
                                                <div className="d-flex flex-wrap">
                                                  {p.analysis_v3.product_categories.slice(0, 6).map((cat, idx) => (
                                                    <span key={idx} className="badge badge-info mr-1 mb-1" title={cat.evidence}>
                                                      {cat.term}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Contact Person */}
                                      {p.analysis_v3.contact_person && p.analysis_v3.contact_person.email && (
                                        <div className="card bg-secondary border-0 mt-3">
                                          <div className="card-body">
                                            <h6 className="text-warning mb-3"><i className="bi bi-person-fill mr-2"/>Ansprechpartner</h6>
                                            <div className="d-flex align-items-start">
                                              <div className="bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center mr-3" style={{width:50, height:50}}>
                                                <i className="bi bi-person-fill" style={{fontSize:'1.5rem'}}/>
                                              </div>
                                              <div>
                                                <h6 className="mb-1 text-white">{p.analysis_v3.contact_person.name}</h6>
                                                <p className="text-muted small mb-1">{p.analysis_v3.contact_person.role}</p>
                                                {p.analysis_v3.contact_person.email && (
                                                  <p className="mb-0 small text-white">
                                                    <i className="bi bi-envelope mr-1"/>
                                                    <a href={`mailto:${p.analysis_v3.contact_person.email}`} className="text-info">
                                                      {p.analysis_v3.contact_person.email}
                                                    </a>
                                                  </p>
                                                )}
                                                {p.analysis_v3.contact_person.phone && (
                                                  <p className="mb-0 small text-white mt-1">
                                                    <i className="bi bi-telephone mr-1"/>{p.analysis_v3.contact_person.phone}
                                                  </p>
                                                )}
                                                <div className="mt-2">
                                                  <span className="badge badge-secondary">
                                                    Konfidenz: {Math.round(p.analysis_v3.contact_person.confidence * 100)}%
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Notes */}
                                      {p.analysis_v3.notes && (
                                        <div className="alert alert-secondary mt-3 mb-0">
                                          <small><i className="bi bi-info-circle mr-2"/>{p.analysis_v3.notes}</small>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Email Preview */}
                                  {showEmailPreview?.website === p.website && p.email_sequence && (
                                    <div className="mt-4 border-top pt-4">
                                      <h5 className="text-white mb-3">
                                        <i className="bi bi-envelope-check mr-2"/>Email-Vorschau (3 Mails)
                                      </h5>
                                      
                                      {/* Mail 1 */}
                                      <div className="card bg-secondary border-success border-2 mb-3">
                                        <div className="card-header bg-success text-white">
                                          <strong>Mail 1 - Erstansprache</strong>
                                          <span className="badge badge-light ml-2">{p.email_sequence.mail_1.word_count} Wörter</span>
                                        </div>
                                        <div className="card-body">
                                          <div className="mb-2">
                                            <small className="text-muted">Betreff:</small>
                                            <div className="text-white font-weight-bold">{p.email_sequence.mail_1.subject}</div>
                                          </div>
                                          <div className="mb-2">
                                            <small className="text-muted">An:</small>
                                            <div className="text-info">{p.analysis_v3?.contact_person?.email || 'Nicht gefunden'}</div>
                                          </div>
                                          <div className="bg-dark p-3 rounded" style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem'}}>
                                            {p.email_sequence.mail_1.body}
                                          </div>
                                          <div className="mt-2">
                                            <button 
                                              className="btn btn-sm btn-success"
                                              onClick={async () => {
                                                if (!confirm('Mail 1 jetzt versenden?')) return
                                                try {
                                                  const res = await fetch('/api/coldleads/email-v3/send', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ prospect_id: p.id, mail_number: 1 })
                                                  })
                                                  const data = await res.json()
                                                  if (data.ok) {
                                                    alert('✅ Mail 1 versendet! Follow-up 1 in 5 Tagen geplant.')
                                                    await loadColdLeadStats()
                                                  } else {
                                                    alert('❌ Fehler: ' + data.error)
                                                  }
                                                } catch (e) {
                                                  alert('❌ Fehler: ' + e.message)
                                                }
                                              }}
                                            >
                                              <i className="bi bi-send mr-1"/>Jetzt versenden
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Mail 2 */}
                                      <div className="card bg-secondary border-warning border-2 mb-3">
                                        <div className="card-header bg-warning text-dark">
                                          <strong>Mail 2 - Follow-up 1 (nach 5 Tagen)</strong>
                                          <span className="badge badge-light ml-2">{p.email_sequence.mail_2.word_count} Wörter</span>
                                        </div>
                                        <div className="card-body">
                                          <div className="mb-2">
                                            <small className="text-muted">Betreff:</small>
                                            <div className="text-white font-weight-bold">{p.email_sequence.mail_2.subject}</div>
                                          </div>
                                          <div className="bg-dark p-3 rounded" style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem'}}>
                                            {p.email_sequence.mail_2.body}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Mail 3 */}
                                      <div className="card bg-secondary border-info border-2 mb-3">
                                        <div className="card-header bg-info text-white">
                                          <strong>Mail 3 - Follow-up 2 (nach 12 Tagen)</strong>
                                          <span className="badge badge-light ml-2">{p.email_sequence.mail_3.word_count} Wörter</span>
                                        </div>
                                        <div className="card-body">
                                          <div className="mb-2">
                                            <small className="text-muted">Betreff:</small>
                                            <div className="text-white font-weight-bold">{p.email_sequence.mail_3.subject}</div>
                                          </div>
                                          <div className="bg-dark p-3 rounded" style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem'}}>
                                            {p.email_sequence.mail_3.body}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* CRM Tags */}
                                      {p.email_sequence.crm_tags && p.email_sequence.crm_tags.length > 0 && (
                                        <div className="alert alert-info">
                                          <small><strong>CRM-Tags:</strong> {p.email_sequence.crm_tags.join(', ')}</small>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Alte Analysis Format - Mit Safe Guards */}
                                  {p.analysis && !p.analysis_v3 && p.analysis.company_info && (
                                    <div className="row">
                                      <div className="col-md-6 mb-3">
                                        <div className="p-3 bg-secondary rounded">
                                          <h6 className="text-primary mb-3"><i className="bi bi-info-circle mr-2"/>Firmen-Info (Old)</h6>
                                          <p className="text-white mb-3">{p.analysis.company_info.description || 'Keine Beschreibung'}</p>
                                          {p.analysis.company_info.products?.length > 0 && (
                                          <div>
                                            <strong className="text-muted small d-block mb-2">Produkte:</strong>
                                            <div className="d-flex flex-wrap">
                                              {p.analysis.company_info.products.map((prod, idx) => (
                                                <span key={idx} className="badge badge-light mr-1 mb-1">{prod}</span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="col-md-6 mb-3">
                                      <div className="p-3 bg-secondary rounded">
                                        <h6 className="text-success mb-3"><i className="bi bi-graph-up mr-2"/>Bedarfs-Assessment</h6>
                                        <div className="mb-3">
                                          <strong className="text-white mr-2">Score:</strong> 
                                          <span className={`badge badge-${p.score >= 70 ? 'success' : p.score >= 50 ? 'info' : 'secondary'} px-3 py-2`}>
                                            {p.score}/100
                                          </span>
                                        </div>
                                        <p className="text-white mb-3">{p.analysis.needs_assessment.reasoning}</p>
                                        {p.analysis.needs_assessment.potential_products?.length > 0 && (
                                          <div>
                                            <strong className="text-muted small d-block mb-2">Potenzielle Produkte:</strong>
                                            <div className="d-flex flex-wrap">
                                              {p.analysis.needs_assessment.potential_products.map((prod, idx) => {
                                                const displayText = typeof prod === 'string' 
                                                  ? prod 
                                                  : prod.name 
                                                    ? `${prod.name} (${prod.category || 'Allgemein'})`
                                                    : JSON.stringify(prod)
                                                return (
                                                  <span key={idx} className="badge badge-success mr-1 mb-1" title={prod.reason || ''}>
                                                    {displayText}
                                                  </span>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  )}
                                  
                                  {p.analysis && p.analysis.contact_persons?.length > 0 && (
                                    <div className="mt-3">
                                      <h6 className="text-warning mb-3"><i className="bi bi-people-fill mr-2"/>Ansprechpartner (Old)</h6>
                                      <div className="row">
                                        {p.analysis.contact_persons.map((c, idx) => (
                                          <div key={idx} className="col-md-6 mb-2">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body p-3">
                                                <div className="d-flex align-items-start">
                                                  <div className="bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center mr-3" style={{width:40, height:40}}>
                                                    <i className="bi bi-person-fill"/>
                                                  </div>
                                                  <div>
                                                    <h6 className="mb-1 text-white">{c.name}</h6>
                                                    <p className="text-muted small mb-1">{c.title}</p>
                                                    {c.email && <p className="mb-0 small text-white"><i className="bi bi-envelope mr-1"/>{c.email}</p>}
                                                    {c.phone && <p className="mb-0 small text-white"><i className="bi bi-telephone mr-1"/>{c.phone}</p>}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                            {/* Kontakt-Historie */}
                              {p.history && p.history.length > 0 && (
                                    <div className="mt-3">
                                      <h6 className="text-info mb-3"><i className="bi bi-clock-history mr-2"/>Kontakt-Historie</h6>
                                      <div className="timeline">
                                        {p.history.map((h, idx) => (
                                          <div key={idx} className="timeline-item mb-3">
                                            <div className="card bg-secondary border-0">
                                              <div className="card-body p-3">
                                                <div className="d-flex align-items-start">
                                                  <div className={`${h.type === 'email_sent' ? 'bg-success' : 'bg-warning'} text-white rounded-circle d-flex align-items-center justify-content-center mr-3`} style={{width:40, height:40, minWidth:40}}>
                                                    <i className={`bi bi-${h.type === 'email_sent' ? 'send-fill' : 'reply-fill'}`}/>
                                                  </div>
                                                  <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                      <h6 className="mb-0 text-white">
                                                        {h.type === 'email_sent' ? '📧 Email versendet' : '💬 Antwort erhalten'}
                                                      </h6>
                                                      <span className="badge badge-light small">{new Date(h.date).toLocaleString('de-DE')}</span>
                                                    </div>
                                                    {h.to && <p className="text-muted small mb-1"><strong>An:</strong> {h.to}</p>}
                                                    {h.from && <p className="text-muted small mb-1"><strong>Von:</strong> {h.from}</p>}
                                                    {h.subject && <p className="text-white small mb-1"><strong>Betreff:</strong> {h.subject}</p>}
                                                    {h.body && <p className="text-muted small mb-0" style={{whiteSpace:'pre-wrap'}}>{h.body.substring(0, 200)}{h.body.length > 200 ? '...' : ''}</p>}
                                                    {h.text && <p className="text-muted small mb-0" style={{whiteSpace:'pre-wrap'}}>{h.text.substring(0, 200)}{h.text.length > 200 ? '...' : ''}</p>}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                )}
                              </td>
                            </tr>
                          )}
                          
                          {/* Email Accordion */}
                          {generatedEmail?.website === p.website && (
                            <tr key={`email-${i}`}>
                              <td colSpan="7" className="p-0">
                                <div className="bg-gradient-primary text-white p-4">
                                  <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div className="d-flex align-items-center">
                                      <i className="bi bi-envelope-fill mr-2" style={{fontSize:'1.5rem'}}/>
                                      <h5 className="mb-0">Generierte Email</h5>
                                    </div>
                                  </div>
                                  <div className="alert alert-light mb-3">
                                    <strong>Empfänger:</strong> {generatedEmail.recipient}
                                  </div>
                                  <div className="mb-3">
                                    <label className="font-weight-bold small mb-2">BETREFF:</label>
                                    <input 
                                      type="text" 
                                      className="form-control" 
                                      value={generatedEmail.subject} 
                                      onChange={(e)=>setGeneratedEmail({...generatedEmail, subject: e.target.value})}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="font-weight-bold small mb-2">NACHRICHT:</label>
                                    <textarea 
                                      className="form-control" 
                                      rows="15" 
                                      value={generatedEmail.body}
                                      onChange={(e)=>setGeneratedEmail({...generatedEmail, body: e.target.value})}
                                      style={{fontFamily:'monospace', fontSize:'0.9rem'}}
                                    />
                                  </div>
                                  <div className="d-flex justify-content-end">
                                    <button className="btn btn-success btn-lg" onClick={sendColdEmail} disabled={coldLoading}>
                                      {coldLoading ? (
                                        <>
                                          <span className="spinner-border spinner-border-sm mr-2"></span>
                                          Wird versendet...
                                        </>
                                      ) : (
                                        <>
                                          <i className="bi bi-send-fill mr-2"></i>
                                          Jetzt versenden
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              {/* POSTAUSGANG-ANSICHT */}
              {mailView === 'outbox' && (
              <>
                <div className="p-3 bg-success text-white d-flex align-items-center justify-content-between border-bottom">
                <h5 className="mb-0"><i className="bi bi-send-fill mr-2"/>Email-Postausgang</h5>
                <div>
                  <button className="btn btn-sm btn-light mr-2" onClick={loadOutbox} disabled={outboxLoading}>
                    <i className="bi bi-arrow-repeat mr-1"/>{outboxLoading ? 'Lädt...' : 'Aktualisieren'}
                  </button>
                  <button className="btn btn-sm btn-outline-light" onClick={()=>setShowOutbox(false)}>
                    <i className="bi bi-x-lg"/>
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                {outboxLoading ? (
                  <div className="p-5 text-center">
                    <div className="spinner-border text-success" role="status">
                      <span className="sr-only">Loading...</span>
                    </div>
                  </div>
                ) : outboxEmails.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    <i className="bi bi-inbox display-4 d-block mb-3"/>
                    <p>Keine gesendeten Mails</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th style={{width: '140px'}}>DATUM</th>
                          <th style={{width: '220px'}}>FIRMA</th>
                          <th style={{width: '220px'}}>EMPFÄNGER</th>
                          <th>BETREFF</th>
                          <th style={{width: '120px'}} className="text-center">TYP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outboxEmails.map((email, i) => (
                          <>
                            <tr 
                              key={email.id || i} 
                              onClick={() => setSelectedOutboxEmail(selectedOutboxEmail?.id === email.id ? null : email)}
                              style={{cursor: 'pointer'}}
                              className={selectedOutboxEmail?.id === email.id ? 'table-active' : ''}
                            >
                              <td>
                                <div className="font-weight-bold">{new Date(email.sent_at).toLocaleDateString('de-DE')}</div>
                                <small className="text-muted">{new Date(email.sent_at).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</small>
                              </td>
                              <td className="font-weight-bold">{email.company_name}</td>
                              <td>
                                <a href={`mailto:${email.recipient}`} className="text-primary" onClick={(e) => e.stopPropagation()}>
                                  {email.recipient}
                                </a>
                              </td>
                              <td>{email.subject}</td>
                              <td className="text-center">
                                <span className={`badge badge-${email.mail_number === 1 ? 'success' : email.mail_number === 2 ? 'info' : 'warning'}`}>
                                  {email.mail_type}
                                </span>
                              </td>
                            </tr>
                            {selectedOutboxEmail?.id === email.id && (
                              <tr key={`${email.id}-detail`}>
                                <td colSpan="5" className="p-0">
                                  <div className="bg-light p-4 border-top">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                      <div>
                                        <h6 className="mb-1"><i className="bi bi-envelope-fill mr-2 text-success"/>Email-Inhalt</h6>
                                        <small className="text-muted">
                                          Gesendet am {new Date(email.sent_at).toLocaleString('de-DE')} an {email.recipient}
                                        </small>
                                      </div>
                                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedOutboxEmail(null)}>
                                        <i className="bi bi-x-lg"/>
                                      </button>
                                    </div>
                                    <div className="card">
                                      <div className="card-header bg-white">
                                        <strong>Betreff:</strong> {email.subject}
                                      </div>
                                      <div className="card-body" style={{maxHeight: '400px', overflowY: 'auto'}}>
                                        <div dangerouslySetInnerHTML={{ __html: email.body?.replace(/\n/g, '<br>') || 'Email-Inhalt nicht verfügbar' }} />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card-footer bg-transparent">
                <div className="d-flex align-items-center justify-content-between">
                  <small className="text-muted">
                    <i className="bi bi-info-circle mr-1"/>Von: <strong>daniel@score-schleifwerkzeuge.de</strong> | BCC: leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de
                  </small>
                  <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowOutbox(false)}>
                    Schließen
                  </button>
                </div>
              </div>
              </>
              )}
            </div>
          )}
          
          {/* MAIL PROMPTS VIEW - AUSSERHALB der coldProspects.length Bedingung */}
          {mailView === 'prospects' && coldStatusFilter === 'prompts' && (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <MailPromptsView />
              </div>
            </div>
          )}

          {/* EMAIL POSTEINGANG */}
          {false && showInbox && (
            <div className="card mb-4">
              <div className="card-header bg-transparent d-flex align-items-center justify-content-between">
                <h5 className="mb-0"><i className="bi bi-inbox-fill mr-2"/>Email-Posteingang</h5>
                <div>
                  <button className="btn btn-sm btn-info mr-2" onClick={loadInbox} disabled={inboxLoading}>
                    <i className="bi bi-arrow-repeat mr-1"/>{inboxLoading ? 'Lädt...' : 'Aktualisieren'}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={()=>setShowInbox(false)}>
                    <i className="bi bi-x-lg"/>
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                {inboxLoading ? (
                  <div className="p-5 text-center">
                    <div className="spinner-border text-info" role="status">
                      <span className="sr-only">Loading...</span>
                    </div>
                  </div>
                ) : inboxEmails.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    <i className="bi bi-inbox" style={{fontSize:'3rem', opacity:0.3}}/>
                    <p className="mt-3">Keine Emails im Posteingang</p>
                    <button className="btn btn-sm btn-info" onClick={loadInbox}>
                      Jetzt laden
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th><i className="bi bi-person mr-1"/>Von</th>
                          <th><i className="bi bi-envelope mr-1"/>Betreff</th>
                          <th><i className="bi bi-calendar mr-1"/>Datum</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboxEmails.map((email, i) => (
                          <tr key={i} style={{cursor:'pointer'}}>
                            <td className="font-weight-bold">{email.from || 'Unbekannt'}</td>
                            <td>
                              <div className={email.seen ? 'text-muted' : 'font-weight-bold'}>
                                {email.subject || '(Kein Betreff)'}
                              </div>
                              {email.text && (
                                <div className="small text-muted text-truncate" style={{maxWidth:400}}>
                                  {email.text.substring(0, 100)}...
                                </div>
                              )}
                            </td>
                            <td className="text-muted small">{email.date ? new Date(email.date).toLocaleString('de-DE') : '-'}</td>
                            <td className="text-center">
                              {email.seen ? (
                                <span className="badge badge-secondary">Gelesen</span>
                              ) : (
                                <span className="badge badge-primary">Neu</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alte Ansichten entfernt - jetzt als Accordions in Tabelle */}
          {false && selectedProspect && selectedProspect.analysis && (
            <div className="card border-0 shadow-lg mt-4">
              <div className="card-header bg-gradient-info text-white d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="bi bi-building-fill mr-2" style={{fontSize:'1.5rem'}}/>
                  <div>
                    <h5 className="mb-0">{selectedProspect.company_name}</h5>
                    <small>{selectedProspect.website}</small>
                  </div>
                </div>
                <button className="btn btn-sm btn-outline-light" onClick={() => setSelectedProspect(null)}>
                  <i className="bi bi-x-lg"/>
                </button>
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded h-100">
                      <h6 className="text-primary mb-3"><i className="bi bi-info-circle mr-2"/>Firmen-Info</h6>
                      <p className="mb-3">{selectedProspect.analysis.company_info.description}</p>
                      {selectedProspect.analysis.company_info.products?.length > 0 && (
                        <div>
                          <strong className="text-muted small d-block mb-2">Produkte & Dienstleistungen:</strong>
                          <div className="d-flex flex-wrap">
                            {selectedProspect.analysis.company_info.products.map((p, i) => (
                              <span key={i} className="badge badge-secondary mr-1 mb-1">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded h-100">
                      <h6 className="text-success mb-3"><i className="bi bi-graph-up mr-2"/>Bedarfs-Assessment</h6>
                      <div className="mb-3 d-flex align-items-center">
                        <strong className="mr-2">Score:</strong> 
                        <span className={`badge badge-${selectedProspect.score >= 70 ? 'success' : selectedProspect.score >= 50 ? 'info' : 'secondary'} px-3 py-2`} style={{fontSize:'1rem'}}>
                          {selectedProspect.score}/100
                        </span>
                      </div>
                      <p className="mb-3">{selectedProspect.analysis.needs_assessment.reasoning}</p>
                      {selectedProspect.analysis.needs_assessment.potential_products?.length > 0 && (
                        <div>
                          <strong className="text-muted small d-block mb-2">Potenzielle SCORE-Produkte:</strong>
                          <div className="d-flex flex-wrap">
                            {selectedProspect.analysis.needs_assessment.potential_products.map((p, i) => {
                              const displayText = typeof p === 'string' 
                                ? p 
                                : p.name 
                                  ? `${p.name} (${p.category || 'Allgemein'})`
                                  : JSON.stringify(p)
                              return (
                                <span key={i} className="badge badge-success mr-1 mb-1" title={p.reason || ''}>
                                  {displayText}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProspect.analysis.contact_persons?.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-warning mb-3"><i className="bi bi-people-fill mr-2"/>Ansprechpartner</h6>
                    <div className="row">
                      {selectedProspect.analysis.contact_persons.map((c, i) => (
                        <div key={i} className="col-md-6 mb-3">
                          <div className="card border-0 bg-light">
                            <div className="card-body">
                              <div className="d-flex align-items-start">
                                <div className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center mr-3" style={{width:50, height:50, fontSize:'1.5rem'}}>
                                  <i className="bi bi-person-fill"/>
                                </div>
                                <div>
                                  <h6 className="mb-1">{c.name}</h6>
                                  <p className="text-muted small mb-1">{c.title}</p>
                                  {c.email && <p className="mb-0 small"><i className="bi bi-envelope mr-1"/>{c.email}</p>}
                                  {c.phone && <p className="mb-0 small"><i className="bi bi-telephone mr-1"/>{c.phone}</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-end pt-3 border-top">
                  <button className="btn btn-success btn-lg" onClick={() => { setSelectedProspect(null); generateColdEmail(selectedProspect) }}>
                    <i className="bi bi-envelope-fill mr-2"/>Email generieren
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email-Vorschau als Accordion in Tabelle */}
          {false && generatedEmail && (
            <div className="card border-0 shadow-lg mt-4">
              <div className="card-header bg-gradient-primary text-white d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="bi bi-envelope-fill mr-2" style={{fontSize:'1.5rem'}}/>
                  <div>
                    <h5 className="mb-0">Generierte Email</h5>
                    <small>Bereit zum Versenden</small>
                  </div>
                </div>
                <button className="btn btn-sm btn-outline-light" onClick={() => setGeneratedEmail(null)}>
                  <i className="bi bi-x-lg"/>
                </button>
              </div>
              <div className="card-body">
                <div className="alert alert-info d-flex align-items-center mb-3">
                  <i className="bi bi-person-circle mr-2" style={{fontSize:'1.5rem'}}/>
                  <div>
                    <strong>Empfänger:</strong> {generatedEmail.recipient}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="font-weight-bold text-muted small mb-2">BETREFF:</label>
                  <div className="p-3 bg-light rounded border">
                    <strong>{generatedEmail.subject}</strong>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="font-weight-bold text-muted small mb-2">NACHRICHT:</label>
                  <div className="p-3 bg-white rounded border" style={{whiteSpace:'pre-wrap', fontFamily:'system-ui', lineHeight:'1.8'}}>
                    {generatedEmail.body}
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <button className="btn btn-outline-secondary" onClick={() => setGeneratedEmail(null)}>
                    <i className="bi bi-x-circle mr-1"/>Abbrechen
                  </button>
                  <button className="btn btn-success btn-lg" onClick={sendColdEmail} disabled={coldLoading}>
                    {coldLoading ? <><span className="spinner-border spinner-border-sm mr-2"/>Wird versendet...</> : <><i className="bi bi-send-fill mr-2"/>Jetzt versenden</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab!=='dashboard' && activeTab!=='outbound' && activeTab!=='sales' && activeTab!=='marketing' && activeTab!=='akquise' && (
        <div className="text-muted">Dieser Bereich ist für die nächste Iteration vorgesehen.</div>
      )}

      {/* Toast */}
      {toast && (
        <div className="alert alert-info position-fixed" style={{right:12, bottom:12, zIndex:1060}} onClick={()=>setToast('')}>{toast}</div>
      )}

      {/* Request Inspector - nur bei Dashboard/Sales/Marketing */}
      {(activeTab === 'dashboard' || activeTab === 'sales' || activeTab === 'marketing') && (
        <div className="position-fixed d-none d-lg-block" style={{right:12, bottom:54, zIndex:1059, width:340}}>
          <div className="card border-0 shadow-sm" style={{opacity:.96}}>
            <div className="card-header bg-dark text-white py-2 px-3 d-flex justify-content-between align-items-center border-0">
              <div className="d-flex align-items-center">
                <i className="bi bi-activity mr-2"/>
                <span className="small font-weight-bold">API Monitor</span>
              </div>
              <span className="badge badge-light">{netlog?.[0]?.ms? `${netlog[0].ms} ms` : ''}</span>
            </div>
            <div className="card-body p-2" style={{maxHeight:180, overflowY:'auto', fontSize:'0.8rem'}}>
              {(netlog||[]).map((r,i)=> (
                <div key={i} className="mb-2 p-2 rounded" style={{backgroundColor: r.ok?'rgba(40,167,69,0.1)':'rgba(220,53,69,0.1)'}}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted">{r.at||''}</span>
                    <span className={`badge badge-${r.ok?'success':'danger'}`}>{r.ok? '✓':'✗'} {r.status}</span>
                  </div>
                  <div className="text-truncate" style={{fontSize:'0.75rem'}} title={r.url}>{r.url}</div>
                  {r.error && <div className="text-danger mt-1" style={{fontSize:'0.7rem'}}>{String(r.error).slice(0,80)}...</div>}
                </div>
              ))}
              {netlog?.length===0 && <div className="text-center text-muted py-3"><i className="bi bi-hourglass-split mr-2"/>Warte auf Requests...</div>}
            </div>
          </div>
        </div>
      )}

      {/* Preise (Preisberechnung) */}
      {activeTab==='preise' && (
        <PreiseModule />
      )}

      {/* FIBU Modul */}
      {activeTab==='fibu' && (
        <FibuModule />
      )}

      {/* Produkte (Artikel-Import & Browser) */}
      {activeTab==='produkte' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h2 className="mb-1"><i className="bi bi-box-seam mr-2"/>Produkte</h2>
              <p className="text-muted small mb-0">Artikel aus JTL-Wawi importieren & verwalten</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="btn-group mb-4 w-100">
            <button 
              className={`btn ${produkteTab === 'import' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => { setProdukteTab('import'); loadArtikelStatus(); }}
            >
              <i className="bi bi-download mr-2"/>Import
            </button>
            <button 
              className={`btn ${produkteTab === 'browser' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => { setProdukteTab('browser'); }}
            >
              <i className="bi bi-grid mr-2"/>Artikel-Browser
            </button>
            <button 
              className={`btn ${produkteTab === 'prompts' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => { setProdukteTab('prompts'); loadAmazonPrompts(); }}
            >
              <i className="bi bi-chat-left-text mr-2"/>Prompts
            </button>
          </div>

          {/* Import Tab */}
          {produkteTab === 'import' && (
            <div>
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <h5 className="mb-3"><i className="bi bi-database mr-2"/>Artikel-Import aus JTL-Wawi</h5>
                  
                  {/* Status-Übersicht */}
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <div className="card bg-light">
                        <div className="card-body text-center py-3">
                          <div className="h3 mb-1 text-primary font-weight-bold">166.854</div>
                          <div className="text-muted small">Gesamt importierbar</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-light">
                        <div className="card-body text-center py-3">
                          <div className="h3 mb-1 text-success font-weight-bold">{artikelImportProgress.imported.toLocaleString()}</div>
                          <div className="text-muted small">Bereits importiert</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-light">
                        <div className="card-body text-center py-3">
                          <div className="h3 mb-1 text-info font-weight-bold">
                            {((artikelImportProgress.imported / artikelImportProgress.total) * 100).toFixed(1)}%
                          </div>
                          <div className="text-muted small">Fortschritt</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-light">
                        <div className="card-body text-center py-3">
                          <div className="h3 mb-1 text-warning font-weight-bold">
                            {(166854 - artikelImportProgress.imported).toLocaleString()}
                          </div>
                          <div className="text-muted small">Noch zu importieren</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {artikelImportRunning && (
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted small">Import läuft...</span>
                        <span className="small font-weight-bold">
                          {artikelImportProgress.imported.toLocaleString()} / {artikelImportProgress.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="progress" style={{height: '25px'}}>
                        <div 
                          className="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                          style={{width: `${(artikelImportProgress.imported / artikelImportProgress.total) * 100}%`}}
                        >
                          {((artikelImportProgress.imported / artikelImportProgress.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Info */}
                  <div className="alert alert-info">
                    <h6 className="alert-heading"><i className="bi bi-info-circle mr-2"/>Was wird importiert?</h6>
                    <ul className="mb-0 small">
                      <li><strong>Basis-Daten:</strong> Artikelnummer, Name, Beschreibung, Barcode</li>
                      <li><strong>Preise & Marge:</strong> VK Netto, EK Netto, UVP, berechnete Marge</li>
                      <li><strong>Zuordnungen:</strong> Hersteller (mit Name), Warengruppe (mit Name)</li>
                      <li><strong>Lagerbestand:</strong> Aktueller Bestand, Mindestbestellmenge</li>
                      <li><strong>Filter:</strong> Nur aktive Artikel, keine Stücklisten, keine Varianten-Kinder</li>
                    </ul>
                  </div>

                  {/* Import Button */}
                  <div className="text-center">
                    <button 
                      className="btn btn-lg btn-success px-5"
                      onClick={startArtikelImport}
                      disabled={artikelImportRunning}
                    >
                      {artikelImportRunning ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2"/>
                          Import läuft... ({((artikelImportProgress.imported / artikelImportProgress.total) * 100).toFixed(0)}%)
                        </>
                      ) : (
                        <>
                          <i className="bi bi-download mr-2"/>
                          Artikel-Import starten
                        </>
                      )}
                    </button>
                    <p className="text-muted small mt-2 mb-0">
                      <i className="bi bi-clock mr-1"/>Geschätzte Dauer: 5-10 Minuten
                    </p>
                  </div>

                  {/* Verwaiste Artikel Check */}
                  {!artikelImportRunning && artikelImportProgress.imported > 0 && (
                    <div className="mt-4">
                      <hr/>
                      <div className="alert alert-warning">
                        <h6 className="alert-heading"><i className="bi bi-exclamation-triangle mr-2"/>Datenbank-Wartung</h6>
                        <p className="mb-2">Nach einem Import können Artikel in der Datenbank sein, die nicht mehr in JTL-Wawi existieren.</p>
                        <p className="mb-3 small">
                          <strong>Hinweis:</strong> Der Import aktualisiert nur bestehende Artikel und fügt neue hinzu. 
                          Gelöschte Artikel bleiben in der Datenbank erhalten, um angereicherte Daten nicht zu verlieren.
                        </p>
                        <button 
                          className="btn btn-warning btn-sm"
                          onClick={checkOrphanedArticles}
                          disabled={checkingOrphans}
                        >
                          {checkingOrphans ? (
                            <><span className="spinner-border spinner-border-sm mr-2"/>Prüfe...</>
                          ) : (
                            <><i className="bi bi-search mr-2"/>Verwaiste Artikel prüfen</>
                          )}
                        </button>
                      </div>

                      {/* Liste verwaister Artikel */}
                      {orphanedArticles.length > 0 && (
                        <div className="card border-danger mt-3">
                          <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
                            <span><i className="bi bi-exclamation-circle mr-2"/>{orphanedArticles.length} Verwaiste Artikel gefunden</span>
                            <button 
                              className="btn btn-sm btn-light"
                              onClick={deleteOrphanedArticles}
                            >
                              <i className="bi bi-trash mr-1"/>Alle löschen
                            </button>
                          </div>
                          <div className="card-body p-0">
                            <div className="table-responsive" style={{maxHeight: '300px'}}>
                              <table className="table table-sm table-hover mb-0">
                                <thead className="thead-light">
                                  <tr>
                                    <th>Artikel-Nr</th>
                                    <th>Name</th>
                                    <th>kArtikel</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orphanedArticles.map((art, idx) => (
                                    <tr key={idx}>
                                      <td><code>{art.cArtNr}</code></td>
                                      <td>{art.cName || '-'}</td>
                                      <td><small className="text-muted">{art.kArtikel}</small></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Browser Tab */}
          {produkteTab === 'browser' && (
            <div>
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="mb-3"><i className="bi bi-grid mr-2"/>Artikel-Browser</h5>
                  
                  {artikelImportProgress.imported === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-inbox" style={{fontSize: '4rem', color: '#ccc'}}/>
                      <h4 className="mt-3 text-muted">Noch keine Artikel importiert</h4>
                      <p className="text-muted">Gehen Sie zum Import-Tab und starten Sie den Artikel-Import.</p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => setProdukteTab('import')}
                      >
                        <i className="bi bi-download mr-2"/>Zum Import
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Filter & Stats */}
                      <div className="row mb-3">
                        <div className="col-md-12">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <span className="text-muted small">
                                <strong>{artikelTotal.toLocaleString()}</strong> Artikel gefunden
                              </span>
                            </div>
                            <div>
                              <span className="text-muted small mr-2">Pro Seite:</span>
                              <select 
                                className="form-control form-control-sm d-inline-block"
                                style={{width: 'auto'}}
                                value={artikelPerPage}
                                onChange={(e) => { setArtikelPerPage(parseInt(e.target.value)); setArtikelPage(1); }}
                              >
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-4">
                          <input 
                            type="text"
                            className="form-control"
                            placeholder="🔍 Suche: Artikelnummer, Name, Barcode..."
                            value={artikelFilter.search}
                            onChange={(e) => { setArtikelFilter({...artikelFilter, search: e.target.value}); setArtikelPage(1); }}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-control"
                            value={artikelFilter.hersteller}
                            onChange={(e) => { setArtikelFilter({...artikelFilter, hersteller: e.target.value}); setArtikelPage(1); }}
                          >
                            <option value="">Alle Hersteller</option>
                            {availableHerstellerArtikel.map(h => (
                              <option key={h.name} value={h.name}>
                                {h.name} ({h.count})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-control"
                            value={artikelFilter.warengruppe}
                            onChange={(e) => { setArtikelFilter({...artikelFilter, warengruppe: e.target.value}); setArtikelPage(1); }}
                          >
                            <option value="">Alle Warengruppen</option>
                            {availableWarengruppenArtikel.map(w => (
                              <option key={w.name} value={w.name}>
                                {w.name} ({w.count})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button 
                            className="btn btn-outline-secondary btn-block" 
                            onClick={() => {
                              setArtikelFilter({ search: '', hersteller: '', warengruppe: '' })
                              setArtikelPage(1)
                            }}
                          >
                            <i className="bi bi-x-circle mr-1"/>Filter zurücksetzen
                          </button>
                        </div>
                      </div>

                      {/* Artikel-Tabelle */}
                      {artikelLoading ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="sr-only">Lädt...</span>
                          </div>
                          <p className="text-muted mt-2">Artikel werden geladen...</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-hover table-sm">
                            <thead className="thead-light">
                              <tr>
                                <th></th>
                                <th>Art.-Nr.</th>
                                <th>Name</th>
                                <th>Hersteller</th>
                                <th>Warengruppe</th>
                                <th className="text-right">VK Netto</th>
                                <th className="text-right">EK Netto</th>
                                <th className="text-right">Marge %</th>
                                <th className="text-center">Bestand</th>
                                <th className="text-center">Preisvergleich</th>
                              </tr>
                            </thead>
                            <tbody>
                              {artikelList.length === 0 ? (
                                <tr>
                                  <td colSpan="10" className="text-center text-muted py-4">
                                    <i className="bi bi-inbox mr-2" style={{fontSize: '2rem'}}/>
                                    <div>Keine Artikel gefunden</div>
                                    <small>Versuchen Sie andere Filter</small>
                                  </td>
                                </tr>
                              ) : (
                                artikelList.map(artikel => (
                                  <>
                                    <tr key={artikel.kArtikel}>
                                      <td className="text-center">
                                        <button 
                                          className="btn btn-sm btn-outline-secondary"
                                          onClick={() => loadArtikelPresence(artikel.kArtikel)}
                                          title="Präsenz anzeigen"
                                        >
                                          <i className={`bi bi-${expandedArtikel === artikel.kArtikel ? 'chevron-up' : 'chevron-down'}`}/>
                                        </button>
                                      </td>
                                      <td className="font-weight-bold text-primary">{artikel.cArtNr}</td>
                                    <td>
                                      <div className="text-truncate font-weight-bold" style={{maxWidth: '350px'}} title={artikel.cName || artikel.cKurzBeschreibung}>
                                        {artikel.cName || artikel.cKurzBeschreibung || 'Kein Name'}
                                      </div>
                                      {artikel.cKurzBeschreibung && artikel.cName !== artikel.cKurzBeschreibung && (
                                        <small className="text-muted text-truncate d-block" style={{maxWidth: '350px'}}>
                                          {artikel.cKurzBeschreibung.substring(0, 100)}...
                                        </small>
                                      )}
                                    </td>
                                    <td>
                                      <span className="badge badge-light">{artikel.cHerstellerName || '-'}</span>
                                    </td>
                                    <td>
                                      <span className="badge badge-secondary">{artikel.cWarengruppenName || '-'}</span>
                                    </td>
                                    <td className="text-right font-weight-bold">
                                      {parseFloat(artikel.fVKNetto || 0).toFixed(2)} €
                                    </td>
                                    <td className="text-right text-muted">
                                      {parseFloat(artikel.fEKNetto || 0).toFixed(2)} €
                                    </td>
                                    <td className="text-right">
                                      <span className={`badge badge-${artikel.margin_percent > 30 ? 'success' : artikel.margin_percent > 15 ? 'warning' : 'danger'}`}>
                                        {artikel.margin_percent}%
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`badge ${artikel.nLagerbestand > 0 ? 'badge-success' : 'badge-secondary'}`}>
                                        {artikel.nLagerbestand || 0}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <button 
                                        className="btn btn-sm btn-info"
                                        onClick={() => startePreisvergleich(artikel)}
                                        title="Preisvergleich starten"
                                      >
                                        <i className="bi bi-search"/>
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Aufklappbare Präsenz-Details */}
                                  {expandedArtikel === artikel.kArtikel && (
                                    <tr>
                                      <td colSpan="10" className="bg-light">
                                        {/* Artikel Detail Tabs */}
                                        <div className="btn-group btn-group-sm mb-3">
                                          <button 
                                            className={`btn ${artikelDetailTab === 'jtl' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => setArtikelDetailTab('jtl')}
                                          >
                                            <i className="bi bi-database mr-1"/>JTL-Daten
                                          </button>
                                          <button 
                                            className={`btn ${artikelDetailTab === 'bulletpoints' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => {
                                              setArtikelDetailTab('bulletpoints')
                                              loadBulletpointsForArtikel(artikel.kArtikel)
                                            }}
                                          >
                                            <i className="bi bi-chat-left-text mr-1"/>Amazon Bulletpoints
                                          </button>
                                          <button 
                                            className={`btn ${artikelDetailTab === 'presence' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => setArtikelDetailTab('presence')}
                                          >
                                            <i className="bi bi-info-circle mr-1"/>Präsenz
                                          </button>
                                        </div>

                                        {/* JTL-Daten Tab */}
                                        {artikelDetailTab === 'jtl' && (
                                          <div className="py-2 px-3">
                                            <h6 className="mb-3"><i className="bi bi-database mr-2"/>JTL-Daten & Merkmale</h6>
                                            <div className="row">
                                              <div className="col-md-6">
                                                <table className="table table-sm table-bordered">
                                                  <tbody>
                                                    <tr>
                                                      <td><strong>Artikel-Nr:</strong></td>
                                                      <td>{artikel.cArtNr}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>Name:</strong></td>
                                                      <td>{artikel.cName}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>Barcode/EAN:</strong></td>
                                                      <td>{artikel.cBarcode || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>HAN:</strong></td>
                                                      <td>{artikel.cHAN || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>Lagerbestand:</strong></td>
                                                      <td>{artikel.nLagerbestand}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>Gewicht (kg):</strong></td>
                                                      <td>{artikel.fGewicht || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>VK Preis:</strong></td>
                                                      <td>{artikel.fVKNetto?.toFixed(2)}€</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>EK Preis:</strong></td>
                                                      <td>{artikel.fEKNetto?.toFixed(2)}€</td>
                                                    </tr>
                                                    <tr>
                                                      <td><strong>Marge:</strong></td>
                                                      <td>{artikel.margin_percent?.toFixed(1)}%</td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                              <div className="col-md-6">
                                                <h6><i className="bi bi-tag mr-2"/>Merkmale</h6>
                                                {artikel.merkmale && artikel.merkmale.length > 0 ? (
                                                  <table className="table table-sm table-bordered">
                                                    <tbody>
                                                      {artikel.merkmale.map((m, idx) => (
                                                        <tr key={idx}>
                                                          <td><strong>{m.name}:</strong></td>
                                                          <td>{m.wert}</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                ) : (
                                                  <p className="text-muted">Keine Merkmale vorhanden</p>
                                                )}
                                              </div>
                                            </div>
                                            {artikel.cKurzBeschreibung && (
                                              <div className="mt-3">
                                                <h6><i className="bi bi-file-text mr-2"/>Kurzbeschreibung</h6>
                                                <p className="small">{artikel.cKurzBeschreibung}</p>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Amazon Bulletpoints Tab */}
                                        {artikelDetailTab === 'bulletpoints' && (
                                          <div className="py-2 px-3">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                              <h6 className="mb-0"><i className="bi bi-chat-left-text mr-2"/>Amazon Bulletpoints</h6>
                                              <button 
                                                className="btn btn-primary btn-sm"
                                                onClick={() => generateBulletpointsForArtikel(artikel)}
                                                disabled={generatingBulletpoints}
                                              >
                                                {generatingBulletpoints ? (
                                                  <>
                                                    <span className="spinner-border spinner-border-sm mr-2"/>
                                                    Generiere...
                                                  </>
                                                ) : (
                                                  <>
                                                    <i className="bi bi-magic mr-2"/>
                                                    Bulletpoints generieren
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            
                                            {artikelBulletpoints ? (
                                              <div>
                                                <div className="alert alert-success">
                                                  <i className="bi bi-check-circle mr-2"/>Bulletpoints wurden generiert
                                                </div>
                                                <div className="bg-white p-3 rounded border">
                                                  {artikelBulletpoints.split(';').map((bp, idx) => (
                                                    <div key={idx} className="mb-2">
                                                      <strong>Bulletpoint {idx + 1}:</strong>
                                                      <p className="mb-0 ml-3">{bp.trim()}</p>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="alert alert-info">
                                                <i className="bi bi-info-circle mr-2"/>
                                                Für diesen Artikel wurden noch keine Bulletpoints generiert.
                                                Klicken Sie auf "Bulletpoints generieren" um welche zu erstellen.
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Präsenz Tab */}
                                        {artikelDetailTab === 'presence' && (
                                          <>
                                            {loadingPresence ? (
                                              <div className="text-center py-3">
                                                <span className="spinner-border spinner-border-sm mr-2"/>Lade Präsenz-Daten...
                                              </div>
                                            ) : artikelPresence ? (
                                              <div className="py-2 px-3">
                                                <h6 className="mb-2"><i className="bi bi-info-circle mr-2"/>Artikel-Präsenz</h6>
                                            
                                            {/* Zusammenfassung */}
                                            <div className="row mb-3">
                                              <div className="col-md-2">
                                                <div className="card bg-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0 text-primary">{artikelPresence.summary.in_stuecklisten}</div>
                                                    <small className="text-muted">Stücklisten</small>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-md-2">
                                                <div className="card bg-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0 text-warning">{artikelPresence.summary.auf_ebay}</div>
                                                    <small className="text-muted">eBay</small>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-md-2">
                                                <div className="card bg-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0 text-info">{artikelPresence.summary.auf_amazon}</div>
                                                    <small className="text-muted">Amazon</small>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-md-2">
                                                <div className="card bg-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0 text-success">{artikelPresence.summary.in_shops}</div>
                                                    <small className="text-muted">Shops</small>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-md-2">
                                                <div className="card bg-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0 text-secondary">{artikelPresence.summary.in_verkaufskanaelen}</div>
                                                    <small className="text-muted">Verkaufskanäle</small>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-md-2">
                                                <div className="card bg-primary text-white">
                                                  <div className="card-body text-center py-2">
                                                    <div className="h5 mb-0">{artikelPresence.summary.gesamt_praesenz}</div>
                                                    <small>Gesamt</small>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Details */}
                                            {artikelPresence.presence.stuecklisten.length > 0 && (
                                              <div className="mb-2">
                                                <strong className="text-primary">In Stücklisten ({artikelPresence.presence.stuecklisten.length}):</strong>
                                                <ul className="small mb-0">
                                                  {artikelPresence.presence.stuecklisten.slice(0, 5).map((s, i) => (
                                                    <li key={i}>{s.cVaterName} ({s.cVaterArtNr}) - Menge: {s.fMenge}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}

                                            {artikelPresence.presence.ebay_angebote.length > 0 && (
                                              <div className="mb-2">
                                                <strong className="text-warning">eBay-Angebote ({artikelPresence.presence.ebay_angebote.length}):</strong>
                                                <ul className="small mb-0">
                                                  {artikelPresence.presence.ebay_angebote.slice(0, 3).map((e, i) => (
                                                    <li key={i}>{e.Title} - {e.Platform} - {e.Price}€</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}

                                            {artikelPresence.presence.amazon_angebote.length > 0 && (
                                              <div className="mb-2">
                                                <strong className="text-info">Amazon-Angebote ({artikelPresence.presence.amazon_angebote.length}):</strong>
                                                <ul className="small mb-0">
                                                  {artikelPresence.presence.amazon_angebote.slice(0, 3).map((a, i) => (
                                                    <li key={i}>ASIN: {a.ASIN} - {a.Platform} - {a.Price}€</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}

                                            {artikelPresence.presence.online_shops.length > 0 && (
                                              <div className="mb-2">
                                                <strong className="text-success">Online-Shops ({artikelPresence.presence.online_shops.length}):</strong>
                                                <ul className="small mb-0">
                                                  {artikelPresence.presence.online_shops.map((s, i) => (
                                                    <li key={i}>{s.ShopName} - <a href={s.ArtikelURL} target="_blank">{s.ArtikelURL?.substring(0, 50)}...</a></li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              ))
                            )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pagination */}
                      {!artikelLoading && artikelList.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3">
                          <div className="text-muted small">
                            Zeige Artikel {((artikelPage - 1) * artikelPerPage) + 1} bis {Math.min(artikelPage * artikelPerPage, artikelTotal)} von {artikelTotal.toLocaleString()}
                          </div>
                          <nav>
                            <ul className="pagination pagination-sm mb-0">
                              <li className={`page-item ${artikelPage === 1 ? 'disabled' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => setArtikelPage(1)}
                                  disabled={artikelPage === 1}
                                >
                                  <i className="bi bi-chevron-double-left"/>
                                </button>
                              </li>
                              <li className={`page-item ${artikelPage === 1 ? 'disabled' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => setArtikelPage(artikelPage - 1)}
                                  disabled={artikelPage === 1}
                                >
                                  <i className="bi bi-chevron-left"/>
                                </button>
                              </li>
                              
                              {/* Page Numbers */}
                              {[...Array(Math.min(5, artikelTotalPages))].map((_, i) => {
                                let pageNum;
                                if (artikelTotalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (artikelPage <= 3) {
                                  pageNum = i + 1;
                                } else if (artikelPage >= artikelTotalPages - 2) {
                                  pageNum = artikelTotalPages - 4 + i;
                                } else {
                                  pageNum = artikelPage - 2 + i;
                                }
                                return (
                                  <li key={i} className={`page-item ${pageNum === artikelPage ? 'active' : ''}`}>
                                    <button 
                                      className="page-link" 
                                      onClick={() => setArtikelPage(pageNum)}
                                    >
                                      {pageNum}
                                    </button>
                                  </li>
                                );
                              })}

                              <li className={`page-item ${artikelPage === artikelTotalPages ? 'disabled' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => setArtikelPage(artikelPage + 1)}
                                  disabled={artikelPage === artikelTotalPages}
                                >
                                  <i className="bi bi-chevron-right"/>
                                </button>
                              </li>
                              <li className={`page-item ${artikelPage === artikelTotalPages ? 'disabled' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => setArtikelPage(artikelTotalPages)}
                                  disabled={artikelPage === artikelTotalPages}
                                >
                                  <i className="bi bi-chevron-double-right"/>
                                </button>
                              </li>
                            </ul>
                          </nav>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preisvergleich Modal */}
              {preisvergleichArtikel && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                  <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                      <div className="modal-header bg-info text-white">
                        <h5 className="modal-title">
                          <i className="bi bi-search mr-2"/>Preisvergleich: {preisvergleichArtikel.cArtNr}
                        </h5>
                        <button className="close text-white" onClick={() => setPreisvergleichArtikel(null)}>
                          <span>&times;</span>
                        </button>
                      </div>
                      <div className="modal-body">
                        {/* Unser Produkt */}
                        <div className="card border-primary mb-3">
                          <div className="card-header bg-primary text-white py-2">
                            <strong>Unser Produkt</strong>
                          </div>
                          <div className="card-body py-2">
                            <div className="row">
                              <div className="col-md-8">
                                <strong>{preisvergleichArtikel.cName}</strong><br/>
                                <small className="text-muted">
                                  EAN: {preisvergleichArtikel.cBarcode || 'N/A'} | 
                                  MPN: {preisvergleichArtikel.cHAN || 'N/A'}
                                </small>
                              </div>
                              <div className="col-md-4 text-right">
                                <div className="h4 text-primary mb-0">
                                  {parseFloat(preisvergleichArtikel.fVKNetto).toFixed(2)} €
                                </div>
                                <small className="text-muted">VK netto</small>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ladebalken */}
                        {preisvergleichLoading && (
                          <div className="text-center py-4">
                            <div className="spinner-border text-info mb-2"/>
                            <p className="text-muted">Suche Wettbewerbspreise...</p>
                          </div>
                        )}

                        {/* Ergebnisse */}
                        {!preisvergleichLoading && preisvergleichErgebnisse.length > 0 && (
                          <div className="card border-success">
                            <div className="card-header bg-success text-white py-2">
                              <strong>{preisvergleichErgebnisse.length} Wettbewerbspreise gefunden</strong>
                            </div>
                            <div className="card-body p-0">
                              <div className="table-responsive" style={{maxHeight: '400px'}}>
                                <table className="table table-sm table-hover mb-0">
                                  <thead className="thead-light">
                                    <tr>
                                      <th>Shop</th>
                                      <th>VE</th>
                                      <th className="text-right">Preis gesamt</th>
                                      <th className="text-right">Preis pro Stück</th>
                                      <th>Link</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {preisvergleichErgebnisse.map((erg, idx) => (
                                      <tr key={idx}>
                                        <td><strong>{erg.shop}</strong></td>
                                        <td>
                                          <span className="badge badge-info">{erg.ve} Stk</span>
                                        </td>
                                        <td className="text-right">{erg.preis.toFixed(2)} €</td>
                                        <td className="text-right font-weight-bold text-success">
                                          {erg.preis_pro_stueck.toFixed(2)} €
                                        </td>
                                        <td>
                                          <a href={erg.url} target="_blank" className="btn btn-sm btn-outline-info">
                                            <i className="bi bi-box-arrow-up-right"/>
                                          </a>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                        {!preisvergleichLoading && preisvergleichErgebnisse.length === 0 && (
                          <div className="alert alert-warning">
                            <i className="bi bi-exclamation-triangle mr-2"/>
                            Keine Wettbewerbspreise gefunden. Versuchen Sie es später erneut.
                          </div>
                        )}
                      </div>
                      <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setPreisvergleichArtikel(null)}>
                          Schließen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Prompts Tab */}
          {produkteTab === 'prompts' && (
            <div>
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="mb-0"><i className="bi bi-chat-left-text mr-2"/>Amazon Bulletpoint Prompts</h5>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => openPromptModal('create')}
                    >
                      <i className="bi bi-plus-circle mr-2"/>Neuer Prompt
                    </button>
                  </div>
                  
                  {loadingPrompts ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="sr-only">Laden...</span>
                      </div>
                      <p className="mt-3 text-muted">Prompts werden geladen...</p>
                    </div>
                  ) : amazonPrompts.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-chat-left-text" style={{fontSize: '4rem', color: '#ccc'}}/>
                      <h4 className="mt-3 text-muted">Keine Prompts verfügbar</h4>
                      <p className="text-muted">Erstellen Sie Ihren ersten Amazon-Prompt.</p>
                      <button 
                        className="btn btn-primary mt-3"
                        onClick={() => openPromptModal('create')}
                      >
                        <i className="bi bi-plus-circle mr-2"/>Ersten Prompt erstellen
                      </button>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Version</th>
                            <th>Name</th>
                            <th>Beschreibung</th>
                            <th>Status</th>
                            <th>Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amazonPrompts.map((prompt) => (
                            <tr key={prompt.version}>
                              <td className="align-middle">
                                <span className="badge badge-secondary">v{prompt.version}</span>
                              </td>
                              <td className="align-middle">
                                <strong>{prompt.name}</strong>
                              </td>
                              <td className="align-middle">
                                <small className="text-muted">{prompt.beschreibung}</small>
                              </td>
                              <td className="align-middle">
                                {prompt.isActive ? (
                                  <span className="badge badge-success">
                                    <i className="bi bi-check-circle mr-1"/>Aktiv
                                  </span>
                                ) : (
                                  <span className="badge badge-secondary">Inaktiv</span>
                                )}
                              </td>
                              <td className="align-middle">
                                <div className="btn-group btn-group-sm">
                                  <button 
                                    className="btn btn-outline-primary"
                                    onClick={() => setSelectedPrompt(prompt)}
                                    title="Anzeigen"
                                  >
                                    <i className="bi bi-eye"/>
                                  </button>
                                  <button 
                                    className="btn btn-outline-secondary"
                                    onClick={() => openPromptModal('edit', prompt)}
                                    title="Bearbeiten"
                                  >
                                    <i className="bi bi-pencil"/>
                                  </button>
                                  {!prompt.isActive && (
                                    <button 
                                      className="btn btn-outline-success"
                                      onClick={() => activatePrompt(prompt.version)}
                                      title="Aktivieren"
                                    >
                                      <i className="bi bi-check-circle"/>
                                    </button>
                                  )}
                                  <button 
                                    className="btn btn-outline-danger"
                                    onClick={() => deletePrompt(prompt.version)}
                                    title="Löschen"
                                  >
                                    <i className="bi bi-trash"/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt Detail Modal */}
              {selectedPrompt && (
                <div 
                  className="modal d-block" 
                  style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
                  onClick={() => setSelectedPrompt(null)}
                >
                  <div 
                    className="modal-dialog modal-lg modal-dialog-scrollable"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">
                          <i className="bi bi-chat-left-text mr-2"/>
                          {selectedPrompt.name} <span className="badge badge-secondary ml-2">v{selectedPrompt.version}</span>
                        </h5>
                        <button 
                          className="close" 
                          onClick={() => setSelectedPrompt(null)}
                        >
                          <span>&times;</span>
                        </button>
                      </div>
                      <div className="modal-body">
                        <div className="mb-3">
                          <strong>Beschreibung:</strong>
                          <p className="text-muted">{selectedPrompt.beschreibung}</p>
                        </div>
                        <div className="mb-3">
                          <strong>Status:</strong>
                          {selectedPrompt.isActive ? (
                            <span className="badge badge-success ml-2">Aktiv</span>
                          ) : (
                            <span className="badge badge-secondary ml-2">Inaktiv</span>
                          )}
                        </div>
                        <div>
                          <strong>Prompt:</strong>
                          <pre className="bg-light p-3 rounded mt-2" style={{maxHeight: '400px', overflow: 'auto', fontSize: '12px'}}>
                            {selectedPrompt.prompt}
                          </pre>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setSelectedPrompt(null)}
                        >
                          Schließen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Create/Edit Prompt Modal */}
              {showPromptModal && (
                <div 
                  className="modal d-block" 
                  style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
                  onClick={() => setShowPromptModal(false)}
                >
                  <div 
                    className="modal-dialog modal-xl modal-dialog-scrollable"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">
                          <i className="bi bi-chat-left-text mr-2"/>
                          {promptModalMode === 'edit' ? 'Prompt bearbeiten' : 'Neuer Prompt'}
                        </h5>
                        <button 
                          className="close" 
                          onClick={() => setShowPromptModal(false)}
                        >
                          <span>&times;</span>
                        </button>
                      </div>
                      <div className="modal-body">
                        <div className="form-group">
                          <label>Name *</label>
                          <input 
                            type="text"
                            className="form-control"
                            value={newPromptData.name}
                            onChange={(e) => setNewPromptData({...newPromptData, name: e.target.value})}
                            placeholder="z.B. Premium Stil-Vorgabe"
                          />
                        </div>
                        <div className="form-group">
                          <label>Beschreibung</label>
                          <input 
                            type="text"
                            className="form-control"
                            value={newPromptData.beschreibung}
                            onChange={(e) => setNewPromptData({...newPromptData, beschreibung: e.target.value})}
                            placeholder="Kurze Beschreibung des Prompts"
                          />
                        </div>
                        <div className="form-group">
                          <label>Prompt *</label>
                          <textarea 
                            className="form-control font-monospace"
                            rows="20"
                            value={newPromptData.prompt}
                            onChange={(e) => setNewPromptData({...newPromptData, prompt: e.target.value})}
                            placeholder="Geben Sie hier den Prompt ein..."
                            style={{fontSize: '12px'}}
                          />
                          <small className="form-text text-muted">
                            Verwenden Sie {'{'}{'{'} PRODUKTINFO {'}'}{'}'}  als Platzhalter für die Produktinformationen
                          </small>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setShowPromptModal(false)}
                        >
                          Abbrechen
                        </button>
                        <button 
                          className="btn btn-primary"
                          onClick={savePrompt}
                        >
                          <i className="bi bi-save mr-2"/>
                          {promptModalMode === 'edit' ? 'Aktualisieren' : 'Erstellen'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* E-Mail Vorschau Modal */}
      {emailPreview && (
        <div className="modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.8)'}} onClick={() => setEmailPreview(null)}>
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-dark text-white">
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title">
                  <i className="bi bi-envelope-check text-success mr-2"/>
                  E-Mail Vorschau - {emailPreview.prospect.company_name}
                </h5>
                <button className="close text-white" onClick={() => setEmailPreview(null)}>
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {/* Empfänger Info */}
                {emailPreview.kontaktperson && (
                  <div className="alert alert-info mb-3">
                    <strong>An:</strong> {emailPreview.kontaktperson.name} ({emailPreview.kontaktperson.position})
                    <br/>
                    <strong>E-Mail:</strong> {emailPreview.kontaktperson.email}
                  </div>
                )}
                
                {/* Betreff */}
                <div className="form-group">
                  <label className="font-weight-bold">Betreff:</label>
                  <input 
                    type="text" 
                    className="form-control form-control-lg bg-secondary text-white border-0" 
                    value={emailPreview.email.betreff}
                    readOnly
                  />
                </div>
                
                {/* E-Mail Text */}
                <div className="form-group">
                  <label className="font-weight-bold">Nachricht:</label>
                  <textarea 
                    className="form-control bg-secondary text-white border-0" 
                    rows="15"
                    value={emailPreview.email.text}
                    readOnly
                    style={{whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem'}}
                  />
                </div>
                
                {/* Statistik */}
                <div className="d-flex justify-content-between text-muted small">
                  <span>Wörter: {emailPreview.email.text.split(' ').length}</span>
                  <span>Zeichen: {emailPreview.email.text.length}</span>
                </div>
              </div>
              <div className="modal-footer border-top border-secondary">
                <button className="btn btn-secondary" onClick={() => setEmailPreview(null)}>
                  <i className="bi bi-x-circle mr-1"/>Schließen
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(emailPreview.email.text)
                    alert('✅ E-Mail in Zwischenablage kopiert!')
                  }}
                >
                  <i className="bi bi-clipboard mr-1"/>In Zwischenablage
                </button>
                {emailPreview.kontaktperson?.email && (
                  <>
                    <a 
                      href={`mailto:${emailPreview.kontaktperson.email}?subject=${encodeURIComponent(emailPreview.email.betreff)}&body=${encodeURIComponent(emailPreview.email.text)}`}
                      className="btn btn-info"
                    >
                      <i className="bi bi-envelope mr-1"/>In E-Mail-Client öffnen
                    </a>
                    <button
                      className="btn btn-success"
                      onClick={async () => {
                        if (!confirm(`E-Mail jetzt an ${emailPreview.kontaktperson.email} senden?\n\nBCC wird automatisch an danki.leismann@gmx.de gesendet.`)) return
                        
                        try {
                          const res = await fetch('/api/coldleads/generate-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              prospectId: emailPreview.prospect.id,
                              kontaktpersonIndex: emailPreview.prospect.analysis.kontaktpersonen.findIndex(k => k.email === emailPreview.kontaktperson.email),
                              sendNow: true
                            })
                          })
                          
                          const data = await res.json()
                          
                          if (data.success && data.sent) {
                            alert(`✅ E-Mail erfolgreich versendet!\n\nAn: ${emailPreview.kontaktperson.email}\nBCC: danki.leismann@gmx.de\n\nMessage-ID: ${data.sendResult?.messageId || 'N/A'}`)
                            setEmailPreview(null)
                            await loadColdProspects()
                            await loadColdLeadStats()
                          } else {
                            alert('❌ E-Mail-Versand fehlgeschlagen. Bitte prüfen Sie die SMTP-Konfiguration.')
                          }
                        } catch (err) {
                          alert('❌ Fehler: ' + err.message)
                        }
                      }}
                      disabled={generatingEmail}
                    >
                      <i className="bi bi-send-fill mr-1"/>Jetzt versenden (mit BCC)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
