import express from 'express'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { mkdir,open,readFile,unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { openDatabase, rpc } from './database.mjs'
import { isLocalTeacherRequest } from './access.mjs'

const production=process.argv.includes('--production')
const port=Number(process.env.PORT || 3001)
const password='docente'
await mkdir('.data',{recursive:true})
// Evita abrir el mismo directorio PostgreSQL en dos procesos simultáneos.
const lockPath='.data/server.lock'
try {
 const oldPid=Number(await readFile(lockPath,'utf8'))
 try{process.kill(oldPid,0);throw new Error(`Ya hay un servidor usando esta base (PID ${oldPid}). Cerralo antes de iniciar otro.`)}
 catch(e){if(e.code!=='ESRCH')throw e;await unlink(lockPath)}
}catch(e){if(e.code!=='ENOENT')throw e}
const lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));await lock.close()
const db=await openDatabase('.data/postgres')
const app=express()
app.disable('x-powered-by')
app.use(express.json({limit:'8kb'}))
app.use((req,res,next)=>{
 const route=req.path.toLowerCase().replace(/\/+$/,'')
 const teacherRoute=route==='/docente'||route.startsWith('/docente/')||[
  '/api/teacher-login','/api/rpc/create_room','/api/rpc/teacher_rooms','/api/rpc/set_room_status'
 ].includes(route)
 if(teacherRoute&&!isLocalTeacherRequest(req,port,production)) {
  const error='Administrá la sala desde localhost en la computadora anfitriona. El acceso docente está bloqueado desde Internet.'
  if(req.path.startsWith('/api/'))return res.status(403).json({error})
  return res.status(403).type('text/plain').send(error)
 }
 next()
})
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  if(req.method==='POST') {
    const origin=req.headers.origin
    const allowed=production ? [process.env.PUBLIC_ORIGIN || `https://${req.headers.host}`,`http://localhost:${port}`,`http://127.0.0.1:${port}`] : ['http://localhost:5173','http://127.0.0.1:5173',`http://${req.headers.host}`]
    if(origin && !allowed.includes(origin)) return res.status(403).json({error:'Origen no autorizado.'})
  }
  next()
})
const limits=new Map()
function rate(key,max=180) {
 const now=Date.now(); const v=limits.get(key)
 if(!v || v.until<now) { limits.set(key,{n:1,until:now+60000}); return true }
 return ++v.n<=max
}
setInterval(()=>{for(const [k,v] of limits) if(v.until<Date.now()) limits.delete(k)},60000).unref()
const hash=s=>createHash('sha256').update(s).digest('hex')
app.use('/api',async(req,res,next)=>{
 try {
  const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('tractor_session='))?.slice(16)
  let user=token ? (await db.query("select user_id from game_private.local_sessions where hash=$1 and created_at>now()-interval '30 days'",[hash(token)])).rows[0]?.user_id : null
  if(!user) {
    if(!rate(`session:${req.ip}`,400)) return res.status(429).json({error:'Demasiados ingresos. Esperá un minuto.'})
    user=randomUUID(); const secret=randomBytes(32).toString('base64url')
    await db.transaction(async tx=>{
      await tx.query('insert into auth.users(id) values($1)',[user])
      await tx.query('insert into game_private.local_sessions(hash,user_id) values($1,$2)',[hash(secret),user])
    })
    res.setHeader('Set-Cookie',`tractor_session=${secret}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${production?'; Secure':''}`)
  }
  req.gameUser=user
  if(!rate(`rpc:${user}`)) return res.status(429).json({error:'Esperá un momento antes de continuar.'})
  next()
 } catch { res.status(503).json({error:'El servidor no pudo recuperar tu sesión.'}) }
})
app.get('/api/session',async(req,res)=>{
 const teacher=(await db.query('select exists(select 1 from game_private.teachers where user_id=$1) ok',[req.gameUser])).rows[0].ok
 res.json({id:req.gameUser,teacher,publicOrigin:process.env.PUBLIC_ORIGIN||null})
})
app.post('/api/teacher-login',async(req,res)=>{
 if(!rate(`login:${req.ip}`,12)) return res.status(429).json({error:'Esperá un minuto antes de reintentar.'})
 const candidate=hash(String(req.body.password || ''))
 if(!timingSafeEqual(Buffer.from(candidate),Buffer.from(hash(password)))) return res.status(403).json({error:'Clave docente incorrecta.'})
 await db.query('insert into game_private.teachers(user_id) values($1) on conflict do nothing',[req.gameUser])
 res.json({ok:true})
})
app.post('/api/logout',async(req,res)=>{
 await db.query('delete from game_private.local_sessions where user_id=$1',[req.gameUser])
 res.setHeader('Set-Cookie','tractor_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
 res.json({ok:true})
})
const subscribers=new Map()
app.get('/api/events',async(req,res)=>{
 try {
  const state=await rpc(db,req.gameUser,'get_state',{p_code:String(req.query.code || '')})
  const code=state.room.code
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Connection','keep-alive'); res.flushHeaders()
  res.write('event: ready\ndata: {}\n\n')
  if(!subscribers.has(code)) subscribers.set(code,new Set())
  const client={response:res,userId:req.gameUser,overview:req.query.scope==='overview'}
  subscribers.get(code).add(client)
  const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000)
  req.on('close',()=>{clearInterval(heartbeat);subscribers.get(code)?.delete(client);if(!subscribers.get(code)?.size)subscribers.delete(code)})
 } catch {res.status(403).json({error:'No podés suscribirte a esta sala.'})}
})
app.post('/api/rpc/:name',async(req,res)=>{
 try {
  const result=await rpc(db,req.gameUser,req.params.name,req.body)
  if(['join_room','submit_answer','set_room_status'].includes(req.params.name)) {
    for(const client of subscribers.get(String(req.body.p_code).toUpperCase()) || []) {
      if(req.params.name!=='submit_answer'||client.overview||client.userId===req.gameUser) client.response.write('data: {}\n\n')
    }
  }
  res.json(result)
 } catch(error) {res.status(400).json({error:error.message || 'No se pudo completar la operación.'})}
})
if(production) {
 const dist=fileURLToPath(new URL('../dist/',import.meta.url))
 app.use(express.static(dist,{maxAge:'1h'})); app.get('/{*path}',(_req,res)=>res.sendFile(`${dist}/index.html`))
}
const server=app.listen(port,process.env.HOST || '127.0.0.1',()=>{
 console.log(`Servidor PostgreSQL local listo: http://localhost:${port}`)
 console.log(`Clave docente: ${password}`)
})
async function stop(){for(const clients of subscribers.values()) for(const client of clients) client.response.end();server.close(); await db.close();await unlink(lockPath).catch(()=>{});process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
