import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Check, Link2, Thermometer, Gauge, Power, Route, CircleDot } from 'lucide-react'
import type { Question } from './types'
import { Tractor,RearTractor } from './Tractor'

export default function Challenge({q,busy,onAnswer}:{q:Question;busy:boolean;onAnswer:(id:string)=>void}) {
 const [choice,setChoice]=useState<string|null>(null)
 const [part,setPart]=useState<string|null>(null)
 const target=q.id==='power-drawbar'?'drawbar':q.id==='power-pto'?'pto':'hitch'
 const ready=choice!==null && (q.kind!=='connect'||part===target)
 const value=q.options.find(o=>o.id===choice)
 return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="challenge" key={q.id}>
  <div className="challenge-heading"><span className="eyebrow">DESAFÍO {q.seq+1} / 12</span><span className="points-chip">+{q.points} PTS</span></div>
  <h2>{q.title}</h2><p className="prompt">{q.prompt}</p>
  {q.kind==='machine' ? <div className="machine-grid">{q.options.map(o=><button data-testid={`option-${o.id}`} key={o.id} onClick={()=>setChoice(o.id)} className={`machine-option ${choice===o.id?'selected':''}`} aria-pressed={choice===o.id} disabled={busy}><span className="machine-check">{choice===o.id?<Check size={15}/>:null}</span><Tractor variant={o.id} animated={choice===o.id}/><span>{o.label}</span></button>)}</div> : q.kind==='traction' ? <>
   <div className="traction-track"><Tractor variant={choice==='tracks'?'tracks':'standard'} animated={!!choice}/><div className="track-line"/><span className="telemetry">FUERZA DE ARRASTRE <b>{value?.value || '—'}</b></span></div>
   <div className="traction-options">{q.options.map(o=><button key={o.id} data-testid={`option-${o.id}`} className={`traction-option ${choice===o.id?'selected':''}`} aria-pressed={choice===o.id} disabled={busy} onClick={()=>setChoice(o.id)}><span>{o.label}<b>{o.value}</b></span><span className="eff-bar"><i style={{width:`${o.efficiency}%`}}/></span></button>)}</div>
  </> : q.kind==='connect' ? <>
   <RearTractor selected={part} onSelect={setPart} active={ready}/><p className="touch-hint"><Link2 size={16}/>{part===target?'Componente seleccionado. Tocá su función.':'Tocá el componente indicado para conectar.'}</p>
   <div className="answer-options">{q.options.map(o=><button key={o.id} data-testid={`option-${o.id}`} onClick={()=>setChoice(o.id)} disabled={busy||part!==target} className={choice===o.id?'selected':''} aria-pressed={choice===o.id}><span className="radio-dot"/>{o.label}{choice===o.id&&<Link2 size={18}/>}</button>)}</div><p className="tdp-reference">TDP · 540 / 1000 rpm</p>
  </> : <>
   <div className={`instrument ${q.kind}`}>
    {q.kind==='temperature'?<><div className="dial" style={{'--dial-turn':`${choice?Number(value?.value)*2-90:0}deg`} as React.CSSProperties}><div className="dial-ticks"/><Thermometer/><strong>{choice?`${value?.value}°`:'—°'}</strong><span>TEMPERATURA DEL MOTOR</span></div><div className="instrument-mini"><span>DIÉSEL</span><i/><span>SELECCIONÁ UN RANGO</span></div></>:q.kind==='torque'?<><div className="rpm-panel"><Gauge size={36}/><span>RESISTENCIA DEL SUELO</span><div className="load-bars">{Array.from({length:12},(_,i)=><i key={i} style={{animationDelay:`${i*.1}s`}}/>)}</div><strong>TRAMO DIFÍCIL</strong><div className="engine-readings"><span>RPM <b className="rpm-number">↘</b></span><span>RESERVA DE PAR <b>20–25%</b></span></div></div></>:q.kind==='efficiency'?<><Tractor animated={!!choice}/><div className="calibration-value">{value?.label || '— %'}</div><span className="instrument-label">EFICIENCIA TRACTIVA · 4×4 ASISTIDA</span></>:q.kind==='slip'?<><div className="soil-wheel"><CircleDot size={90}/><div className="soil-line"/></div><strong className="calibration-value">{value?.label || '— %'}</strong><span className="instrument-label">PATINAMIENTO · TAREA PESADA</span></>:q.kind==='road'?<><Route className="scene-icon"/><Tractor animated={!!choice}/><span className="instrument-label">SALIDA DEL LOTE · ASFALTO</span></>:<><Power className={`power-icon ${choice==='idle'?'idle':''}`} size={74}/><div className="shutdown-bars"><i/><i/><i/><i/><i/></div><span className="instrument-label">JORNADA COMPLETA · CUIDÁ EL MOTOR</span></>}
   </div>
   <div className={`answer-options ${['temperature','efficiency','slip'].includes(q.kind)?'compact-options':''}`}>{q.options.map(o=><button key={o.id} data-testid={`option-${o.id}`} onClick={()=>setChoice(o.id)} disabled={busy} className={choice===o.id?'selected':''} aria-pressed={choice===o.id}><span className="radio-dot"/>{o.label}</button>)}</div>
  </>}
  <button data-testid="confirm-answer" className="button primary confirm" disabled={busy||!ready} onClick={()=>ready&&onAnswer(choice!)}>{busy?'Guardando respuesta…':q.kind==='connect'?'CONECTAR POTENCIA':'CONFIRMAR DECISIÓN'}<ArrowRight size={20}/></button>
  <p className="quiet-note">Una decisión por desafío. Tu tiempo no afecta los puntos.</p>
 </motion.div>
}
