'use client'

import { useState, useEffect } from 'react'

const CHANNEL_LABELS = {
  shop: { name: 'Online-Shop', icon: '🛒', color: 'primary' },
  direktvertrieb: { name: 'Direktvertrieb', icon: '📞', color: 'success' },
  amazon: { name: 'Amazon', icon: '📦', color: 'warning' },
  ebay: { name: 'eBay', icon: '🏷️', color: 'info' },
  otto: { name: 'Otto', icon: '🏢', color: 'secondary' },
  unknown: { name: 'Unbekannt', icon: '❓', color: 'secondary' }
}

export default function KundenView() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [sort, setSort] = useState('revenue')
  const [stats, setStats] = useState(null)
  
  // Modal für Bestellhistorie
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  
  useEffect(() => {
    loadCustomers()
  }, [filter, channelFilter, sort])
  
  async function loadCustomers() {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/list?filter=${filter}&channel=${channelFilter}&sort=${sort}&limit=100`)
      const data = await res.json()
      if (data.ok) {
        setCustomers(data.customers || [])
        setStats(data.filters || {})
      }
    } catch (e) {
      console.error('Fehler beim Laden:', e)
    } finally {
      setLoading(false)
    }
  }
  
  async function syncJTL() {
    if (!confirm('JTL-Kunden synchronisieren?\n\nDies kann einige Minuten dauern.')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/coldleads/jtl-customers/sync-daily', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        alert(`✅ Sync erfolgreich!\n\nNeu: ${data.new_customers}\nAktualisiert: ${data.updated}\nUnverändert: ${data.unchanged}`)
        loadCustomers()
      } else {
        alert('❌ Sync fehlgeschlagen: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function showOrders(customer) {
    setSelectedCustomer(customer)
    setOrdersLoading(true)
    setOrders([])
    
    try {
      const res = await fetch(`/api/customers/orders?kKunde=${customer.jtl_customer.kKunde}`)
      const data = await res.json()
      if (data.ok) {
        setOrders(data.orders || [])
      } else {
        alert('❌ Fehler beim Laden der Bestellungen: ' + data.error)
      }
    } catch (e) {
      alert('❌ Fehler: ' + e.message)
    } finally {
      setOrdersLoading(false)
    }
  }
  
  function closeOrdersModal() {
    setSelectedCustomer(null)
    setOrders([])
  }
  
  const fmtCurrency = (val) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0)
  }
  
  const fmtDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('de-DE')
  }
  
  return (
    <div>
      <style jsx>{`
        .kunden-table tbody td {
          color: #e5e7eb !important;
        }
        .kunden-table tbody td strong {
          color: #f3f4f6 !important;
        }
        .kunden-table thead th {
          color: #1f2937 !important;
        }
      `}</style>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="mb-1"><i className="bi bi-building mr-2"/>Kunden-Übersicht</h2>
          <p className="text-muted small mb-0">Zentrale Kundendatenbank mit B2B-Klassifizierung & Kanal-Analyse</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={syncJTL}
          disabled={loading}
        >
          <i className="bi bi-arrow-repeat mr-1"/>JTL-Sync
        </button>
      </div>
      
      {/* Statistik-Kacheln */}
      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-muted small">B2B-Kunden</div>
                    <h3 className="mb-0">{stats.b2b || 0}</h3>
                  </div>
                  <i className="bi bi-briefcase" style={{fontSize:'2rem', color:'#667eea'}}/>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-muted small">B2C-Kunden</div>
                    <h3 className="mb-0">{stats.b2c || 0}</h3>
                  </div>
                  <i className="bi bi-person" style={{fontSize:'2rem', color:'#f093fb'}}/>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="text-muted small mb-2">Kanäle</div>
                <div className="d-flex flex-wrap gap-2">
                  {Object.entries(stats.channels || {}).map(([channel, count]) => {
                    const label = CHANNEL_LABELS[channel] || CHANNEL_LABELS.unknown
                    return (
                      <span key={channel} className={`badge badge-${label.color} p-2`}>
                        {label.icon} {label.name}: {count}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <label className="small text-muted mb-1">B2B/B2C Filter</label>
              <div className="btn-group btn-group-sm d-flex">
                <button 
                  className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('all')}
                >
                  Alle
                </button>
                <button 
                  className={`btn ${filter === 'b2b' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('b2b')}
                >
                  B2B
                </button>
                <button 
                  className={`btn ${filter === 'b2c' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('b2c')}
                >
                  B2C
                </button>
              </div>
            </div>
            <div className="col-md-4">
              <label className="small text-muted mb-1">Kanal</label>
              <select 
                className="form-control form-control-sm"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="all">Alle Kanäle</option>
                <option value="shop">🛒 Online-Shop</option>
                <option value="direktvertrieb">📞 Direktvertrieb</option>
                <option value="amazon">📦 Amazon</option>
                <option value="ebay">🏷️ eBay</option>
                <option value="otto">🏢 Otto</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="small text-muted mb-1">Sortierung</label>
              <select 
                className="form-control form-control-sm"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="revenue">Umsatz (hoch → niedrig)</option>
                <option value="orders">Bestellungen (viele → wenige)</option>
                <option value="last_order">Letzte Bestellung (neu → alt)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabelle */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Laden...</span>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{fontSize:'3rem', color:'#ccc'}}/>
              <h5 className="mt-3">Keine Kunden gefunden</h5>
              <p className="text-muted">Führen Sie einen JTL-Sync aus, um Kunden zu laden.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 kunden-table">
                <thead className="bg-light">
                  <tr>
                    <th className="text-dark">Name</th>
                    <th className="text-dark text-right">Gesamtumsatz</th>
                    <th className="text-dark text-right">Anz. Best.</th>
                    <th className="text-dark text-center">B2B</th>
                    <th className="text-dark">Kanal</th>
                    <th className="text-dark">Letzte Bestellung</th>
                    <th className="text-dark">Hauptartikel</th>
                  </tr>
                </thead>
                <tbody style={{color: '#e5e7eb'}}>
                  {customers.map((c) => {
                    const channelLabel = CHANNEL_LABELS[c.last_order_channel || c.primary_channel] || CHANNEL_LABELS.unknown
                    
                    // Name zusammenstellen: Firma + Vorname + Nachname
                    let fullName = c.company_name || ''
                    const vorname = c.jtl_customer?.vorname
                    const nachname = c.jtl_customer?.nachname
                    if (vorname || nachname) {
                      const personName = [vorname, nachname].filter(Boolean).join(' ')
                      if (fullName && personName) {
                        fullName = `${fullName} (${personName})`
                      } else if (personName) {
                        fullName = personName
                      }
                    }
                    
                    return (
                      <tr key={c._id}>
                        <td style={{color: '#e5e7eb'}}>
                          <div className="font-weight-bold">{fullName}</div>
                          {c.email && (
                            <small style={{color: '#9ca3af'}}>{c.email}</small>
                          )}
                        </td>
                        <td className="text-right" style={{color: '#e5e7eb'}}>
                          <strong>{fmtCurrency(c.total_revenue)}</strong>
                        </td>
                        <td className="text-right" style={{color: '#e5e7eb'}}>
                          <strong>{c.total_orders || 0}</strong>
                        </td>
                        <td className="text-center">
                          {c.is_b2b ? (
                            <i className="bi bi-check-circle-fill text-success" style={{fontSize: '1.2rem'}} title={`B2B (${c.b2b_confidence}% Confidence)`}/>
                          ) : (
                            <i className="bi bi-dash-circle text-muted" style={{fontSize: '1.2rem'}} title="B2C"/>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${channelLabel.color}`}>
                            {channelLabel.icon} {channelLabel.name}
                          </span>
                        </td>
                        <td style={{color: '#e5e7eb'}}>
                          {fmtDate(c.last_order)}
                        </td>
                        <td>
                          {c.hauptartikel ? (
                            <span className="badge badge-info">
                              {c.hauptartikel}
                            </span>
                          ) : (
                            <span style={{color: '#9ca3af'}} className="small">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center mt-3 text-muted small">
        {customers.length} Kunden angezeigt
      </div>
    </div>
  )
}
