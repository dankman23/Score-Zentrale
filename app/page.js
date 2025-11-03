'use client'

import { useEffect, useRef, useState } from 'react'

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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  const revChartRef = useRef(null)
  const campChartRef = useRef(null)
  const revChart = useRef(null)
  const campChart = useRef(null)

  const [prospects, setProspects] = useState([])
  const [form, setForm] = useState({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'', keywords:'' })
  const [compose, setCompose] = useState({ company:'', contactRole:'Einkauf', industry:'', useCases:'', hypotheses:'' })
  const [mail, setMail] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/kpis')
        const data = await res.json()
        setKpis(data)
        setLoading(false)
        setTimeout(() => renderCharts(data), 50)
      } catch (e) {
        console.error(e)
        setLoading(false)
      }
    }
    load()
    refreshProspects()
  }, [])

  useEffect(() => {
    const applyHash = () => {
      const h = (window.location.hash || '#dashboard').replace('#','')
      setActiveTab(h)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const refreshProspects = async () => {
    try {
      const res = await fetch('/api/prospects')
      const data = await res.json()
      setProspects(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
  }

  const renderCharts = (data) => {
    if (!window.Chart) return
    const labels = (data?.jtl?.series || []).map(s => s.date)
    const revenue = (data?.jtl?.series || []).map(s => s.revenue)
    const adsCost = (data?.ads?.series || []).map(s => s.cost)
    const ctx1 = revChartRef.current?.getContext('2d')
    if (ctx1) {
      if (revChart.current) revChart.current.destroy()
      revChart.current = new window.Chart(ctx1, {
        type: 'line',
        data: { labels, datasets: [
          { label: 'Umsatz (JTL)', data: revenue, borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.2)', tension: 0.3 },
          { label: 'Ads-Kosten', data: adsCost, borderColor: '#f6b10a', backgroundColor: 'rgba(246,177,10,0.2)', tension: 0.3 },
        ]},
        options: { plugins:{ legend:{ labels:{ color:'var(--txt)'} } }, scales:{ x:{ ticks:{ color:'var(--muted)'} }, y:{ ticks:{ color:'var(--muted)'} } } }
      })
    }
    const labels2 = (data?.ads?.campaigns || []).map(c => c.name)
    const roas = (data?.ads?.campaigns || []).map(c => c.roas)
    const ctx2 = campChartRef.current?.getContext('2d')
    if (ctx2) {
      if (campChart.current) campChart.current.destroy()
      campChart.current = new window.Chart(ctx2, {
        type: 'bar',
        data: { labels: labels2, datasets: [{ label: 'ROAS', data: roas, backgroundColor: ['#38bdf8','#34d399','#f6b10a'] }] },
        options: { plugins:{ legend:{ labels:{ color:'var(--txt)'} } }, scales:{ x:{ ticks:{ color:'var(--muted)'} }, y:{ ticks:{ color:'var(--muted)'} } } }
      })
    }
  }

  const submitProspect = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/prospects', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) })
      await res.json()
      setForm({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'', keywords:'' })
      await refreshProspects()
    } catch (e) { console.error(e) }
  }

  const analyzeCompany = async (p) => {
    try {
      const res = await fetch('/api/analyze', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name: p.name, website: p.website, industry: p.industry }) })
      const data = await res.json()
      alert('Analyse erstellt. Produktgruppen: ' + (data?.productGroups || []).join(', '))
    } catch (e) { console.error(e) }
  }

  const generateMail = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/mailer/compose', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...compose, useCases: compose.useCases.split(',').map(s=>s.trim()), hypotheses: compose.hypotheses }) })
      const data = await res.json()
      setMail(data)
    } catch (e) { console.error(e) }
  }

  const exportCSV = () => {
    const rows = [['Name','Website','Region','Branche','Größe','Score']].concat((prospects||[]).map(p=>[p.name,p.website,p.region,p.industry,p.size,p.score]))
    const csv = rows.map(r=>r.map(x=>`"${(x||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='prospects.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Desktop: Inhalt ohne linke Rail */}
      {activeTab==='dashboard' && (
        <div>
          <div className="row">
            <KpiTile title="Umsatz (30T)" value={`€ ${kpis?.jtl?.totals?.revenue?.toLocaleString() || '-'}`} sub="JTL Wawi (Mock)" />
            <KpiTile title="Bestellungen (30T)" value={kpis?.jtl?.totals?.orders?.toLocaleString() || '-'} sub="JTL Wawi (Mock)" />
            <KpiTile title="Marge (30T)" value={`€ ${kpis?.jtl?.totals?.margin?.toLocaleString() || '-'}`} sub="JTL Wawi (Mock)" />
          </div>
          <div className="row">
            <KpiTile title="Ads-Kosten (30T)" value={`€ ${kpis?.ads?.totals?.cost?.toLocaleString() || '-'}`} sub={`ROAS ${kpis?.ads?.totals?.roas || '-'}`}/>
            <KpiTile title="Clicks (30T)" value={kpis?.ads?.totals?.clicks?.toLocaleString() || '-'} sub="Google Ads (Mock)" />
            <KpiTile title="Users (30T)" value={kpis?.ga4?.totals?.users?.toLocaleString() || '-'} sub="GA4 (Mock)" />
          </div>

          <div className="row mt-1">
            <div className="col-md-8 mb-3">
              <div className="card">
                <div className="card-header bg-transparent border-0">Umsatz & Ads-Kosten</div>
                <div className="card-body"><canvas ref={revChartRef} height="120" /></div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card">
                <div className="card-header bg-transparent border-0">Top-Kampagnen (ROAS)</div>
                <div className="card-body"><canvas ref={campChartRef} height="120" /></div>
              </div>
            </div>
          </div>
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
                    <button className="btn btn-outline-primary btn-sm mr-2" onClick={exportCSV}><i className="bi bi-download mr-1"/>CSV</button>
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

      {activeTab!=='dashboard' && activeTab!=='outbound' && (
        <div className="text-muted">Dieser Bereich ist für die nächste Iteration vorgesehen.</div>
      )}

      {/* Bottom Tabbar ist global in layout.js */}
    </div>
  )
}
