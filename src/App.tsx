import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence,motion } from 'motion/react'
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Flag, Gauge, HelpCircle, Link2, LoaderCircle, LogOut, Maximize2, Pause, Play, Radio, RotateCcw, ShieldCheck, Signal, Sprout, Trophy, Users, Volume2, VolumeX, WifiOff, Wrench, X, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { configured,ensureSession,local,localTeacherBrowser,loginTeacher,logout,roomAccessOrigin,rpc,subscribe } from './api'
import { Tractor } from './Tractor'
import Challenge from './Challenge'
import { classification,missions } from './missions'
import type { BoardEntry,Review,RoomSummary,State } from './types'

const read=(key:string)=>{try{return localStorage.getItem(key)||''}catch{return ''}}
const write=(key:string,value:string)=>{try{localStorage.setItem(key,value)}catch{/* Session still works without local storage. */}}
type Pending={code:string;challenge:string;answer:string;request:string}
const getPending=(code:string):Pending|null=>{try{return JSON.parse(read(`tractor.pending.${code}`)||'null')}catch{return null}}
const roomParam=new URLSearchParams(location.search).get('sala')?.toUpperCase()||''
const missionIcons=[Sprout,Gauge,Wrench,Link2,Flag]
function Brand({small=false}:{small?:boolean}) {return <div className={`brand ${small?'small':''}`}><span className="brand-mark"><Sprout size={21}/></span><span>MISIÓN<span className="brand-light">TRACTOR</span></span><span className="brand-edition">EDICIÓN<br/>AGRÍCOLA</span></div>}

