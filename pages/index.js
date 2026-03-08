import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const MEDAL = ['🥇', '🥈', '🥉']
const SALE_TYPES = ['Whole Life', 'Term Life', 'Universal Life', 'Other']
const LEAD_AGES = ['Fresh', 'Aged', 'Referral', 'Self-Generated']
const FIELD_TELE = ['Tele-sale', 'Field']
const ADMIN_PIN = '1234'
const fmt = (n) => Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})
const toDay = () => new Date().toISOString().slice(0,10)

function weekRange() {
  const now = new Date()
  const sun = new Date(now); sun.setDate(now.getDate()-now.getDay())
  const sat = new Date(sun); sat.setDate(sun.getDate()+6)
  return { start: sun.toISOString().slice(0,10), end: sat.toISOString().slice(0,10) }
}

const EF = {ap:'',apps:'',doors:'',dials:'',contacts:'',appts:'',presentations:'',sales:'',recruiting:'',rideAlong:'',timeRecruiting:''}
const ES = {saleType:'',carrier:'',leadType:'',faceAmount:'',monthlyPremium:'',leadAge:'',fieldTele:''}
const inp = {display:'block',width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid #2a3a5c',background:'#0d1526',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}
const lbl = {fontSize:10,color:'#7a8ab0',fontWeight:700,letterSpacing:0.8,textTransform:'uppercase',display:'block',marginBottom:5}
const sec = {fontSize:11,color:'#3d5af1',fontWeight:700,letterSpacing:1,textTransform:'uppercase',borderBottom:'1px solid #1e2d4a',paddingBottom:8,margin:'20px 0 14px'}

async function air(table, action, payload, recordIds, offset) {
  const r = await fetch('/api/airtable', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({table, action, payload, recordIds, offset})
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}

async function getAll(table) {
  let records=[], offset=null
  do {
    const d = await air(table,'list',null,null,offset)
    records = records.concat(d.records||[])
    offset = d.offset||null
  } while(offset)
  return records
}

export default function App() {
  const [view,setView]=useState('leaderboard')
  const [board,setBoard]=useState([])
  const [fn,setFn]=useState(''); const [ln,setLn]=useState('')
  const [form,setForm]=useState({...EF})
  const [sales,setSales]=useState([{...ES}])
  const [flash,setFlash]=useState(null)
  const [pin,setPin]=useState(''); const [admin,setAdmin]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [expAgent,setExpAgent]=useState(null)
  const [expSale,setExpSale]=useState(null)
  const {start,end}=weekRange()

  const showFlash=(msg,type='success')=>{setFlash({msg,type});setTimeout(()=>setFlash(null),3500)}

  const loadBoard = useCallback(async()=>{
    setLoading(true)
    try {
      const [entries,saleRecs] = await Promise.all([getAll('Entries'),getAll('Sales')])
      const map={}
      for(const r of entries){
        const f=r.fields; const name=f.AgentName; if(!name) continue
        const date=f.EntryDate||''; if(date<start||date>end) continue
        if(!map[name]) map[name]={name,e:[],s:[]}
        map[name].e.push(f)
      }
      for(const r of saleRecs){
        const f=r.fields; const name=f.AgentName; if(!name) continue
        if(!map[name]) map[name]={name,e:[],s:[]}
        map[name].s.push(f)
      }
      const b=Object.values(map).map(({name,e,s})=>({
        name,
        ap:e.reduce((x,f)=>x+Number(f.AP||0),0),
        apps:e.reduce((x,f)=>x+Number(f.Apps||0),0),
        dials:e.reduce((x,f)=>x+Number(f.Dials||0),0),
        contacts:e.reduce((x,f)=>x+Number(f.Contacts||0),0),
        appts:e.reduce((x,f)=>x+Number(f.Appointments||0),0),
        pres:e.reduce((x,f)=>x+Number(f.Presentations||0),0),
        salesCount:e.reduce((x,f)=>x+Number(f.Sales||0),0),
        recruiting:e.reduce((x,f)=>x+Number(f.Recruiting||0),0),
        doors:e.reduce((x,f)=>x+Number(f.DoorsKnocked||0),0),
        rides:e.filter(f=>f.RideAlong==='Yes').length,
        saleDetails:s,
      })).filter(a=>a.ap>0||a.dials>0||a.doors>0||a.apps>0).sort((a,b)=>b.ap-a.ap)
      setBoard(b)
    } catch(err){console.error(err)}
    finally{setLoading(false)}
  },[start,end])

  useEffect(()=>{loadBoard()},[loadBoard])
  useEffect(()=>{const i=setInterval(loadBoard,30000);return()=>clearInterval(i)},[loadBoard])

  const iv=(k)=>parseInt(form[k])||0
  const fv=(k)=>parseFloat(form[k])||0

  const submit = async()=>{
    if(!fn.trim()) return showFlash('Enter first name','error')
    if(!ln.trim()) return showFlash('Enter last name','error')
    const name=`${fn.trim()} ${ln.trim()}`
    if(fv('ap')<=0&&iv('dials')<=0&&iv('doors')<=0) return showFlash('Enter at least one stat','error')
    setSaving(true)
    try {
      const entryRes = await air('Entries','create',{
        records:[{fields:{
          AgentName:name, AP:fv('ap'), Apps:iv('apps'),
          DoorsKnocked:iv('doors'), Dials:iv('dials'), Contacts:iv('contacts'),
          Appointments:iv('appts'), Presentations:iv('presentations'), Sales:iv('sales'),
          Recruiting:iv('recruiting'), RideAlong:form.rideAlong||'',
          TimeRecruiting:form.timeRecruiting||'', EntryDate:toDay(),
        }}]
      })
      const entryId = entryRes.records[0].id
      const filledSales = sales.filter(s=>s.carrier||s.saleType||s.monthlyPremium)
      if(filledSales.length>0){
        await air('Sales','create',{
          records:filledSales.map(s=>({fields:{
            AgentName:name, EntryID:entryId,
            SaleType:s.saleType, Carrier:s.carrier, LeadType:s.leadType,
            FaceAmount:parseFloat(s.faceAmount)||0,
            MonthlyPremium:parseFloat(s.monthlyPremium)||0,
            LeadAge:s.leadAge, FieldTele:s.fieldTele,
          }}))
        })
      }
      setForm({...EF}); setSales([{...ES}]); setFn(''); setLn('')
      showFlash('Stats logged! 🔥'); setView('leaderboard'); loadBoard()
    } catch(err){
      showFlash('Error: '+err.message,'error')
      console.error(err)
    } finally{setSaving(false)}
  }

  const clearWeek=async()=>{
    if(!confirm('Clear all entries this week?')) return
    try{
      const recs=await getAll('Entries')
      const toDelete=recs.filter(r=>{const d=r.fields.EntryDate||'';return d>=start&&d<=end})
      for(let i=0;i<toDelete.length;i+=10){
        await air('Entries','delete',null,toDelete.slice(i,i+10).map(r=>r.id))
      }
      showFlash('Cleared!'); loadBoard()
    }catch(err){showFlash('Error clearing','error')}
  }

  const cRate=(a)=>a.dials>0?((a.contacts/a.dials)*100).toFixed(1)+'%':'—'
  const kRate=(a)=>a.pres>0?((a.salesCount/a.pres)*100).toFixed(1)+'%':'—'
  const tAP=board.reduce((s,a)=>s+a.ap,0)
  const tApps=board.reduce((s,a)=>s+a.apps,0)
  const tDials=board.reduce((s,a)=>s+a.dials,0)
  const tSales=board.reduce((s,a)=>s+a.salesCount,0)
  const updSale=(i,k,v)=>{const u=[...sales];u[i]={...u[i],[k]:v};setSales(u)}

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0e1a,#0d1526,#0a1020)',fontFamily:"'Segoe UI',system-ui,sans-serif",color:'#e8eaf6'}}>
      <Head><title>Breakaway Tracker</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
      <div style={{background:'linear-gradient(90deg,#1a2340,#0f1929)',borderBottom:'2px solid #2a3a5c',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:24}}>🏆</span>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:'#fff'}}>Breakaway Tracker</div>
            <div style={{fontSize:10,color:'#7a8ab0'}}>Final Expense Team</div>
          </div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {['leaderboard','entry','admin'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'7px 12px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:11,background:view===v?'#3d5af1':'#1e2d4a',color:view===v?'#fff':'#8a9bbf'}}>
              {v==='leaderboard'?'📊 Board':v==='entry'?'➕ Log':'⚙️ Admin'}
            </button>
          ))}
        </div>
      </div>
      {flash&&<div style={{position:'fixed',top:70,left:'50%',transform:'translateX(-50%)',background:flash.type==='error'?'#c0392b':'#27ae60',color:'#fff',padding:'10px 24px',borderRadius:10,fontWeight:700,fontSize:14,zIndex:999,boxShadow:'0 4px 20px rgba(0,0,0,0.4)',maxWidth:'90vw',textAlign:'center'}}>{flash.msg}</div>}

      <div style={{maxWidth:620,margin:'0 auto',padding:16}}>
        {view==='leaderboard'&&(
          <div>
            <div style={{background:'#111c33',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #1e2d4a'}}>
              <span style={{fontSize:12,color:'#7a8ab0'}}>📅 {start} → {end}</span>
              <button onClick={loadBoard} style={{background:'none',border:'none',color:'#3d5af1',cursor:'pointer',fontSize:12,fontWeight:700}}>↻ Refresh</button>
            </div>
            {loading?<div style={{textAlign:'center',color:'#4a5a7a',padding:'60px 20px'}}>Loading...</div>
            :board.length===0?<div style={{textAlign:'center',color:'#4a5a7a',padding:'60px 20px'}}>No stats yet this week.<br/><span style={{fontSize:13}}>Tap ➕ Log to start!</span></div>
            :board.map((a,i)=>{
              const isExp=expAgent===a.name
              return(
                <div key={a.name} style={{background:i===0?'linear-gradient(135deg,#1e2d10,#233515)':i===1?'linear-gradient(135deg,#1e2533,#1a2030)':i===2?'linear-gradient(135deg,#2a1e10,#231810)':'#111c33',border:i===0?'1px solid #4caf50':i===1?'1px solid #90caf9':i===2?'1px solid #ff8a65':'1px solid #1e2d4a',borderRadius:12,marginBottom:10,overflow:'hidden'}}>
                  <div onClick={()=>setExpAgent(isExp?null:a.name)} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer'}}>
                    <div style={{fontSize:i<3?26:18,minWidth:34,textAlign:'center'}}>{i<3?MEDAL[i]:`${i+1}.`}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:'#fff'}}>{a.name}</div>
                      <div style={{fontSize:11,color:'#7a8ab0',marginTop:2}}>{a.apps} apps · {a.dials} dials · {a.salesCount} sales · {isExp?'▲':'▼'}</div>
                    </div>
                    <div style={{fontWeight:800,fontSize:18,color:i===0?'#81c784':i===1?'#90caf9':i===2?'#ff8a65':'#e8eaf6'}}>${fmt(a.ap)}</div>
                  </div>
                  {isExp&&(
                    <div style={{borderTop:'1px solid #1e2d4a',padding:'14px 18px',background:'rgba(0,0,0,0.25)'}}>
                      <div style={{fontSize:12,color:'#c5cae9',marginBottom:12,lineHeight:2}}>
                        🚪 <b>{a.doors}</b> doors · 📞 <b>{a.dials}</b> dials → 🤝 <b>{a.contacts}</b> contacts → 📅 <b>{a.appts}</b> appts → 🎤 <b>{a.pres}</b> pres → 💰 <b>{a.salesCount}</b> sales
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:a.saleDetails?.length>0?14:0}}>
                        {[['📈 Contact Rate',cRate(a)],['🎯 Close Rate',kRate(a)],['👥 Recruiting',`${a.recruiting} interviews`],['🤝 Ride Alongs',a.rides>0?'Yes':'No'],['📋 Apps',a.apps],['💰 Sales',a.salesCount]].map(([l,v])=>(
                          <div key={l} style={{background:'#0d1526',borderRadius:8,padding:'9px 10px',border:'1px solid #1e2d4a'}}>
                            <div style={{fontSize:9,color:'#7a8ab0',marginBottom:4}}>{l}</div>
                            <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {a.saleDetails?.length>0&&(
                        <div>
                          <div style={{fontSize:10,color:'#7a8ab0',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>💰 Sale Details</div>
                          {a.saleDetails.map((s,si)=>{
                            const k=`${a.name}-${si}`;const sExp=expSale===k
                            return(
                              <div key={si} style={{background:'#0a1020',border:'1px solid #1e2d4a',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
                                <div onClick={()=>setExpSale(sExp?null:k)} style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                                  <span style={{fontWeight:700,color:'#81c784',fontSize:13}}>{s.SaleType||'Sale'}{s.Carrier?` · ${s.Carrier}`:''}</span>
                                  <span style={{fontWeight:700,color:'#fff',fontSize:13}}>{s.MonthlyPremium?`$${fmt(s.MonthlyPremium)}/mo`:''} {sExp?'▲':'▼'}</span>
                                </div>
                                {sExp&&(
                                  <div style={{padding:'0 14px 12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                                    {[['Sale Type',s.SaleType],['Carrier',s.Carrier],['Lead Type',s.LeadType],['Face Amount',s.FaceAmount?`$${fmt(s.FaceAmount)}`:''],['Monthly Premium',s.MonthlyPremium?`$${fmt(s.MonthlyPremium)}`:''],['Lead Age',s.LeadAge],['Field/Tele',s.FieldTele]].filter(([,v])=>v).map(([l,v])=>(
                                      <div key={l} style={{background:'#0d1526',borderRadius:7,padding:'7px 10px',border:'1px solid #1a2640'}}>
                                        <div style={{fontSize:9,color:'#7a8ab0'}}>{l}</div>
                                        <div style={{fontSize:12,fontWeight:600,color:'#e8eaf6',marginTop:2}}>{v}</div>
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
            {board.length>0&&(
              <div style={{background:'linear-gradient(135deg,#1a2340,#1e2d50)',border:'2px solid #3d5af1',borderRadius:14,padding:'18px 20px',marginTop:16,textAlign:'center'}}>
                <div style={{color:'#7a8ab0',fontWeight:700,fontSize:11,marginBottom:6,letterSpacing:1,textTransform:'uppercase'}}>Team Total</div>
                <div style={{fontSize:32,fontWeight:900,color:'#fff'}}>${fmt(tAP)} <span style={{fontSize:13,color:'#7a8ab0',fontWeight:400}}>AP</span></div>
                <div style={{fontSize:13,color:'#90caf9',marginTop:4,fontWeight:600}}>{tApps} apps · {tDials} dials · {tSales} sales</div>
              </div>
            )}
          </div>
        )}

        {view==='entry'&&(
          <div style={{background:'#111c33',borderRadius:16,padding:'22px 18px',border:'1px solid #1e2d4a'}}>
            <h2 style={{color:'#fff',marginTop:0,fontSize:18,marginBottom:18}}>📝 Log Your Stats</h2>
            <div style={sec}>👤 Your Name</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:6}}>
              <div><label style={lbl}>First Name</label><input type='text' placeholder='John' value={fn} onChange={e=>setFn(e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Last Name</label><input type='text' placeholder='Smith' value={ln} onChange={e=>setLn(e.target.value)} style={inp}/></div>
            </div>
            <div style={{fontSize:10,color:'#4a5a7a',marginBottom:4}}>Spell your name the same way every time</div>
            <div style={sec}>💰 Production</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>💵 AP Amount ($)</label><input type='number' placeholder='0.00' value={form.ap} onChange={e=>setForm({...form,ap:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>📋 Apps Written</label><input type='number' placeholder='0' value={form.apps} onChange={e=>setForm({...form,apps:e.target.value})} style={inp}/></div>
            </div>
            <div style={sec}>📞 Activity</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[['🚪 Doors Knocked','doors'],['📞 Dials','dials'],['🤝 Contacts','contacts'],['📅 Appointments','appts'],['🎤 Presentations','presentations'],['💰 Sales','sales']].map(([l,k])=>(
                <div key={k}><label style={lbl}>{l}</label><input type='number' placeholder='0' value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/></div>
              ))}
            </div>
            <div style={sec}>👥 Recruiting</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>👥 Interviews</label><input type='number' placeholder='0' value={form.recruiting} onChange={e=>setForm({...form,recruiting:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>🤝 Ride Alongs</label>
                <select value={form.rideAlong} onChange={e=>setForm({...form,rideAlong:e.target.value})} style={inp}>
                  <option value=''>Select...</option><option value='Yes'>Yes</option><option value='No'>No</option>
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}><label style={lbl}>⏱️ Time Recruiting</label><input type='text' placeholder='e.g. 2 hours, 30 min' value={form.timeRecruiting} onChange={e=>setForm({...form,timeRecruiting:e.target.value})} style={inp}/></div>
            </div>
            <div style={sec}>🏷️ Sale Details</div>
            <div style={{fontSize:11,color:'#7a8ab0',marginTop:-10,marginBottom:14}}>Fill out per sale. Leave blank if no sales.</div>
            {sales.map((s,i)=>(
              <div key={i} style={{background:'#0d1526',border:'1px solid #2a3a5c',borderRadius:12,padding:14,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <span style={{fontSize:12,color:'#90caf9',fontWeight:700}}>Sale #{i+1}</span>
                  {sales.length>1&&<button onClick={()=>setSales(sales.filter((_,idx)=>idx!==i))} style={{background:'rgba(192,57,43,0.2)',border:'1px solid #c0392b',color:'#e74c3c',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>Remove</button>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={lbl}>Sale Type</label>
                    <select value={s.saleType} onChange={e=>updSale(i,'saleType',e.target.value)} style={inp}>
                      <option value=''>Select...</option>{SALE_TYPES.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Carrier</label><input type='text' placeholder='e.g. Foresters' value={s.carrier} onChange={e=>updSale(i,'carrier',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Lead Type</label><input type='text' placeholder='e.g. Facebook' value={s.leadType} onChange={e=>updSale(i,'leadType',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Face Amount ($)</label><input type='number' placeholder='10000' value={s.faceAmount} onChange={e=>updSale(i,'faceAmount',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Monthly Premium ($)</label><input type='number' placeholder='74' value={s.monthlyPremium} onChange={e=>updSale(i,'monthlyPremium',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Lead Age</label>
                    <select value={s.leadAge} onChange={e=>updSale(i,'leadAge',e.target.value)} style={inp}>
                      <option value=''>Select...</option>{LEAD_AGES.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Field / Tele</label>
                    <select value={s.fieldTele} onChange={e=>updSale(i,'fieldTele',e.target.value)} style={inp}>
                      <option value=''>Select...</option>{FIELD_TELE.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={()=>setSales([...sales,{...ES}])} style={{width:'100%',padding:10,borderRadius:10,border:'1px dashed #2a3a5c',background:'transparent',color:'#7a8ab0',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:18}}>+ Add Another Sale</button>
            <button onClick={submit} disabled={saving} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:saving?'#1e2d4a':'linear-gradient(135deg,#3d5af1,#2a3fbf)',color:'#fff',fontSize:16,fontWeight:800,cursor:saving?'not-allowed':'pointer'}}>
              {saving?'Saving...':'🚀 Submit Stats'}
            </button>
          </div>
        )}

        {view==='admin'&&(
          !admin?(
            <div style={{background:'#111c33',borderRadius:16,padding:'30px 20px',border:'1px solid #1e2d4a',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:12}}>🔒</div>
              <div style={{color:'#7a8ab0',marginBottom:20}}>Enter Admin PIN</div>
              <input type='password' placeholder='PIN' value={pin} onChange={e=>setPin(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){if(pin===ADMIN_PIN)setAdmin(true);else showFlash('Wrong PIN','error')}}}
                style={{...inp,fontSize:20,textAlign:'center',letterSpacing:6,marginBottom:14}}/>
              <button onClick={()=>{if(pin===ADMIN_PIN)setAdmin(true);else showFlash('Wrong PIN','error')}}
                style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'#3d5af1',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer'}}>Unlock</button>
            </div>
          ):(
            <div>
              <div style={{background:'#111c33',borderRadius:14,padding:20,border:'1px solid #1e2d4a',marginBottom:14}}>
                <h3 style={{color:'#fff',marginTop:0,fontSize:16}}>📊 This Week</h3>
                <p style={{color:'#7a8ab0',fontSize:13}}>{board.length} agents logged stats this week.</p>
              </div>
              <div style={{background:'#1a0f0f',borderRadius:14,padding:20,border:'1px solid #4a1010'}}>
                <h3 style={{color:'#e74c3c',marginTop:0,fontSize:16}}>⚠️ Danger Zone</h3>
                <button onClick={clearWeek} style={{width:'100%',padding:12,borderRadius:10,border:'1px solid #c0392b',background:'rgba(192,57,43,0.15)',color:'#e74c3c',fontWeight:700,cursor:'pointer'}}>🗑️ Clear This Week's Data</button>
              </div>
            </div>
          )
        )}
      </div>
      <style>{`*{box-sizing:border-box}select option{background:#0d1526;color:#fff}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>
    </div>
  )
}
