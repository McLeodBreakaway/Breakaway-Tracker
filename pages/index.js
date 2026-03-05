import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MEDAL = ['🥇', '🥈', '🥉']
const SALE_TYPE_OPTIONS = ['Whole Life', 'Term Life', 'Universal Life', 'Other']
const LEAD_AGE_OPTIONS = ['Fresh', 'Aged', 'Referral', 'Self-Generated']
const FIELD_TELE_OPTIONS = ['Tele-sale', 'Field']
const ADMIN_PIN = '127$'

const fmt = (num) => Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)
function getWeekRange() {
  const now = new Date()
  const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay())
  const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6)
  return { start: sunday.toISOString().slice(0, 10), end: saturday.toISOString().slice(0, 10) }
}

const EMPTY_FORM = { ap: '', apps: '', doorsKnocked: '', dials: '', contacts: '', appts: '', presentations: '', sales: '', recruiting: '', rideAlong: '', hoursWorked: '', minutesWorked: '' }
const EMPTY_SALE = { saleType: '', carrier: '', leadType: '', faceAmount: '', annualPremium: '', leadAge: '', fieldTele: '', draftDate: today() }

const inp = { display: 'block', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #2a3a5c', background: '#0d1526', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { fontSize: 10, color: '#7a8ab0', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: 5 }
const sec = { fontSize: 11, color: '#3d5af1', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid #1e2d4a', paddingBottom: 8, margin: '20px 0 14px' }

export default function App() {
  const [view, setView] = useState('leaderboard')
  const [agents, setAgents] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saleDetails, setSaleDetails] = useState([{ ...EMPTY_SALE }])
  const [newAgentName, setNewAgentName] = useState('')
  const [flash, setFlash] = useState(null)
  const [adminPin, setAdminPin] = useState('')
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState(null)
  const [expandedSale, setExpandedSale] = useState(null)
  const { start, end } = getWeekRange()

  const showFlash = (msg, type = 'success') => { setFlash({ msg, type }); setTimeout(() => setFlash(null), 3000) }

  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const { data: agentsData } = await supabase.from('agents').select('*').order('name')
      if (!agentsData) return
      const { data: entriesData } = await supabase.from('entries').select('*').gte('entry_date', start).lte('entry_date', end)
      const { data: salesData } = await supabase.from('sale_details').select('*')
      const board = agentsData.map((agent) => {
        const ae = (entriesData || []).filter((e) => e.agent_id === agent.id)
        const as_ = (salesData || []).filter((s) => s.agent_id === agent.id)
        return {
          ...agent,
          totalAP: ae.reduce((s, e) => s + Number(e.ap || 0), 0),
          totalApps: ae.reduce((s, e) => s + (e.apps || 0), 0),
          totalDials: ae.reduce((s, e) => s + (e.dials || 0), 0),
          totalContacts: ae.reduce((s, e) => s + (e.contacts || 0), 0),
          totalAppts: ae.reduce((s, e) => s + (e.appts || 0), 0),
          totalPresentations: ae.reduce((s, e) => s + (e.presentations || 0), 0),
          totalSales: ae.reduce((s, e) => s + (e.sales || 0), 0),
          totalRecruiting: ae.reduce((s, e) => s + (e.recruiting || 0), 0),
          totalMinutes: ae.reduce((s, e) => s + (e.hours_worked || 0) * 60 + (e.minutes_worked || 0), 0),
          totalDoors: ae.reduce((s, e) => s + (e.doors_knocked || 0), 0),
          rideAlongs: ae.filter((e) => e.ride_along === 'Yes').length,
          allSales: as_,
        }
      }).filter((a) => a.totalAP > 0 || a.totalApps > 0 || a.totalDials > 0 || a.totalDoors > 0)
        .sort((a, b) => b.totalAP - a.totalAP)
      setAgents(agentsData)
      setLeaderboard(board)
    } finally { setLoading(false) }
  }, [start, end])

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { const i = setInterval(loadLeaderboard, 60000); return () => clearInterval(i) }, [loadLeaderboard])

  const fv = (k) => parseInt(form[k]) || 0
  const ff = (k) => parseFloat(form[k]) || 0

  const submitEntry = async () => {
    if (!selectedAgent) return showFlash('Select your name first.', 'error')
    if (ff('ap') <= 0 && fv('dials') <= 0 && fv('doorsKnocked') <= 0) return showFlash('Enter at least one stat.', 'error')
    setSubmitting(true)
    try {
      const { data: entry, error } = await supabase.from('entries').insert({
        agent_id: selectedAgent, ap: ff('ap'), apps: fv('apps'),
        doors_knocked: fv('doorsKnocked'), dials: fv('dials'), contacts: fv('contacts'),
        appts: fv('appts'), presentations: fv('presentations'), sales: fv('sales'),
        recruiting: fv('recruiting'), ride_along: form.rideAlong || '',
        hours_worked: fv('hoursWorked'), minutes_worked: fv('minutesWorked'), entry_date: today(),
      }).select().single()
      if (error) throw error
      const filledSales = saleDetails.filter((s) => s.carrier || s.saleType || s.annualPremium)
      if (filledSales.length > 0) {
        await supabase.from('sale_details').insert(filledSales.map((s) => ({
          entry_id: entry.id, agent_id: selectedAgent, sale_type: s.saleType,
          carrier: s.carrier, lead_type: s.leadType, face_amount: parseFloat(s.faceAmount) || 0,
          annual_premium: parseFloat(s.annualPremium) || 0, lead_age: s.leadAge,
          field_tele: s.fieldTele, draft_date: s.draftDate || today(),
        })))
      }
      setForm(EMPTY_FORM); setSaleDetails([{ ...EMPTY_SALE }])
      showFlash('Stats logged! 🔥'); setView('leaderboard'); await loadLeaderboard()
    } catch (err) { showFlash('Error saving. Try again.', 'error'); console.error(err) }
    finally { setSubmitting(false) }
  }

  const addAgent = async () => {
    if (!newAgentName.trim()) return showFlash('Enter a name.', 'error')
    const { error } = await supabase.from('agents').insert({ name: newAgentName.trim() })
    if (error) return showFlash('Agent already exists.', 'error')
    setNewAgentName(''); showFlash('Agent added!'); await loadLeaderboard()
  }

  const removeAgent = async (id) => {
    if (!confirm('Remove this agent and all their data?')) return
    await supabase.from('sale_details').delete().eq('agent_id', id)
    await supabase.from('entries').delete().eq('agent_id', id)
    await supabase.from('agents').delete().eq('id', id)
    showFlash('Agent removed.'); await loadLeaderboard()
  }

  const clearWeek = async () => {
    if (!confirm('Clear ALL entries for this week?')) return
    const { data: we } = await supabase.from('entries').select('id').gte('entry_date', start).lte('entry_date', end)
    if (we?.length) { const ids = we.map((e) => e.id); await supabase.from('sale_details').delete().in('entry_id', ids); await supabase.from('entries').delete().in('id', ids) }
    showFlash('Week cleared.'); await loadLeaderboard()
  }

  const fmtTime = (m) => { if (!m) return '—'; const h = Math.floor(m / 60), mn = m % 60; return h > 0 ? `${h}h ${mn}m` : `${mn}m` }
  const contactRate = (a) => a.totalDials > 0 ? ((a.totalContacts / a.totalDials) * 100).toFixed(1) + '%' : '—'
  const closeRate = (a) => a.totalPresentations > 0 ? ((a.totalSales / a.totalPresentations) * 100).toFixed(1) + '%' : '—'
  const teamAP = leaderboard.reduce((s, a) => s + a.totalAP, 0)
  const teamApps = leaderboard.reduce((s, a) => s + a.totalApps, 0)
  const teamDials = leaderboard.reduce((s, a) => s + a.totalDials, 0)
  const teamSales = leaderboard.reduce((s, a) => s + a.totalSales, 0)
  const addSaleRow = () => setSaleDetails([...saleDetails, { ...EMPTY_SALE, draftDate: today() }])
  const removeSaleRow = (i) => setSaleDetails(saleDetails.filter((_, idx) => idx !== i))
  const updateSale = (i, f, v) => { const u = [...saleDetails]; u[i] = { ...u[i], [f]: v }; setSaleDetails(u) }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0e1a 0%,#0d1526 50%,#0a1020 100%)', fontFamily: "'Segoe UI',system-ui,sans-serif", color: '#e8eaf6' }}>
      <Head><title>Breakaway Tracker</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={{ background: 'linear-gradient(90deg,#1a2340,#0f1929)', borderBottom: '2px solid #2a3a5c', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>Breakaway Tracker</div>
            <div style={{ fontSize: 10, color: '#7a8ab0' }}>Final Expense Team</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['leaderboard', 'entry', 'admin'].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11, background: view === v ? '#3d5af1' : '#1e2d4a', color: view === v ? '#fff' : '#8a9bbf' }}>
              {v === 'leaderboard' ? '📊 Board' : v === 'entry' ? '➕ Log' : '⚙️ Admin'}
            </button>
          ))}
        </div>
      </div>
      {flash && <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: flash.type === 'error' ? '#c0392b' : '#27ae60', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>{flash.msg}</div>}
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '16px' }}>
        {view === 'leaderboard' && (
          <div>
            <div style={{ background: '#111c33', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1e2d4a' }}>
              <span style={{ fontSize: 12, color: '#7a8ab0' }}>📅 {start} → {end}</span>
              <button onClick={loadLeaderboard} style={{ background: 'none', border: 'none', color: '#3d5af1', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>↻ Refresh</button>
            </div>
            {loading ? <div style={{ textAlign: 'center', color: '#4a5a7a', padding: '60px 20px' }}>Loading...</div>
              : leaderboard.length === 0 ? <div style={{ textAlign: 'center', color: '#4a5a7a', padding: '60px 20px' }}>No stats logged yet.<br /><span style={{ fontSize: 13 }}>Tap ➕ Log to start!</span></div>
              : leaderboard.map((agent, i) => {
                const isExp = expandedAgent === agent.id
                return (
                  <div key={agent.id} style={{ background: i === 0 ? 'linear-gradient(135deg,#1e2d10,#233515)' : i === 1 ? 'linear-gradient(135deg,#1e2533,#1a2030)' : i === 2 ? 'linear-gradient(135deg,#2a1e10,#231810)' : '#111c33', border: i === 0 ? '1px solid #4caf50' : i === 1 ? '1px solid #90caf9' : i === 2 ? '1px solid #ff8a65' : '1px solid #1e2d4a', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                    <div onClick={() => setExpandedAgent(isExp ? null : agent.id)} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                      <div style={{ fontSize: i < 3 ? 26 : 18, minWidth: 34, textAlign: 'center' }}>{i < 3 ? MEDAL[i] : `${i + 1}.`}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: '#7a8ab0', marginTop: 2 }}>{agent.totalApps} apps · {agent.totalDials} dials · {agent.totalSales} sales · {isExp ? '▲' : '▼'}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? '#81c784' : i === 1 ? '#90caf9' : i === 2 ? '#ff8a65' : '#e8eaf6' }}>${fmt(agent.totalAP)}</div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: '1px solid #1e2d4a', padding: '14px 18px', background: 'rgba(0,0,0,0.25)' }}>
                        <div style={{ fontSize: 12, color: '#c5cae9', marginBottom: 12, lineHeight: 2 }}>
                          🚪 <b>{agent.totalDoors}</b> doors · 📞 <b>{agent.totalDials}</b> dials <span style={{ color: '#3a4a6a' }}>→</span> 🤝 <b>{agent.totalContacts}</b> contacts <span style={{ color: '#3a4a6a' }}>→</span> 📅 <b>{agent.totalAppts}</b> appts <span style={{ color: '#3a4a6a' }}>→</span> 🎤 <b>{agent.totalPresentations}</b> pres <span style={{ color: '#3a4a6a' }}>→</span> 💰 <b>{agent.totalSales}</b> sales
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: agent.allSales?.length > 0 ? 14 : 0 }}>
                          {[['📈 Contact Rate', contactRate(agent)], ['🎯 Close Rate', closeRate(agent)], ['👥 Recruiting', `${agent.totalRecruiting} interviews`], ['🤝 Ride Alongs', agent.rideAlongs > 0 ? 'Yes' : 'No'], ['⏱️ Hours', fmtTime(agent.totalMinutes)], ['📋 Apps', agent.totalApps]].map(([label, val]) => (
                            <div key={label} style={{ background: '#0d1526', borderRadius: 8, padding: '9px 10px', border: '1px solid #1e2d4a' }}>
                              <div style={{ fontSize: 9, color: '#7a8ab0', marginBottom: 4 }}>{label}</div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        {agent.allSales?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: '#7a8ab0', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>💰 Sale Details</div>
                            {agent.allSales.map((sale, si) => {
                              const k = `${agent.id}-${si}`; const sExp = expandedSale === k
                              return (
                                <div key={si} style={{ background: '#0a1020', border: '1px solid #1e2d4a', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                                  <div onClick={() => setExpandedSale(sExp ? null : k)} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                    <span style={{ fontWeight: 700, color: '#81c784', fontSize: 13 }}>{sale.sale_type || 'Sale'}{sale.carrier ? ` · ${sale.carrier}` : ''}</span>
                                    <span style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>{sale.annual_premium ? `$${fmt(sale.annual_premium)} AP` : ''} {sExp ? '▲' : '▼'}</span>
                                  </div>
                                  {sExp && (
                                    <div style={{ padding: '0 14px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                      {[['Sale Type', sale.sale_type], ['Carrier', sale.carrier], ['Lead Type', sale.lead_type], ['Face Amount', sale.face_amount ? `$${fmt(sale.face_amount)}` : ''], ['Annual Premium', sale.annual_premium ? `$${fmt(sale.annual_premium)}` : ''], ['Lead Age', sale.lead_age], ['Field/Tele', sale.field_tele], ['Draft Date', sale.draft_date]].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label} style={{ background: '#0d1526', borderRadius: 7, padding: '7px 10px', border: '1px solid #1a2640' }}>
                                          <div style={{ fontSize: 9, color: '#7a8ab0' }}>{label}</div>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf6', marginTop: 2 }}>{val}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            {leaderboard.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg,#1a2340,#1e2d50)', border: '2px solid #3d5af1', borderRadius: 14, padding: '18px 20px', marginTop: 16, textAlign: 'center' }}>
                <div style={{ color: '#7a8ab0', fontWeight: 700, fontSize: 11, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Team Total</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>${fmt(teamAP)} <span style={{ fontSize: 13, color: '#7a8ab0', fontWeight: 400 }}>AP</span></div>
                <div style={{ fontSize: 13, color: '#90caf9', marginTop: 4, fontWeight: 600 }}>{teamApps} apps · {teamDials} dials · {teamSales} sales</div>
              </div>
            )}
          </div>
        )}
        {view === 'entry' && (
          <div style={{ background: '#111c33', borderRadius: 16, padding: '22px 18px', border: '1px solid #1e2d4a' }}>
            <h2 style={{ color: '#fff', marginTop: 0, fontSize: 18, marginBottom: 18 }}>📝 Log Your Stats</h2>
            <label style={lbl}>👤 Your Name</label>
            <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ ...inp, marginBottom: 4, color: selectedAgent ? '#fff' : '#4a5a7a' }}>
              <option value=''>-- Choose Your Name --</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div style={sec}>💰 Production</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              {[['💵 AP Amount ($)', 'ap', '0.00'], ['📋 Apps Written', 'apps', '0']].map(([label, key, ph]) => (
                <div key={key}><label style={lbl}>{label}</label><input type='number' placeholder={ph} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inp} /></div>
              ))}
            </div>
            <div style={sec}>📞 Activity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              {[['🚪 Doors Knocked', 'doorsKnocked'], ['📞 Dials', 'dials'], ['🤝 Interactions / Contacts', 'contacts'], ['📅 Appointments', 'appts'], ['🎤 Presentations', 'presentations'], ['💰 Sales', 'sales']].map(([label, key]) => (
                <div key={key}><label style={lbl}>{label}</label><input type='number' placeholder='0' value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inp} /></div>
              ))}
            </div>
            <div style={sec}>👥 Recruiting & Time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              <div><label style={lbl}>👥 Recruiting Interviews</label><input type='number' placeholder='0' value={form.recruiting} onChange={(e) => setForm({ ...form, recruiting: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>🤝 Ride Alongs</label>
                <select value={form.rideAlong} onChange={(e) => setForm({ ...form, rideAlong: e.target.value })} style={inp}>
                  <option value=''>Select...</option><option value='Yes'>Yes</option><option value='No'>No</option>
                </select>
              </div>
              <div><label style={lbl}>⏱️ Hours Worked</label><input type='number' placeholder='0' value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>⏱️ Minutes</label><input type='number' placeholder='0' value={form.minutesWorked} onChange={(e) => setForm({ ...form, minutesWorked: e.target.value })} style={inp} /></div>
            </div>
            <div style={sec}>🏷️ Sale Details</div>
            <div style={{ fontSize: 11, color: '#7a8ab0', marginTop: -10, marginBottom: 14 }}>Fill out for each sale. Leave blank if no sales today.</div>
            {saleDetails.map((sale, i) => (
              <div key={i} style={{ background: '#0d1526', border: '1px solid #2a3a5c', borderRadius: 12, padding: '14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#90caf9', fontWeight: 700 }}>Sale #{i + 1}</span>
                  {saleDetails.length > 1 && <button onClick={() => removeSaleRow(i)} style={{ background: 'rgba(192,57,43,0.2)', border: '1px solid #c0392b', color: '#e74c3c', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Remove</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Sale Type</label>
                    <select value={sale.saleType} onChange={(e) => updateSale(i, 'saleType', e.target.value)} style={inp}>
                      <option value=''>Select...</option>{SALE_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Carrier</label><input type='text' placeholder='e.g. Foresters' value={sale.carrier} onChange={(e) => updateSale(i, 'carrier', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Lead Type</label><input type='text' placeholder='e.g. Facebook' value={sale.leadType} onChange={(e) => updateSale(i, 'leadType', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Face Amount ($)</label><input type='number' placeholder='e.g. 10000' value={sale.faceAmount} onChange={(e) => updateSale(i, 'faceAmount', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Annual Premium ($)</label><input type='number' placeholder='e.g. 844' value={sale.annualPremium} onChange={(e) => updateSale(i, 'annualPremium', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Lead Age</label>
                    <select value={sale.leadAge} onChange={(e) => updateSale(i, 'leadAge', e.target.value)} style={inp}>
                      <option value=''>Select...</option>{LEAD_AGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Field / Tele</label>
                    <select value={sale.fieldTele} onChange={(e) => updateSale(i, 'fieldTele', e.target.value)} style={inp}>
                      <option value=''>Select...</option>{FIELD_TELE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Draft Date</label><input type='date' value={sale.draftDate} onChange={(e) => updateSale(i, 'draftDate', e.target.value)} style={inp} /></div>
                </div>
              </div>
            ))}
            <button onClick={addSaleRow} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed #2a3a5c', background: 'transparent', color: '#7a8ab0', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}>+ Add Another Sale</button>
            <button onClick={submitEntry} disabled={submitting} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: submitting ? '#1e2d4a' : 'linear-gradient(135deg,#3d5af1,#2a3fbf)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Saving...' : '🚀 Submit Stats'}
            </button>
          </div>
        )}
        {view === 'admin' && (
          !adminUnlocked ? (
            <div style={{ background: '#111c33', borderRadius: 16, padding: '30px 20px', border: '1px solid #1e2d4a', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <div style={{ color: '#7a8ab0', marginBottom: 20 }}>Enter Admin PIN</div>
              <input type='password' placeholder='PIN' value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { if (adminPin === ADMIN_PIN) setAdminUnlocked(true); else showFlash('Wrong PIN', 'error') } }}
                style={{ ...inp, fontSize: 20, textAlign: 'center', letterSpacing: 6, marginBottom: 14 }} />
              <button onClick={() => { if (adminPin === ADMIN_PIN) setAdminUnlocked(true); else showFlash('Wrong PIN', 'error') }}
                style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: '#3d5af1', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Unlock</button>
              <div style={{ fontSize: 11, color: '#4a5a7a', marginTop: 14 }}>Default PIN: 1234</div>
            </div>
          ) : (
            <div>
              <div style={{ background: '#111c33', borderRadius: 14, padding: '20px', border: '1px solid #1e2d4a', marginBottom: 14 }}>
                <h3 style={{ color: '#fff', marginTop: 0, fontSize: 16 }}>➕ Add Agent</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder='Full name'
                    onKeyDown={(e) => e.key === 'Enter' && addAgent()}
                    style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #2a3a5c', background: '#0d1526', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={addAgent} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: '#3d5af1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                </div>
              </div>
              <div style={{ background: '#111c33', borderRadius: 14, padding: '20px', border: '1px solid #1e2d4a', marginBottom: 14 }}>
                <h3 style={{ color: '#fff', marginTop: 0, fontSize: 16 }}>👥 Agents ({agents.length})</h3>
                {agents.length === 0 && <div style={{ color: '#4a5a7a', fontSize: 13 }}>No agents yet.</div>}
                {agents.map((agent) => (
                  <div key={agent.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2640' }}>
                    <span style={{ color: '#c5cae9', fontWeight: 600 }}>{agent.name}</span>
                    <button onClick={() => removeAgent(agent.id)} style={{ background: 'rgba(192,57,43,0.2)', border: '1px solid #c0392b', color: '#e74c3c', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
                  </div>
                ))}
              </div>
              <div style={{ background: '#1a0f0f', borderRadius: 14, padding: '20px', border: '1px solid #4a1010' }}>
                <h3 style={{ color: '#e74c3c', marginTop: 0, fontSize: 16 }}>⚠️ Danger Zone</h3>
                <button onClick={clearWeek} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #c0392b', background: 'rgba(192,57,43,0.15)', color: '#e74c3c', fontWeight: 700, cursor: 'pointer' }}>🗑️ Clear This Week's Data</button>
              </div>
            </div>
          )
        )}
      </div>
      <style>{`* { box-sizing: border-box; } select option { background: #0d1526; color: #fff; } input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; } input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }`}</style>
    </div>
  )
}