function App() {
 const [teacherView,setTeacherView]=useState(location.pathname.startsWith('/docente'))
 const [code,setCode]=useState('')
 const [state,setState]=useState<State|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [online,setOnline]=useState(navigator.onLine)
 const [live,setLive]=useState(false)
 const [syncError,setSyncError]=useState(false)
 const [review,setReview]=useState<Review|null>(null)
 const [ranking,setRanking]=useState(false)
 const [sound,setSound]=useState(false)
 const [introSeen,setIntroSeen]=useState('')
 const [pending,setPending]=useState<Pending|null>(null)
 const refreshRevision=useRef(0)
 const currentCode=useRef(code);currentCode.current=code
 const refresh=useCallback(async(room= currentCode.current)=>{
  if(!room) return
  const revision=++refreshRevision.current
  try {
   const next=await rpc<State>('get_state',{p_code:room})
   if(revision!==refreshRevision.current || (currentCode.current && currentCode.current!==room)) return
   setState(next);setSyncError(false)
   if(next.review&&read(`tractor.review.${room}`)!==next.review.id) setReview(next.review)
  } catch {if(revision===refreshRevision.current)setSyncError(true)}
 },[])
 useEffect(()=>{
  let active=true
  const remembered=read(teacherView?'tractor.teacher.room':'tractor.student.room')
  ensureSession().then(async()=>{
   const resume=roomParam ? (teacherView||remembered===roomParam?roomParam:'') : remembered
   if(resume) {
    try{const s=await rpc<State>('get_state',{p_code:resume});if(active){setCode(resume);setState(s);if(s.review&&read(`tractor.review.${resume}`)!==s.review.id)setReview(s.review)}}
    catch(e){if(active)setError(message(e))}
   }
  }).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 // Initial restoration only; role changes explicitly reset the current room.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 useEffect(()=>{
  const on=()=>{setOnline(true);void refresh()};const off=()=>setOnline(false)
  const visible=()=>{if(!document.hidden)void refresh()}
  window.addEventListener('online',on);window.addEventListener('offline',off);document.addEventListener('visibilitychange',visible)
  return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);document.removeEventListener('visibilitychange',visible)}
 },[refresh])
 const roomId=state?.room.id
 const overview=!!state?.teacher||state?.room.status==='lobby'||!!state?.player?.finished||ranking
 useEffect(()=>{
  if(!code||!roomId) return
  const stop=subscribe(code,roomId,()=>void refresh(),setLive,overview)
  void refresh()
  const interval=setInterval(()=>void refresh(),12000)
  return()=>{stop();clearInterval(interval);setLive(false)}
 },[code,roomId,refresh,overview])
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action()}catch(e){setError(message(e))}finally{setBusy(false)}}
 const enter=async(room:string,name:string)=>run(async()=>{
  const data=await rpc<{code:string}>('join_room',{p_code:room,p_name:name})
  write('tractor.student.room',data.code);write('tractor.name',name);setCode(data.code)
  const s=await rpc<State>('get_state',{p_code:data.code});setState(s)
  if(s.review&&read(`tractor.review.${data.code}`)!==s.review.id)setReview(s.review)
  history.replaceState({},'',`/?sala=${data.code}`)
 })
 const loadTeacherRoom=async(room:string)=>run(async()=>{
  const s=await rpc<State>('get_state',{p_code:room});if(!s.teacher) throw new Error('Esta sala no pertenece a tu cuenta docente.')
  setState(s);setCode(room);write('tractor.teacher.room',room);history.replaceState({},'',`/docente?sala=${room}`)
 })
 function playTone(correct:boolean) {
  if(!sound) return
  try{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=correct?660:220;gain.gain.setValueAtTime(.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.25);osc.start();osc.stop(ctx.currentTime+.25);osc.onended=()=>void ctx.close()}catch{/* Audio is optional. */}
 }
 const send=async(item:Pending)=>run(async()=>{
  const feedback=await rpc<Review>('submit_answer',{p_code:item.code,p_challenge:item.challenge,p_answer:item.answer,p_request_id:item.request})
  write(`tractor.pending.${item.code}`,'');setPending(null);setReview(feedback);playTone(feedback.correct)
  await refresh(item.code)
 })
 const answer=(choice:string)=>{
  if(!state?.question||busy||pending?.code===code) return
  const item={code,challenge:state.question.id,answer:choice,request:crypto.randomUUID()}
  write(`tractor.pending.${code}`,JSON.stringify(item));setPending(item);void send(item)
 }
 const dismissReview=useCallback(()=>{
  if(review) write(`tractor.review.${code}`,review.id)
  setReview(null);window.scrollTo({top:0,behavior:'smooth'})
 },[code,review])
 const goHome=(teacher=false)=>{
  setState(null);setCode('');setError('');setReview(null);setTeacherView(teacher);setRanking(false)
  history.pushState({},'',teacher?'/docente':'/')
 }
 const q=state?.question
 useEffect(()=>{
  if(!code)return
  const queued=getPending(code)
  if(queued&&state?.history.some(item=>item.id===queued.challenge)){
   write(`tractor.pending.${code}`,'');setPending(null)
  }else setPending(queued)
 },[code,state?.history])
 const mission=q?missions[q.mission-1]:null
 const introKey=mission?`${code}.${mission.number}`:''
 const showIntro=!!mission&&introSeen!==introKey&&read(`tractor.intro.${introKey}`)!=='yes'
 if(loading) return <div className="loading-screen"><Brand/><LoaderCircle className="spin"/><p>Conectando con el centro de operaciones…</p></div>
 return <div className="app">
  <header className="site-header"><a href="/" onClick={e=>{e.preventDefault();goHome()}} aria-label="Inicio"><Brand small={!!state}/></a><div className="header-actions">{state?<><span className={`connection ${live&&online?'connected':''}`}><i/>{online?(live?'EN LÍNEA':'SINCRONIZANDO'):'SIN CONEXIÓN'}</span>{!state.teacher&&<button className="icon-button" aria-label={sound?'Silenciar efectos':'Activar efectos de sonido'} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>}<button className="icon-button" aria-label="Ver ranking" onClick={()=>setRanking(true)}><Trophy size={19}/></button></>:<a className="teacher-link" href="/docente" onClick={e=>{e.preventDefault();goHome(!teacherView)}}><ShieldCheck size={16}/>{teacherView?'Ingreso de estudiantes':'Acceso docente'}<ArrowUpRight size={15}/></a>}</div></header>
  {local&&import.meta.env.DEV&&<div className="local-notice">DESARROLLO LOCAL · Misma base de datos y reglas de juego</div>}
  {(!online||syncError)&&<div className="network-banner" role="status"><WifiOff size={18}/><span>{!online?'Perdiste la conexión. Tu progreso confirmado está guardado.':'No pudimos sincronizar. Conservamos tu progreso confirmado.'}</span><button onClick={()=>void refresh()}>Reconectar</button></div>}
  {error&&<div className="error-banner" role="alert"><XCircle size={18}/><span>{error}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={()=>setError('')}><X size={16}/></button></div>}
  {!configured?<main className="setup-screen"><Wrench size={44}/><h1>Prepará el centro de operaciones</h1><p>Esta publicación necesita la URL y la clave pública de Supabase. El README incluye la migración, la configuración y los pasos de publicación.</p></main>:!state?(teacherView?<TeacherEntry busy={busy} run={run} openRoom={loadTeacherRoom}/>:<Welcome busy={busy} onEnter={enter}/>):state.teacher?<TeacherPanel state={state} busy={busy} onStatus={status=>void run(async()=>{await rpc('set_room_status',{p_code:code,p_status:status});await refresh()})} newRoom={()=>{write('tractor.teacher.room','');goHome(true)}} onLogout={()=>void run(async()=>{await logout();write('tractor.teacher.room','');goHome(true)})}/>:<>
   <main className="game-layout"><aside className="mission-rail"><span className="eyebrow">TU JORNADA</span><MissionMap next={state.player?.next||0}/><div className="rail-note"><ShieldCheck size={20}/><p>A tu ritmo.<br/>Cada decisión cuenta.</p></div></aside><div className="game-main">
   <div className="player-hud"><div><span className="eyebrow">OPERADOR/A</span><strong>{state.player?.name}</strong></div><div className="hud-score"><span className="eyebrow">POTENCIA ACUMULADA</span><strong>{state.player?.score||0}<small> / 1000</small></strong></div></div>
   <div className="journey-progress"><div style={{width:`${(state.player?.next||0)/12*100}%`}}/></div>
   {state.room.status==='lobby'?<Waiting state={state}/>:state.player?.finished&&!review?<Results state={state} onRanking={()=>setRanking(true)}/>:state.room.status==='closed'&&!review?<div className="closed-screen"><Flag size={44}/><span className="eyebrow">SALA FINALIZADA</span><h1>El docente cerró la jornada</h1><p>Completaste {state.player?.next} de 12 desafíos. Tus {state.player?.score} puntos quedaron guardados. El ranking final incluye a quienes completaron las cinco misiones.</p><button className="button primary" onClick={()=>setRanking(true)}>VER RESULTADOS<Trophy size={19}/></button></div>:<>
    <div className="mission-status"><span>MISIÓN {q?.mission||review?.mission} DE 5</span><span>{mission?.tag||'CIERRE DE JORNADA'}</span></div>
    <AnimatePresence mode="wait">{review?<Feedback key={`feedback-${review.id}`} review={review} pausedExternally={ranking} onNext={dismissReview}/>:pending&&pending.code===code?<div className="pending-screen" key="pending"><Signal size={40}/><h2>Tu decisión está lista para sincronizar</h2><p>Vamos a reenviar la misma respuesta. Tu decisión se guardará una sola vez.</p><button className="button primary" disabled={busy||!online} onClick={()=>void send(pending)}><RotateCcw size={18}/>{busy?'Sincronizando…':'REINTENTAR ENVÍO'}</button></div>:showIntro&&mission?<motion.section key={`intro-${mission.number}`} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="mission-intro"><div className="intro-number">0{mission.number}</div><span className="eyebrow">{mission.number>1?'MISIÓN ANTERIOR COMPLETADA':'LA JORNADA COMIENZA'}</span><h1>{mission.label}</h1><div className="intro-scene"><Tractor animated variant={mission.number===2?'tracks':'standard'}/></div><p>{mission.description}</p><div className="intro-meta"><span>HASTA <b>200 PTS</b></span><span>{mission.end-mission.start} DESAFÍOS</span></div><button className="button primary" onClick={()=>{write(`tractor.intro.${introKey}`,'yes');setIntroSeen(introKey)}}>COMENZAR MISIÓN<ArrowRight size={20}/></button></motion.section>:q?<Challenge key={q.id} q={q} busy={busy||!online} onAnswer={answer}/>:<div className="loading-screen"><LoaderCircle className="spin"/><p>Recuperando tu próximo desafío…</p><button onClick={()=>void refresh()}>Reintentar</button></div>}</AnimatePresence>
   </>}
   <div className="game-bottom"><span>SALA <b>{code}</b></span><span>{state.player?.next||0}/12 DESAFÍOS CONFIRMADOS</span></div>
   </div></main>
  </>}
  {!state&&<footer className="site-footer"><span>TECNOLOGÍA QUE MUEVE EL CAMPO.</span><span>MICROCLASE INTERACTIVA <i/> NIVEL SUPERIOR</span></footer>}
  <AnimatePresence>{ranking&&state&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setRanking(false)}><motion.section role="dialog" aria-modal="true" aria-label="Ranking de la sala" className="ranking-modal" initial={{y:35}} animate={{y:0}} onClick={e=>e.stopPropagation()}><button className="icon-button modal-close" aria-label="Cerrar ranking" autoFocus onClick={()=>setRanking(false)}><X/></button><span className="eyebrow">SALA {code}</span><h2>La potencia se comparte.<br/><em>El desafío es tuyo.</em></h2><Board board={state.board} ownId={state.player?.id}/><button className="button secondary" onClick={()=>setRanking(false)}>VOLVER A MI JORNADA<ChevronLeft size={17}/></button></motion.section></motion.div>}</AnimatePresence>
 </div>
}
function message(e:unknown){return e instanceof Error?e.message:'No se pudo completar la operación.'}

