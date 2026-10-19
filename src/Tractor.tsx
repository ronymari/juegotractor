import { useId } from 'react'

export function Tractor({variant='standard',animated=false,className=''}:{variant?:string;animated?:boolean;className?:string}) {
 const uid=useId().replaceAll(':','')
 const narrow=variant==='vines'; const high=variant==='cane'; const garden=variant==='garden'; const tracks=variant==='tracks'
 return <svg className={`tractor ${animated?'tractor-moving':''} ${className}`} viewBox="0 0 640 390" fill="none" aria-label={`Tractor ${variant}`} role="img">
  <defs>
   <linearGradient id={`body${uid}`} x1="180" y1="100" x2="470" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#67dfd4"/><stop offset=".48" stopColor="#235e69"/><stop offset="1" stopColor="#0d2937"/></linearGradient>
   <linearGradient id={`glass${uid}`} x1="250" y1="75" x2="370" y2="215" gradientUnits="userSpaceOnUse"><stop stopColor="#31818b" stopOpacity=".65"/><stop offset="1" stopColor="#0c2430"/></linearGradient>
   <radialGradient id={`halo${uid}`}><stop stopColor="#62e9d7" stopOpacity=".2"/><stop offset="1" stopColor="#62e9d7" stopOpacity="0"/></radialGradient>
  </defs>
  <ellipse cx="338" cy="208" rx="280" ry="180" fill={`url(#halo${uid})`}/>
  <path d="M53 336H586M90 345H548" stroke="#5bf1db" strokeOpacity=".2"/>
  <ellipse cx="322" cy="331" rx="230" ry="18" fill="#020b11" opacity=".65"/>
  <g transform={high?'translate(0 -27)':garden?'translate(30 52) scale(.85)':narrow?'translate(60 0) scale(.84 1)':''}>
   <path d="M160 237 184 211 357 207 383 223 512 226 532 262 498 282 180 284Z" fill="#173943" stroke="#6ad5cd" strokeWidth="2"/>
   <path d="M207 213 224 84 335 79 377 211Z" fill={`url(#glass${uid})`} stroke="#8de7da" strokeWidth="3"/>
   <path d="m240 96-15 110h55V96Zm54 0v109h65L326 96Z" stroke="#8be1d6" strokeWidth="2"/>
   <path d="m213 78 124-4 13 12-140 5Z" fill="#8edcd0" stroke="#a9ffe2" strokeWidth="2"/>
   <path d="m357 190 115 13 58 28-8 36-154-14Z" fill={`url(#body${uid})`} stroke="#9df9dd" strokeWidth="3"/>
   <path d="m368 196 100 14 52 23-143-16ZM381 231l122 16m-120-7 110 16m-109-8 105 14" stroke="#71c9c4" strokeWidth="2"/>
   <path d="m516 238 15 4-4 17-14-3Z" fill="#ecfb86"/>
   <path d="M394 195v-74h11v77m-13-77h17v-8h-17Z" fill="#123039" stroke="#90d6cc" strokeWidth="2"/>
   <path d="M268 200v-41m-10 3h26m-7 12 13 25m-36 0h40" stroke="#75c9c8" strokeWidth="3"/>
   <path d="m289 211 10 58h45v-54m-41 12h37m-35 13h37m-34 14h34" stroke="#69bbb8" strokeWidth="3"/>
   <path d="m156 241 9-31 17-20 24-12 37 1 26 19 15 31-6 13" fill="#225862" stroke="#a9ffe2" strokeWidth="3"/>
   <path d="m425 262 13-29 22-14 28 6 19 20" stroke="#a9ffe2" strokeWidth="5"/>
   <path d="M157 269h-30v16h34m361-14h30v18h-29" fill="#20434a" stroke="#76c8c3" strokeWidth="2"/>
   {tracks ? <g><path d="M152 250h327a40 40 0 0 1 0 80H152a40 40 0 0 1 0-80Z" fill="#0b1923" stroke="#8fe0cb" strokeWidth="10" strokeDasharray="8 5"/>{[160,230,300,370,440,479].map((x,i)=><circle key={i} cx={x} cy="290" r="23" fill="#27494f" stroke="#73c2b7" strokeWidth="3"/>)}</g> : <>
    <Wheel x={211} y={high?305:266} r={narrow?63:70}/><Wheel x={464} y={high?311:287} r={high?46:48}/>
    {high && <path d="M211 246v55m253-43v46" stroke="#8fe0cb" strokeWidth="9"/>}
   </>}
  </g>
  <path d="M94 146h59m-34-25v50M524 114h38v38M75 298v23h29M556 305h25v-26" stroke="#76e8d7" strokeOpacity=".5"/>
 </svg>
}
function Wheel({x,y,r}:{x:number;y:number;r:number}) {return <g className="wheel" style={{transformOrigin:`${x}px ${y}px`}}><circle cx={x} cy={y} r={r} fill="#08151e" stroke="#5c8e91" strokeWidth="3"/><circle cx={x} cy={y} r={r-8} stroke="#37616a" strokeWidth="12" strokeDasharray="8 7"/><circle cx={x} cy={y} r={r*.58} fill="#25434b" stroke="#91dfcf" strokeWidth="3"/><circle cx={x} cy={y} r={r*.4} stroke="#528780" strokeWidth="2"/><circle cx={x} cy={y} r={r*.14} fill="#a2d7b7"/>{[0,60,120,180,240,300].map(a=><circle key={a} cx={x+Math.cos(a*Math.PI/180)*r*.27} cy={y+Math.sin(a*Math.PI/180)*r*.27} r="3" fill="#91dfcf"/>)}</g>}

