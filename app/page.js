'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [from, setFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })
  const [to, setTo] = useState(()=> new Date().toISOString().slice(0,10))

  const [kpi, setKpi] = useState(null)
  const [kpiFees, setKpiFees] = useState(null)
  const [ordersSplit, setOrdersSplit] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [margin, setMargin] = useState(null)
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

  // Kaltakquise
  const [coldLeadsTab, setColdLeadsTab] = useState('search')
  const [coldSearchForm, setColdSearchForm] = useState({ industry: '', region: '', limit: 10 })
  const [coldProspects, setColdProspects] = useState([])
  const [coldLoading, setColdLoading] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [generatedEmail, setGeneratedEmail] = useState(null)
  const [coldStatusFilter, setColdStatusFilter] = useState('all')
  const [coldStats, setColdStats] = useState({ total: 0, new: 0, analyzed: 0, contacted: 0 })

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
  const [marketingSub, setMarketingSub] = useState('warmaquise') // warmaquise|kaltaquise|sea|seo

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
      const [k1, k2, t1, t2, p, osRaw, poRaw, expRaw, marginRaw] = await Promise.all([
        getJson(`/api/jtl/sales/kpi?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/kpi/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/platform-timeseries?from=${from}&to=${to}`),
        getJson(`/api/jtl/orders/kpi/shipping-split?from=${from}&to=${to}`),
        getJsonRaw(`/api/jtl/purchase/orders?from=${from}&to=${to}`),
        getJsonRaw(`/api/jtl/purchase/expenses?from=${from}&to=${to}`),
        getJson(`/api/jtl/orders/kpi/margin?from=${from}&to=${to}`)
      ])
      const tsN = sortByDateAsc(toArray(t1))
      const tsFeesN = sortByDateAsc(toArray(t2))
      const platN = sortByDateAsc(toArray(p))
      setKpi(k1); setKpiFees(k2); setTs(tsN); setTsFees(tsFeesN); setPlatTs(platN); setOrdersSplit(osRaw)
      setPurchaseOrders(poRaw?.ok ? poRaw.data : null)
      setExpenses(expRaw?.ok ? expRaw.data : null)
      setMargin(marginRaw)
      pushLog({ url:'/api/jtl/orders/kpi/shipping-split', status:200, ok:true, ms: Math.round(performance.now()-started) })
      if (isDegradedFlag) {
        const ksum = Number(k1?.revenue||0) + Number(k1?.orders||0) + Number(k1?.margin||0)
        const hasData = (tsN?.length||0) + (tsFeesN?.length||0) + (platN?.length||0) > 0 || ksum > 0
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
      setTopProducts(Array.isArray(prods)?prods:toArray(prods))
      setTopCategories(Array.isArray(cats)?cats:toArray(cats))
    } catch(e){ if (isDegradedFlag){ setTopProducts([]); setTopCategories([]) } }
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
    const r = await getJsonRaw('/api/leads/import', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({}) })
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

  useEffect(() => { loadDateRangeAndAdjust(); fetchAll(); fetchSalesTables(); refreshProspects() }, [])
  useEffect(() => { fetchAll(); fetchSalesTables() }, [from, to, limit])
  useEffect(() => { if (activeTab==='marketing') queryLeads() }, [activeTab, statusF, b2bF, minScoreF, qF, pageF, limitF, sortF, orderF])
  useEffect(() => { if (activeTab==='coldleads') loadColdProspects() }, [activeTab, coldStatusFilter])

  useEffect(() => {
    const applyHash = () => { const h=(window.location.hash||'#dashboard').replace('#',''); setActiveTab(h) }
    applyHash(); window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  useEffect(() => { renderCharts() }, [ts, tsFees, platTs, stacked])

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

  // Kaltakquise Functions
  const loadColdProspects = async () => {
    try {
      const res = await fetch(`/api/coldleads/search?status=${coldStatusFilter}&limit=100`)
      const data = await res.json()
      if (data.ok) {
        setColdProspects(data.prospects)
        // Statistiken berechnen
        const all = data.prospects
        setColdStats({
          total: all.length,
          new: all.filter(p => p.status === 'new').length,
          analyzed: all.filter(p => p.status === 'analyzed').length,
          contacted: all.filter(p => p.status === 'contacted').length
        })
      }
    } catch (e) {
      console.error('Load prospects failed:', e)
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

  const analyzeProspect = async (prospect) => {
    if (!confirm(`Firma "${prospect.company_name}" jetzt analysieren? (Nutzt OpenAI)`)) return
    setColdLoading(true)
    try {
      const res = await fetch('/api/coldleads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: prospect.website, industry: prospect.industry })
      })
      const data = await res.json()
      if (data.ok) {
        setSelectedProspect({ ...prospect, analysis: data.analysis })
        alert('Analyse abgeschlossen! Score: ' + data.analysis.needs_assessment.score)
        // Refresh list
        const list = await fetch('/api/coldleads/search?limit=50')
        const listData = await list.json()
        if (listData.ok) setColdProspects(listData.prospects)
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (e) {
      alert('Fehler: ' + e.message)
    }
    setColdLoading(false)
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
        alert('Email erfolgreich versendet!')
        setGeneratedEmail(null)
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
          {/* Oberste Reihe: nur Auftragsbasis */}
          <div className="row">
            <KpiTile title="Bestellungen (Aufträge)" value={(ordersSplit?.orders??'-').toLocaleString?.('de-DE')||ordersSplit?.orders||'-'} sub="nach 'Erstellt am'" demo={demoMode} />
            <KpiTile title="Umsatz (NETTO) — Aufträge" value={fmtCurrency(ordersSplit?.net_without_shipping)} sub={`mit Versand: ${fmtCurrency(ordersSplit?.net_with_shipping)}`} demo={demoMode} />
            <KpiTile title="Umsatz (BRUTTO) — Aufträge" value={fmtCurrency(ordersSplit?.gross_without_shipping)} sub={`mit Versand: ${fmtCurrency(ordersSplit?.gross_with_shipping)}`} demo={demoMode} />
          </div>

          {/* Zweite Reihe: Rechnungsbasis (klar gekennzeichnet) */}
          <div className="row">
            <KpiTile title="Umsatz (Rechnungen)" value={fmtCurrency(kpi?.revenue)} sub="Quelle: Rechnungen" demo={demoMode} />
            <KpiTile title="Marge (Rechnungen)" value={fmtCurrency(kpi?.margin)} sub="ohne Gebühren" demo={demoMode} />
            <KpiTile title="Marge (mit Gebühren) — Rechnungen" value={fmtCurrency(kpiFees?.margin_with_fees)} sub="inkl. 1,50 € + 20% Plattformgebühr" demo={demoMode} />
          </div>

          {/* Dritte Reihe: Beschaffung & Rohertragsmarge */}
          <div className="row">
            <KpiTile 
              title="Einkaufsbestellungen — Netto (Bestellwert)" 
              value={fmtCurrency(purchaseOrders?.net)} 
              sub={
                <span>
                  Brutto: {fmtCurrency(purchaseOrders?.gross)} | Quelle: Beschaffung → Bestellungen
                  {purchaseOrders?.debug && (
                    <span 
                      className="ml-2" 
                      style={{cursor:'help'}} 
                      title={`Tabellen: ${purchaseOrders?.debug?.headerTable}, ${purchaseOrders?.debug?.posTable}\nDatum: ${purchaseOrders?.debug?.dateFieldUsed}`}
                    >
                      ⓘ
                    </span>
                  )}
                </span>
              } 
              demo={demoMode} 
            />
            <KpiTile 
              title="Ausgaben (Eingangsrechnungen) — Netto" 
              value={fmtCurrency(expenses?.net)} 
              sub={
                <span>
                  Brutto: {fmtCurrency(expenses?.gross)} | Quelle: Eingangsrechnungen {expenses?.debug?.source?.includes('fallback') ? '(Fallback: Bestellungen)' : ''}
                  {expenses?.debug && (
                    <span 
                      className="ml-2" 
                      style={{cursor:'help'}} 
                      title={`Material: ${fmtCurrency(expenses?.cost_components?.material)} | Fracht: ${fmtCurrency(expenses?.cost_components?.freight)} | Other: ${fmtCurrency(expenses?.cost_components?.other)}\nTabellen: ${expenses?.debug?.headerTable}, ${expenses?.debug?.posTable}\nQuelle: ${expenses?.debug?.source}`}
                    >
                      ⓘ
                    </span>
                  )}
                </span>
              } 
              demo={demoMode} 
            />
            <KpiTile 
              title="Rohertragsmarge — Netto (ohne Versand)" 
              value={fmtCurrency(margin?.margin_net)} 
              sub={
                <span>
                  Umsatz: {fmtCurrency(margin?.revenue_net_wo_ship)} | EK: {fmtCurrency(margin?.cost_net)}
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
          </div>

          <div className="row mt-1">
            <div className="col-md-8 mb-3">
              <div className="card">
                <div className="card-header bg-transparent border-0 d-flex align-items-center justify-content-between">
                  <span>Umsatz & Marge (mit Gebühren)</span>
                  {demoMode && <span className="badge badge-warning">Demo</span>}
                </div>
                <div className="card-body">
                  {ts.length===0 && tsFees.length===0 ? (
                    <div className="text-muted small">Keine Zeitreihen-Daten im Zeitraum</div>
                  ) : (
                    <canvas ref={revChartRef} height="120" />
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card">
                <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
                  <span>Umsatz pro Plattform pro Tag</span>
                  <div className="custom-control custom-switch">
                    <input type="checkbox" className="custom-control-input" id="stackedSwitch" checked={stacked} onChange={e=>setStacked(e.target.checked)} />
                    <label className="custom-control-label" htmlFor="stackedSwitch">Stack</label>
                  </div>
                </div>
                <div className="card-body">
                  {platTs.length===0 ? (
                    <div className="text-muted small">Keine Plattform-Daten im Zeitraum</div>
                  ) : (
                    <canvas ref={platChartRef} height="120" />
                  )}
                </div>
              </div>
            </div>
          </div>
          {error && <div className="alert alert-danger">{String(error)}</div>}
        </div>
      )}

      {activeTab==='outbound' && (
        <div>
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
          <div className="d-flex align-items-center mb-2">
            <div className="mr-2 small text-muted">Limit:</div>
            <select className="form-control form-control-sm" style={{maxWidth:120}} value={limit} onChange={e=>setLimit(parseInt(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item"><a className={`nav-link ${salesTab==='products'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('products')}}>Top-Produkte</a></li>
            <li className="nav-item"><a className={`nav-link ${salesTab==='categories'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault(); setSalesTab('categories')}}>Top-Kategorien</a></li>
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
                    <thead className="thead-dark"><tr><th>ArtikelNr</th><th>Name</th><th>Umsatz</th><th>Marge</th><th>Marge (mit Gebühren)</th></tr></thead>
                    <tbody>
                      {(topProducts||[]).map((r,idx)=> (
                        <tr key={idx}><td>{r.artikelNr}</td><td>{r.name}</td><td>{fmtCurrency(r.umsatz)}</td><td>{fmtCurrency(r.marge)}</td><td>{fmtCurrency(r.marge_with_fees)}</td></tr>
                      ))}
                      {topProducts?.length===0 && <tr><td colSpan={5} className="text-center text-muted">Keine Daten</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {salesTab==='categories' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Top-Kategorien</span>
                <button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV(topCategories, 'top-categories.csv')}>CSV</button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{maxHeight:420}}>
                  <table className="table table-dark table-hover table-sm mb-0">
                    <thead className="thead-dark"><tr><th>Kategorie</th><th>Umsatz</th><th>Marge</th><th>Marge (mit Gebühren)</th></tr></thead>
                    <tbody>
                      {(topCategories||[]).map((r,idx)=> (
                        <tr key={idx}><td>{r.kategorie}</td><td>{fmtCurrency(r.umsatz)}</td><td>{fmtCurrency(r.marge)}</td><td>{fmtCurrency(r.marge_with_fees)}</td></tr>
                      ))}
                      {topCategories?.length===0 && <tr><td colSpan={4} className="text-center text-muted">Keine Daten</td></tr>}
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
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h3 className="mb-0">Warmaquise</h3>
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
                          <div className="font-weight-bold">{lead.name||'—'}</div>
                          <div className="text-muted small">{lead.kundennr||'—'}</div>
                        </td>
                        <td className="align-middle"><B2BBadge b={lead.isB2B}/></td>
                        <td className="align-middle">{lead.lastOrder||'—'}</td>
                        <td className="align-middle">{lead.ordersCount??'—'}</td>
                        <td className="align-middle">{fmtCurrency(lead.totalRevenueNetto||0)}</td>
                        <td className="align-middle">
                          <div><a className="text-info" href={`tel:${lead?.contact?.phone||''}`}>{lead?.contact?.phone||'—'}</a></div>
                          <div><a className="text-info" href={`mailto:${lead?.contact?.email||''}`}>{lead?.contact?.email||'—'}</a></div>
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
                          <button className="btn btn-outline-primary btn-sm" onClick={()=>{ setNoteFor(lead); setNoteText('') }}>Notiz</button>
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

          {/* Notiz Modal (simple) */}
          {noteFor && (
            <div className="modal d-block" tabIndex="-1" role="dialog" style={{background:'rgba(0,0,0,.5)'}}>
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Notiz für {noteFor?.name}</h5>
                    <button type="button" className="close" onClick={()=>setNoteFor(null)}><span>&times;</span></button>
                  </div>
                  <div className="modal-body">
                    <textarea className="form-control" rows={4} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Notiz eintragen..." />
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={()=>setNoteFor(null)}>Abbrechen</button>
                    <button className="btn btn-primary" onClick={saveNote}>Speichern</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kaltakquise */}
      {activeTab==='coldleads' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h2 className="mb-1"><i className="bi bi-search mr-2"/>Kaltakquise-Tool</h2>
              <p className="text-muted small mb-0">B2B-Kundenakquise mit KI-gestützter Analyse</p>
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

          {/* Suchformular - moderner */}
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
                  <input 
                    className="form-control" 
                    placeholder="z.B. Metallbau, Holzbearbeitung" 
                    value={coldSearchForm.industry}
                    onChange={e => setColdSearchForm({...coldSearchForm, industry: e.target.value})}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <label className="small text-muted mb-1">Region *</label>
                  <input 
                    className="form-control" 
                    placeholder="z.B. Berlin, München, Hamburg" 
                    value={coldSearchForm.region}
                    onChange={e => setColdSearchForm({...coldSearchForm, region: e.target.value})}
                  />
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

          {/* Ergebnis-Tabelle - moderner */}
          {coldProspects.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-building text-primary mr-2"/>
                    <h5 className="mb-0">{coldProspects.length} Firmen gefunden</h5>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button className={`btn ${coldStatusFilter==='all'?'btn-primary':'btn-outline-secondary'}`} onClick={()=>setColdStatusFilter('all')}>
                      Alle ({coldStats.total})
                    </button>
                    <button className={`btn ${coldStatusFilter==='new'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setColdStatusFilter('new')}>
                      Neu ({coldStats.new})
                    </button>
                    <button className={`btn ${coldStatusFilter==='analyzed'?'btn-info':'btn-outline-secondary'}`} onClick={()=>setColdStatusFilter('analyzed')}>
                      Analysiert ({coldStats.analyzed})
                    </button>
                    <button className={`btn ${coldStatusFilter==='contacted'?'btn-success':'btn-outline-secondary'}`} onClick={()=>setColdStatusFilter('contacted')}>
                      Kontaktiert ({coldStats.contacted})
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="thead-light">
                      <tr>
                        <th className="border-0"><i className="bi bi-building mr-1"/>Firma</th>
                        <th className="border-0"><i className="bi bi-globe mr-1"/>Website</th>
                        <th className="border-0"><i className="bi bi-briefcase mr-1"/>Branche</th>
                        <th className="border-0"><i className="bi bi-geo-alt mr-1"/>Region</th>
                        <th className="border-0 text-center"><i className="bi bi-star mr-1"/>Score</th>
                        <th className="border-0 text-center">Status</th>
                        <th className="border-0 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coldProspects.map((p, i) => (
                        <tr key={i}>
                          <td className="align-middle font-weight-bold">{p.company_name || 'Unbekannt'}</td>
                          <td className="align-middle"><a href={p.website} target="_blank" rel="noopener" className="text-info text-truncate d-inline-block" style={{maxWidth:250}}>{p.website}</a></td>
                          <td className="align-middle"><span className="badge badge-light">{p.industry}</span></td>
                          <td className="align-middle">{p.region}</td>
                          <td className="align-middle text-center">{p.score ? <span className={`badge badge-${p.score>=70?'success':p.score>=50?'info':'secondary'}`}>{p.score}/100</span> : <span className="text-muted">-</span>}</td>
                          <td className="align-middle text-center">
                            <span className={`badge badge-${p.status==='new'?'secondary':p.status==='analyzed'?'info':'success'}`} style={{minWidth:90}}>
                              {p.status==='new'?'🆕 Neu':p.status==='analyzed'?'🔍 Analysiert':'✅ Kontaktiert'}
                            </span>
                          </td>
                          <td className="align-middle text-right">
                            {p.status === 'new' && (
                              <button className="btn btn-sm btn-info" onClick={() => analyzeProspect(p)} disabled={coldLoading}>
                                <i className="bi bi-search mr-1"/>{coldLoading ? 'Lädt...' : 'Analysieren'}
                              </button>
                            )}
                            {p.status === 'analyzed' && (
                              <>
                                <button className="btn btn-sm btn-outline-info mr-1" onClick={() => setSelectedProspect(p)} disabled={coldLoading}>
                                  <i className="bi bi-eye mr-1"/>Details
                                </button>
                                <button className="btn btn-sm btn-success" onClick={() => generateColdEmail(p)} disabled={coldLoading}>
                                  <i className="bi bi-envelope mr-1"/>Email
                                </button>
                              </>
                            )}
                            {p.status === 'contacted' && (
                              <span className="badge badge-pill badge-success px-3"><i className="bi bi-check-circle mr-1"/>Versendet</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Detail-Ansicht - moderner */}
          {selectedProspect && selectedProspect.analysis && (
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
                            {selectedProspect.analysis.needs_assessment.potential_products.map((p, i) => (
                              <span key={i} className="badge badge-success mr-1 mb-1">{p}</span>
                            ))}
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

          {/* Email-Vorschau - moderner */}
          {generatedEmail && (
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

      {activeTab!=='dashboard' && activeTab!=='outbound' && activeTab!=='sales' && activeTab!=='marketing' && activeTab!=='coldleads' && (
        <div className="text-muted">Dieser Bereich ist für die nächste Iteration vorgesehen.</div>
      )}

      {/* Toast */}
      {toast && (
        <div className="alert alert-info position-fixed" style={{right:12, bottom:12, zIndex:1060}} onClick={()=>setToast('')}>{toast}</div>
      )}

      {/* Request Inspector - nur bei Dashboard/Outbound/Sales/Marketing */}
      {activeTab !== 'coldleads' && activeTab !== 'settings' && (
        <div className="position-fixed" style={{right:12, bottom:54, zIndex:1059, width:320}}>
          <div className="card" style={{opacity:.95}}>
            <div className="card-header py-1 px-2 d-flex justify-content-between align-items-center">
              <span className="small">Request Inspector</span>
              <span className="small text-muted">{netlog?.[0]?.ms? `${netlog[0].ms} ms` : ''}</span>
            </div>
            <div className="card-body p-2" style={{maxHeight:160, overflowY:'auto'}}>
              {(netlog||[]).map((r,i)=> (
                <div key={i} className="small mb-1">
                  <div className="d-flex justify-content-between"><span>{r.at||''}</span><span className={r.ok? 'text-success':'text-danger'}>{r.ok? 'OK':'ERR'} {r.status}</span></div>
                  <div className="text-muted" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.url}</div>
                  {r.error && <div className="text-danger">{String(r.error).slice(0,120)}</div>}
                  <hr className="my-1"/>
                </div>
              ))}
              {netlog?.length===0 && <div className="text-muted small">Keine Requests</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