function Welcome({busy,onEnter}:{busy:boolean;onEnter:(room:string,name:string)=>Promise<unknown>}) {
 const [name,setName]=useState(read('tractor.name'))
 const [room,setRoom]=useState(roomParam)
 const [help,setHelp]=useState(false)
 return <main className="welcome"><section className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="status-square"/> AVENTURA DE POTENCIA AGRÍCOLA</div><h1>MISIÓN<br/><span>TRACTOR</span><span className="title-period">.</span></h1><div className="hero-subtitle"><span className="yellow-line"/><h2>EL DESAFÍO<br/>DE LA POTENCIA</h2></div><p className="hero-description">Convertite en un experto de la potencia agrícola.<br/>Tu máquina. Tus decisiones. Tu jornada.</p><div className="hero-stats"><div><strong>05</strong><span>MISIONES</span></div><div><strong>1000</strong><span>PUNTOS EN JUEGO</span></div><div><strong>5–8<small> min</small></strong><span>A TU RITMO</span></div></div></section>
 <section className="hero-machine" aria-label="Tractor de la misión"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="machine-coordinate">MT–01 / UNIDAD DE POTENCIA MÓVIL</span><Tractor animated/><div className="hero-machine-floor"/><div className="machine-spec spec-one"><span>MOTOR</span><b>DIÉSEL</b></div><div className="machine-spec spec-two"><span>ESTADO</span><b><i/> LISTO PARA OPERAR</b></div><span className="machine-caption">LA ANATOMÍA DE LA POTENCIA MÓVIL</span></section>
 <section className="join-panel"><div className="join-title"><span className="panel-index">01 / INGRESO</span><Radio size={18}/></div><h2>Tu jornada empieza acá.</h2><p>Ingresá a la sala de tu docente y preparate para salir al campo.</p><form onSubmit={e=>{e.preventDefault();void onEnter(room,name)}}><label htmlFor="player-name">TU NOMBRE O APODO</label><div className="field-wrap"><Users size={18}/><input id="player-name" name="nickname" autoComplete="nickname" placeholder="¿Cómo te llamás?" minLength={2} maxLength={24} value={name} onChange={e=>setName(e.target.value)} required/></div><label htmlFor="room-code">CÓDIGO DE SALA {roomParam&&<span className="auto-code"><Check size={12}/> DESDE TU ENLACE</span>}</label><div className="field-wrap code-input"><span>#</span><input id="room-code" name="room" placeholder="EJ. A3F921" autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" value={room} onChange={e=>setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} required/></div><button className="button primary" disabled={busy||name.trim().length<2||room.length!==6}>{busy?<LoaderCircle className="spin" size={20}/>:<>INGRESAR AL JUEGO<ArrowRight size={20}/></>}</button></form><button className="help-button" onClick={()=>setHelp(!help)}><HelpCircle size={15}/>¿Cómo se juega?<ChevronRight className={help?'rotated':''} size={15}/></button>{help&&<p className="help-copy">Elegí máquinas, ajustá el tablero y conectá implementos. Cada acierto suma puntos; los errores te ayudan a aprender. Avanzás a tu ritmo, sin penalización por tiempo. Tu docente da la señal de salida.</p>}<div className="join-reassurance"><ShieldCheck size={15}/><span>Sin registro. Solo tu apodo y las ganas de jugar.</span></div></section>
 <section className="home-route"><div className="route-label"><span className="eyebrow">EL PLAN DE HOY</span><span>UNA JORNADA. CINCO MISIONES.</span></div><div className="route-stops">{missions.map((m,i)=>{const Icon=missionIcons[i];return <div className="route-stop" key={m.number}><span className="route-icon"><Icon size={19}/></span><div><small>0{m.number}</small><strong>{m.label}</strong></div></div>})}</div></section></main>
}
function MissionMap({next}:{next:number}) {return <ol className="mission-map">{missions.map((m,i)=>{const Icon=missionIcons[i];return <li key={m.number} className={next>=m.end?'done':next>=m.start?'active':''}><span className="map-node">{next>=m.end?<Check size={18}/>:<Icon size={18}/>}</span><div><small>MISIÓN 0{m.number}</small><strong>{m.label}</strong></div></li>})}</ol>}
function Waiting({state}:{state:State}) {return <section className="waiting"><div className="waiting-radar"><Radio size={44}/></div><span className="eyebrow">ENLACE ESTABLECIDO</span><h1>Ya estás en el equipo.</h1><p>Tu tractor está listo. La jornada empieza cuando el docente dé la señal.</p><Tractor/><div className="waiting-meta"><span><Users size={17}/>{state.board.length} operadores en la sala</span><span className="waiting-pulse">Esperando inicio</span></div><p className="quiet-note">Podés dejar esta pantalla abierta. Vas a empezar automáticamente.</p></section>}
function Feedback({review,onNext,pausedExternally}:{review:Review;onNext:()=>void;pausedExternally:boolean}) {
 const [remaining,setRemaining]=useState(10);const [paused,setPaused]=useState(false)
 useEffect(()=>{if(paused||pausedExternally)return;const t=setInterval(()=>setRemaining(n=>Math.max(0,n-1)),1000);return()=>clearInterval(t)},[paused,pausedExternally])
 useEffect(()=>{if(remaining===0&&!pausedExternally)onNext()},[remaining,onNext,pausedExternally])
 return <motion.section className={`feedback ${review.correct?'correct':'incorrect'}`} initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} aria-live="polite"><div className="feedback-icon">{review.correct?<CheckCircle2 size={55}/>:<Wrench size={48}/>}</div><span className="eyebrow">DECISIÓN CONFIRMADA</span><h1>{review.correct?'¡Buena decisión!':'Cada decisión enseña.'}</h1><div className="feedback-score">+{review.points}<span> PUNTOS</span></div><p>{review.explanation}</p><div className="feedback-animation"><Tractor animated={review.correct}/></div><button className="button primary" onClick={onNext}>SEGUIR LA JORNADA<ArrowRight size={20}/></button><button className="pause-button" onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Continuación automática pausada':`Continuar en ${remaining} s · Pausar para leer`}</button></motion.section>
}
function Board({board,ownId,progress=true}:{board:BoardEntry[];ownId?:string;progress?:boolean}) {
 const finished=board.filter(p=>p.finished);const playing=board.filter(p=>!p.finished)
 return <div className="board"><div className="board-heading"><Trophy size={18}/><h3>Ranking de jornadas completas</h3><span>{finished.length}</span></div>{finished.length?<div className="ranking-rows">{finished.map(p=><div key={p.id} className={`ranking-row ${p.id===ownId?'is-you':''}`}><span className={`rank-number rank-${p.rank}`}>{p.rank}</span><span className="rank-name">{p.name}{p.id===ownId&&<small>VOS</small>}<small>5/5 MISIONES · FINALIZADO</small></span><strong>{p.score}<small> PTS</small></strong></div>)}</div>:<p className="empty-board">El ranking se activa cuando alguien completa las cinco misiones.</p>}<p className="quiet-note">Los empates comparten posición. El tiempo no define el resultado.</p>{progress&&playing.length>0&&<><div className="board-heading progress-heading"><Users size={18}/><h3>Progreso de la sala</h3><span>{playing.length}</span></div><p className="quiet-note">Resultados parciales. Se muestran por nombre, sin posición competitiva.</p><div className="progress-rows">{playing.map(p=><div className={`progress-row ${p.id===ownId?'is-you':''}`} key={p.id}><span className={`online-dot ${p.online?'on':''}`} title={p.online?'Activo recientemente':'Sin actividad reciente'}/><span className="progress-name"><b>{p.name}</b><small>{p.missions}/5 MISIONES · {p.next}/12 DESAFÍOS</small><span className="mini-progress"><i style={{width:`${p.next/12*100}%`}}/></span></span><span className="partial-score">{p.score}<small>PTS<br/>PARCIALES</small></span></div>)}</div></>}</div>
}
function Podium({board}:{board:BoardEntry[]}) {const winners=board.filter(p=>p.finished&&(p.rank||9)<=3);if(!winners.length)return null;return <div className="podium">{[2,1,3].map(rank=>{const group=winners.filter(p=>p.rank===rank);return group.length?<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} transition={{delay:rank*.15}} className={`podium-place podium-${rank}`} key={rank}>{rank===1&&<Trophy size={28}/>}<strong>{group.map(p=>p.name).join(' · ')}</strong><span>{group[0].score} PTS</span><b>{rank.toString().padStart(2,'0')}</b></motion.div>:null})}</div>}
function Results({state,onRanking}:{state:State;onRanking:()=>void}) {
 const p=state.player!;const rank=state.board.find(x=>x.id===p.id)?.rank
 return <section className="results"><div className="confetti" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} style={{left:`${i*5}%`,animationDelay:`${i*.13}s`,background:i%2?'#e8f45a':'#65e2d5'}}/>)}</div><span className="eyebrow">05 / 05 MISIONES COMPLETADAS</span><div className="finish-tractor"><Tractor animated/></div><h1>Jornada cumplida.</h1><p className="result-class">{classification(p.score)}</p><div className="result-total">{p.score}<small>/1000 PTS</small></div><div className="result-position"><Trophy size={20}/><span>Posición actual <b>#{rank||'—'}</b></span></div><p className="quiet-note">Tu posición se actualiza cuando terminan otros operadores. Los empates comparten puesto.</p><div className="mission-recap">{missions.map(m=><div key={m.number}><span>0{m.number} · {m.label}</span><b>{state.history.filter(r=>r.mission===m.number).reduce((s,r)=>s+r.points,0)}<small>/200</small></b></div>)}</div><button className="button primary" onClick={onRanking}>VER RANKING DE LA SALA<Trophy size={20}/></button><details className="learning-review"><summary>Repasá tus decisiones</summary>{state.history.map(r=><article key={r.id}><h3>{r.correct?<CheckCircle2 size={16}/>:<Wrench size={16}/>} {r.title} <span>+{r.points}</span></h3><p>{r.explanation}</p></article>)}</details></section>
}
function TeacherEntry({busy,run,openRoom}:{busy:boolean;run:(a:()=>Promise<void>)=>Promise<void>;openRoom:(code:string)=>Promise<unknown>}) {
 const [authorized,setAuthorized]=useState(false);const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [title,setTitle]=useState('La anatomía de la potencia móvil');const [rooms,setRooms]=useState<RoomSummary[]>([])
 useEffect(()=>{void rpc<RoomSummary[]>('teacher_rooms').then(list=>{setRooms(list);if(list.length)setAuthorized(true)}).catch(()=>{})},[])
 if(local&&!localTeacherBrowser)return <main className="setup-screen"><ShieldCheck size={44}/><h1>Administración en la computadora anfitriona</h1><p>Abrí http://localhost:3001/docente en la computadora donde se ejecuta el juego. Desde allí podés crear la sala y obtener el QR público para tus estudiantes.</p></main>
 return <main className="teacher-entry"><div className="teacher-entry-copy"><span className="eyebrow"><ShieldCheck size={16}/> CENTRO DE OPERACIONES</span><h1>Vos das<br/>la señal.<br/><em>Ellos, la potencia.</em></h1><p>Una sala, cinco misiones y una jornada a su ritmo. Observá el progreso mientras cada estudiante toma sus propias decisiones.</p><div className="teacher-feature"><Radio/><div><b>Todo se sincroniza</b><p>Progreso, puntos y ranking en una sola pantalla.</p></div></div><div className="teacher-feature"><ShieldCheck/><div><b>El control queda en tus manos</b><p>Solo tu cuenta puede iniciar o cerrar tus salas.</p></div></div></div><section className="join-panel teacher-form"><span className="panel-index">ACCESO DOCENTE</span><h2>{authorized?'Prepará una nueva jornada':'Ingresá al panel'}</h2>{!authorized?<form onSubmit={e=>{e.preventDefault();void run(async()=>{await loginTeacher(email,password);const list=await rpc<RoomSummary[]>('teacher_rooms');setRooms(list);setAuthorized(true);setPassword('')})}}>{!local&&<><label htmlFor="teacher-email">CORREO DOCENTE</label><input id="teacher-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></>}<label htmlFor="teacher-password">{local?'CLAVE DOCENTE DEL SERVIDOR LOCAL':'CONTRASEÑA'}</label><input id="teacher-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="button primary" disabled={busy}>INGRESAR AL PANEL<ArrowRight size={18}/></button><p className="quiet-note">{local?'La clave aparece en la terminal al iniciar el servidor.':'Usá la cuenta habilitada en Supabase por quien administra el proyecto. Los estudiantes no necesitan cuenta.'}</p></form>:<form onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await rpc<{code:string}>('create_room',{p_title:title});await openRoom(r.code)})}}><label htmlFor="room-title">NOMBRE DE LA JORNADA</label><input id="room-title" value={title} onChange={e=>setTitle(e.target.value)} minLength={2} maxLength={60} required/><button className="button primary" disabled={busy}>CREAR SALA<ArrowRight size={18}/></button></form>}{rooms.length>0&&<div className="recent-rooms"><h3>Tus salas recientes</h3>{rooms.map(r=><button disabled={busy} key={r.code} onClick={()=>void openRoom(r.code)}><span><b>{r.title}</b><small>{r.code} · {r.status==='lobby'?'EN ESPERA':r.status==='running'?'EN JUEGO':'CERRADA'}</small></span><ChevronRight size={18}/></button>)}</div>}</section></main>
}
function TeacherPanel({state,busy,onStatus,newRoom,onLogout}:{state:State;busy:boolean;onStatus:(status:string)=>void;newRoom:()=>void;onLogout:()=>void}) {
 const [copied,setCopied]=useState(false);const [closing,setClosing]=useState(false);const [projection,setProjection]=useState(false)
 const url=`${roomAccessOrigin()}/?sala=${state.room.code}`
 const complete=state.board.filter(p=>p.finished).length
 const status=state.room.status
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{setCopied(false)}}
 return <main className={`teacher-panel ${projection?'projection-mode':''}`}><div className="teacher-toolbar"><div><span className="eyebrow">CENTRO DE OPERACIONES / SALA {state.room.code}</span><h1>{state.room.title}</h1></div><div><button className="button secondary" onClick={()=>setProjection(!projection)}><Maximize2 size={17}/>{projection?'SALIR DE PROYECCIÓN':'PROYECTAR'}</button><button className="icon-button" aria-label="Cerrar sesión docente" onClick={onLogout}><LogOut size={19}/></button></div></div><div className="teacher-metrics"><div><Users/><strong>{state.board.length}</strong><span>OPERADORES</span></div><div><Radio/><strong>{state.board.filter(p=>!p.finished).length}</strong><span>{status==='lobby'?'ESPERANDO INICIO':'SIN FINALIZAR'}</span></div><div><Flag/><strong>{complete}</strong><span>JORNADAS COMPLETAS</span></div><div className="room-state"><i className={status==='running'?'on':''}/><strong>{status==='lobby'?'EN ESPERA':status==='running'?'EN JUEGO':'FINALIZADA'}</strong><span>AVANCE INDIVIDUAL</span></div></div><div className="teacher-content"><aside className="room-controls"><div className="qr-panel"><div className="join-title"><span className="panel-index">ENLACE DE ACCESO</span><Link2 size={18}/></div><div className="qr-code"><QRCodeSVG value={url} size={184} marginSize={2} level="M"/></div><span className="eyebrow">CÓDIGO DE SALA</span><strong className="room-big-code">{state.room.code}</strong><label htmlFor="share-url" className="sr-only">Enlace para estudiantes</label><input id="share-url" readOnly value={url} onFocus={e=>e.target.select()}/><button className="button secondary" onClick={()=>void copy()}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'ENLACE COPIADO':'COPIAR ENLACE'}</button><p className="quiet-note">Proyectá el QR o compartí el enlace con la clase.</p></div><div className="room-actions">{status==='lobby'&&<button className="button primary" disabled={busy} onClick={()=>onStatus('running')}><Play size={18}/>INICIAR JORNADA</button>}{status!=='closed'&&<button className="button danger" disabled={busy} onClick={()=>setClosing(true)}>FINALIZAR SALA<Flag size={17}/></button>}<button className="button secondary" disabled={busy} onClick={newRoom}>CREAR OTRA SALA<ArrowRight size={17}/></button></div><p className="quiet-note">Después de iniciar, cada estudiante avanza solo. No necesitás cambiar preguntas.</p></aside><section className="teacher-ranking">{status==='closed'&&<><span className="eyebrow">LA JORNADA TERMINÓ</span><h2>El podio de la potencia</h2><Podium board={state.board}/></>}<Board board={state.board}/></section></div>{closing&&<div className="modal-backdrop"><section role="alertdialog" aria-modal="true" aria-label="Finalizar sala" className="confirm-modal"><Flag size={32}/><h2>¿Finalizar esta jornada?</h2><p>{state.board.length-complete} participantes todavía no terminaron. Al cerrar, ya no podrán responder. Se conservarán todos los puntos confirmados y el ranking incluirá solo jornadas completas.</p><button className="button danger" autoFocus disabled={busy} onClick={()=>{setClosing(false);onStatus('closed')}}>SÍ, FINALIZAR SALA</button><button className="button secondary" onClick={()=>setClosing(false)}>SEGUIR JUGANDO</button></section></div>}</main>
}
export default App