export function RearTractor({selected,onSelect,active}:{selected:string|null;onSelect:(id:string)=>void;active:boolean}) {
 const parts=[{id:'drawbar',label:'Barra de tiro',x:165,y:255},{id:'pto',label:'TDP',x:165,y:196},{id:'hitch',label:'Tres puntos',x:165,y:135}]
 return <div className="rear-wrap"><svg viewBox="0 0 330 300" role="img" aria-label="Vista trasera del tractor con tres sistemas de entrega de potencia">
 <path d="M80 260V104l27-63h116l27 63v156" fill="#142f39" stroke="#60c8bc" strokeWidth="3"/><path d="M108 53h113l15 90H94Z" fill="#183f4c" stroke="#83e4d5" strokeWidth="2"/>
 <rect x="58" y="159" width="57" height="126" rx="18" fill="#08151e" stroke="#78c9be" strokeWidth="4"/><rect x="215" y="159" width="57" height="126" rx="18" fill="#08151e" stroke="#78c9be" strokeWidth="4"/>
 {[176,200,224,248,270].map(y=><g key={y} stroke="#36646c" strokeWidth="7"><path d={`M63 ${y}l45 12M222 ${y+12}l43-12`}/></g>)}
 <path className={active&&selected==='hitch'?'hitch-lift':''} d="m123 230 42-95 42 95m-84 0 42 15 42-15" stroke="#dce961" strokeWidth="7" fill="none"/>
 <path d="M165 226v40h30" stroke="#9ce0d3" strokeWidth="9"/>
 <circle className={active&&selected==='pto'?'pto-spin':''} cx="165" cy="196" r="16" fill="#294b50" stroke="#dce961" strokeWidth="5" strokeDasharray="6 3"/>
 {parts.map(p=><g key={p.id} className="connection-hotspot" role="button" tabIndex={0} aria-label={p.label} aria-pressed={selected===p.id} onClick={()=>onSelect(p.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.id)}}}><circle cx={p.x} cy={p.y} r="22" fill={selected===p.id?'#e7f353':'#0c222d'} fillOpacity=".9" stroke={selected===p.id?'#e7f353':'#69ded0'} strokeWidth="2"/><text x={p.x} y={p.y+5} textAnchor="middle" fill={selected===p.id?'#10212c':'#ebfff7'} fontSize="14" fontWeight="bold">{p.id==='drawbar'?'1':p.id==='pto'?'2':'3'}</text></g>)}
 </svg><div className="part-legend">{parts.map((p,i)=><button key={p.id} className={selected===p.id?'selected':''} onClick={()=>onSelect(p.id)}><span>{i+1}</span>{p.label}</button>)}</div></div>
}
