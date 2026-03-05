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
const ADMIN_PIN = '1234'

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
  const [leaderboard, setLeaderboard] = useState([])
  const [agentName, setAgentName] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saleDetails, setSaleDetails] = useState([{ ...EMPTY_SALE }])
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
      const { data: entriesData } = await supabase.from('entries').select('*').gte('entry_date', start).lte('entry_date', end)
      const { data: salesData } = await supabase.from('sale_details').select('*')
      const agentMap = {}
      for (const e of (entriesData || [])) {
        const name = e.agent_name
        if (!name) continue
        if (!agentMap[name]) agentMap[name] = { name, entries: [], sales: [] }
        agentMap[name].entries.push(e)
      }
      for (const s of (salesData || [])) {
        const name = s.agent_name
        if (!name) continue
        if (!agentMap[name]) agentMap[name] = { name, entries: [], sales: [] }
        agentMap[name].sales.push(s)
      }
      const board = Object.values(agentMap).map(({ name, entries: ae, sales: as_ }) => ({
        name,
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
      })).filter((a) => a.totalAP > 0 || a.totalApps > 0 || a.totalDials > 0 || a.totalDoors > 0)
        .sort((a, b) => b.totalAP - a.totalAP)
      setLeaderboard(board)
    } finally { setLoading(false) }
  }, [start, end])

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { const i = setInterval(loadLeaderboard, 60000); return () => clearInterval(i) }, [loadLeaderboard])

  const fv = (k) => parseInt(form[k]) || 0
  const ff = (k) => parseFloat(form[k]) || 0

  const submitEntry = async () => {
    const trimmedName = agentName.trim()
    if (!trimmedName) return showFlash('Enter your first and last name.', 'error')
    if (trimmedName.split(' ').filter(Boolean).length < 2) return showFlash('Please enter both first AND last name.', 'error')
    if (ff('ap') <= 0 && fv('dials') <= 0 && fv('doorsKnocked') <= 0) return showFlash('Enter at least one stat.', 'error')
    setSubmitting(true)
    try {
      const { data: entry, error } = await supabase.from('entries').insert({
        agent_name: trimmedName, ap: ff('ap'), apps: fv('apps'),
        doors_knocked: fv('doorsKnocked'), dials: fv('dials'), contacts: fv('contacts'),
        appts: fv('appts'), presentations: fv('presentations'), sales: fv('sales'),
        recruiting: fv('recruiting'), ride_along: form.rideAlong || '',
        hours_worked: fv('hoursWorked'), minutes_worked: fv('minutesWorked'), entry_date: today(),
      }).select().single()
      if (error) throw error
      const filledSales = saleDetails.filter((s) => s.carrier || s.saleType || s.annualPremium)
      if (filledSales.length > 0) {
        await supabase.from('sale_details').insert(filledSales.map((s) => ({
          entry_id: entry.id, agent_name: trimmedName, sale_type: s.saleType,
          carrier: s.carrier, lead_type: s.leadType, face_amount: parseFloat(s.faceAmount) || 0,
          annual_premium: parseFloat(s.annualPremium) || 0, lead_age: s.leadAge,
          field_tele: s.fieldTele, draft_date: s.draftDate || today(),
        })))
      }
      setForm(EMPTY_FORM); setSaleDetails([{ ...EMPTY_SALE }]); setAgentName('')
      showFlash('Stats logged! 🔥'); setView('leaderboard'); await loadLeaderboard()
    } catch (err) { showFlash('Error saving. Try again.', 'error'); console.error(err) }
    finally { setSubmitting(false) }
  }

  const clearWeek = async () => {
    if (!confirm('Clear ALL entries for this week?')) return
    const { data: we } = await supabase.from('entries').select('id').gte('entry_date', start).lte('entry_date', end)
    if (we?.length) {
      const ids = we.map((e) => e.id)
      await supabase.from('sale_details').delete().in('entry_id', ids)
      await supabase.from('entries').delete().in('id', ids)
    }
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
              : leaderboard.length === 0 ? <div style={{ textAlign: 'center', color: '#4a5a7a', padding: '60px 20px' }}>No stats logged yet this week.<br /><span style={{ fontSize: 13 }}>Tap ➕ Log to start!</span></div>
              : leaderboard.map((agent, i) => {
                const isExp = expandedAgent === agent.name
                return (
                  <div key={agent.name} style={{ background: i === 0 ? 'linear-gradient(135deg,#1e2d10,#233515)' : i === 1 ? 'linear-gradient(135deg,#1e2533,#1a2030)' : i === 2 ? 'linear-gradient(135deg,#2a1e10,#231810)' : '#111c33', border: i === 0 ? '1px solid #4caf50' : i === 1 ? '1px solid #90caf9' : i === 2 ? '1px solid #ff8a65' : '1px solid #1e2d4a', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                    <div onClick={() => setExpandedAgent(isExp ? null : agent.name)} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                      <div style={{ fontSize: i < 3 ? 26 : 18, minWidth: 34, textAlign: 'center' }}>{i < 3 ? MEDAL[i] : `${i + 1}.`}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: '#7a8ab0', marginTop: 2 }}>{agent.totalApps} apps ·​​​​​​​​​​​​​​​​
