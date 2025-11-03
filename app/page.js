'use client'

import { useEffect, useRef, useState } from 'react'
import { toArray, sortByDateAsc } from './lib/normalize'
import { getJson } from './lib/api'

function KpiTile({ title, value, sub }) {
  return (
    <div className="col-md-4 mb-3">
      <div className="card kpi h-100">
        <div className="card-body">
          <div className="label mb-1 text-uppercase small">{title}</div>
          <div className="value mb-0">{value}</div>
          {sub ? <div className="text-muted small mt-1">{sub}</div> : null}
        </div>
      </div>
    </div>
  )
}

const fmtCurrency = (n) => `€ ${Number(n||0).toLocaleString('de-DE')}`

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [from, setFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })
  const [to, setTo] = useState(()=> new Date().toISOString().slice(0,10))

  const [kpi, setKpi] = useState(null)
  const [kpiFees, setKpiFees] = useState(null)
  const [ts, setTs] = useState([])
  const [tsFees, setTsFees] = useState([])
  const [platTs, setPlatTs] = useState([])
  const [stacked, setStacked] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const revChartRef = useRef(null)
  const platChartRef = useRef(null)
  const revChart = useRef(null)
  const platChart = useRef(null)

  const [prospects, setProspects] = useState([])
  const [form, setForm] = useState({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'', keywords:'' })
  const [compose, setCompose] = useState({ company:'', contactRole:'Einkauf', industry:'', useCases:'', hypotheses:'' })
  const [mail, setMail] = useState(null)

  const [salesTab, setSalesTab] = useState('products')
  const [topProducts, setTopProducts] = useState([])
  const [topCategories, setTopCategories] = useState([])
  const [limit, setLimit] = useState(20)

  const fetchAll = async () => {
    setLoading(true); setError('')
    try {
      const [k1, k2, t1, t2, p] = await Promise.all([
        getJson(`/api/jtl/sales/kpi?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/kpi/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/timeseries/with_platform_fees?from=${from}&to=${to}`),
        getJson(`/api/jtl/sales/platform-timeseries?from=${from}&to=${to}`),
      ])
      const tsN = sortByDateAsc(toArray(t1))
      const tsFeesN = sortByDateAsc(toArray(t2))
      const platN = sortByDateAsc(toArray(p))
      setKpi(k1); setKpiFees(k2); setTs(tsN); setTsFees(tsFeesN); setPlatTs(platN)
    } catch (e) { setError(String(e)); }
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
    } catch(e){ console.error(e) }
  }

  useEffect(() => { fetchAll(); fetchSalesTables(); refreshProspects() }, [])
  useEffect(() => { fetchAll(); fetchSalesTables() }, [from, to, limit])

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
        // draw placeholder background
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

  return (
    <div>
      {/* Tabs */}
      <ul className="nav nav-pills mb-4">
        {['dashboard','outbound','sales','marketing','settings'].map(t => (
          <li key={t} className="nav-item">
            <a className={`nav-link ${activeTab===t?'active':''}`} href={`#${t}`} onClick={(e)=>{e.preventDefault(); setActiveTab(t); location.hash = t}}>{t[0].toUpperCase()+t.slice(1)}</a>
          </li>
        ))}
      </ul>

      {/* Date Range */}
      <div className="mb-3 d-flex align-items-center">
        <div className="mr-2 small text-muted">Zeitraum:</div>
        <input type="date" className="form-control form-control-sm mr-2" style={{maxWidth:160}} value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" className="form-control form-control-sm mr-2" style={{maxWidth:160}} value={to} onChange={e=>setTo(e.target.value)} />
        <button className="btn btn-outline-primary btn-sm" onClick={()=>{fetchAll(); fetchSalesTables()}}>Aktualisieren</button>
      </div>

      {activeTab==='dashboard' && (
        <div>
          <div className="row">
            <KpiTile title="Umsatz (30T)" value={fmtCurrency(kpi?.revenue)} sub="JTL Wawi" />
            <KpiTile title="Bestellungen (30T)" value={(kpi?.orders||'-').toLocaleString?.('de-DE')||kpi?.orders||'-'} sub="JTL Wawi" />
            <KpiTile title="Marge (30T)" value={fmtCurrency(kpi?.margin)} sub="ohne Gebühren" />
          </div>
          <div className="row">
            <KpiTile title="Marge (mit Gebühren)" value={fmtCurrency(kpiFees?.margin_with_fees)} sub="inkl. 1,50 € + 20% Plattformgebühr" />
            <KpiTile title="" value="" />
            <KpiTile title="" value="" />
          </div>

          <div className="row mt-1">
            <div className="col-md-8 mb-3">
              <div className="card">
                <div className="card-header bg-transparent border-0">Umsatz & Marge (mit Gebühren)</div>
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

      {activeTab!=='dashboard' && activeTab!=='outbound' && activeTab!=='sales' && (
        <div className="text-muted">Dieser Bereich ist für die nächste Iteration vorgesehen.</div>
      )}
    </div>
  )
}
