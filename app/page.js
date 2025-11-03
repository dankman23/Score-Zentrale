'use client'

import { useEffect, useRef, useState } from 'react'

function KpiTile({ title, value, sub }) {
  return (
    <div className="col-md-4 mb-3">
      <div className="card bg-secondary text-light border-0 h-100">
        <div className="card-body">
          <div className="text-uppercase text-muted small mb-1">{title}</div>
          <div className="h3 mb-0">{value}</div>
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
  const [form, setForm] = useState({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'' })
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

  const refreshProspects = async () => {
    try {
      const res = await fetch('/api/prospects')
      const data = await res.json()
      setProspects(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  const renderCharts = (data) => {
    if (!window.Chart) return
    // Umsatz vs Ads-Kosten
    const labels = (data?.jtl?.series || []).map(s => s.date)
    const revenue = (data?.jtl?.series || []).map(s => s.revenue)
    const adsCost = (data?.ads?.series || []).map(s => s.cost)
    const ctx1 = revChartRef.current?.getContext('2d')
    if (ctx1) {
      if (revChart.current) revChart.current.destroy()
      revChart.current = new window.Chart(ctx1, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Umsatz (JTL)', data: revenue, borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.2)', tension: 0.3 },
            { label: 'Ads-Kosten', data: adsCost, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)', tension: 0.3 }
          ]
        },
        options: { plugins:{ legend:{ labels:{ color:'#ddd'} } }, scales:{ x:{ ticks:{ color:'#aaa'} }, y:{ ticks:{ color:'#aaa'} } } }
      })
    }

    // Top-Kampagnen
    const labels2 = (data?.ads?.campaigns || []).map(c => c.name)
    const roas = (data?.ads?.campaigns || []).map(c => c.roas)
    const ctx2 = campChartRef.current?.getContext('2d')
    if (ctx2) {
      if (campChart.current) campChart.current.destroy()
      campChart.current = new window.Chart(ctx2, {
        type: 'bar',
        data: { labels: labels2, datasets: [{ label: 'ROAS', data: roas, backgroundColor: ['#38bdf8','#34d399','#f59e0b'] }] },
        options: { plugins:{ legend:{ labels:{ color:'#ddd'} } }, scales:{ x:{ ticks:{ color:'#aaa'} }, y:{ ticks:{ color:'#aaa'} } } }
      })
    }
  }

  const submitProspect = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/prospects', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      setForm({ name:'', website:'', region:'', industry:'', size:'', linkedinUrl:'' })
      await refreshProspects()
    } catch (e) {
      console.error(e)
    }
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

  return (
    <div>
      {/* Tabs */}
      <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <a className={`nav-link ${activeTab==='dashboard'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault();setActiveTab('dashboard')}}>Dashboard</a>
        </li>
        <li className="nav-item">
          <a className={`nav-link ${activeTab==='outbound'?'active':''}`} href="#" onClick={(e)=>{e.preventDefault();setActiveTab('outbound')}}>Outbound Suite</a>
        </li>
      </ul>

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

          <div className="row mt-2">
            <div className="col-md-8 mb-3">
              <div className="card bg-secondary text-light border-0">
                <div className="card-header bg-transparent border-0">Umsatz & Ads-Kosten</div>
                <div className="card-body"><canvas ref={revChartRef} height="120" /></div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card bg-secondary text-light border-0">
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
            <div className="col-md-5 mb-4">
              <div className="card bg-secondary text-light border-0 h-100">
                <div className="card-header bg-transparent border-0">Prospect Finder</div>
                <div className="card-body">
                  <form onSubmit={submitProspect}>
                    <div className="form-group">
                      <label>Firma</label>
                      <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0"/>
                    </div>
                    <div className="form-group">
                      <label>Website</label>
                      <input value={form.website} onChange={e=>setForm({...form, website:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0" placeholder="https://..."/>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-6">
                        <label>Region (Bundesland/PLZ)</label>
                        <input value={form.region} onChange={e=>setForm({...form, region:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0"/>
                      </div>
                      <div className="form-group col-md-6">
                        <label>Branche</label>
                        <input value={form.industry} onChange={e=>setForm({...form, industry:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0"/>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group col-md-6">
                        <label>Größe</label>
                        <select value={form.size} onChange={e=>setForm({...form, size:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0">
                          <option value="">-</option>
                          <option>1-10</option>
                          <option>11-50</option>
                          <option>51-200</option>
                          <option>200+</option>
                        </select>
                      </div>
                      <div className="form-group col-md-6">
                        <label>LinkedIn URL</label>
                        <input value={form.linkedinUrl} onChange={e=>setForm({...form, linkedinUrl:e.target.value})} className="form-control form-control-sm bg-dark text-light border-0"/>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-warning btn-sm">Speichern</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-md-7 mb-4">
              <div className="card bg-secondary text-light border-0 h-100">
                <div className="card-header bg-transparent border-0">Prospects</div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-dark table-hover table-sm mb-0">
                      <thead><tr><th>Name</th><th>Website</th><th>Region</th><th>Branche</th><th>Score</th><th></th></tr></thead>
                      <tbody>
                        {(prospects||[]).map(p => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td><a className="text-info" href={p.website} target="_blank" rel="noreferrer">{p.website}</a></td>
                            <td>{p.region}</td>
                            <td>{p.industry}</td>
                            <td>{p.score}</td>
                            <td>
                              <button className="btn btn-outline-light btn-sm" onClick={()=>analyzeCompany(p)}>Analysieren</button>
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
          <div className="card bg-secondary text-light border-0">
            <div className="card-header bg-transparent border-0">Mail Composer</div>
            <div className="card-body">
              <form onSubmit={generateMail}>
                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Firma</label>
                    <input className="form-control form-control-sm bg-dark text-light border-0" value={compose.company} onChange={e=>setCompose({...compose, company:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-4">
                    <label>Rolle</label>
                    <input className="form-control form-control-sm bg-dark text-light border-0" value={compose.contactRole} onChange={e=>setCompose({...compose, contactRole:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-4">
                    <label>Branche</label>
                    <input className="form-control form-control-sm bg-dark text-light border-0" value={compose.industry} onChange={e=>setCompose({...compose, industry:e.target.value})}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Use-Cases (kommagetrennt)</label>
                    <input className="form-control form-control-sm bg-dark text-light border-0" value={compose.useCases} onChange={e=>setCompose({...compose, useCases:e.target.value})}/>
                  </div>
                  <div className="form-group col-md-6">
                    <label>Hypothesen (frei)</label>
                    <input className="form-control form-control-sm bg-dark text-light border-0" value={compose.hypotheses} onChange={e=>setCompose({...compose, hypotheses:e.target.value})} placeholder="z.B. Bänder 50×2000 K80; Fiberscheiben Ø125 K60"/>
                  </div>
                </div>
                <button className="btn btn-warning btn-sm" type="submit">E-Mail generieren</button>
              </form>

              {mail && (
                <div className="mt-3">
                  <div className="mb-2"><strong>Betreff:</strong> {mail.subject}</div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="small text-muted mb-1">Text</div>
                      <pre className="bg-dark text-light p-2 rounded" style={{minHeight:120}}>{mail.text}</pre>
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
    </div>
  )
}
