import test,{before,after} from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {join as pathJoin,resolve,sep} from 'node:path'
import {openDatabase,rpc} from '../server/database.mjs'
import {classification} from '../src/missions.ts'

let db,teacher,student,outsider
async function user(isTeacher=false){const id=randomUUID();await db.query('insert into auth.users(id) values($1)',[id]);if(isTeacher)await db.query('insert into game_private.teachers(user_id) values($1)',[id]);return id}
async function room(){return (await rpc(db,teacher,'create_room',{p_title:'Prueba de potencia'})).code}
async function join(code,id=student,name='Operador'){await rpc(db,id,'join_room',{p_code:code,p_name:name});return rpc(db,id,'get_state',{p_code:code})}
async function start(code){await rpc(db,teacher,'set_room_status',{p_code:code,p_status:'running'})}
async function state(code,id=student){return rpc(db,id,'get_state',{p_code:code})}
async function answer(code,id=student,choice,challenge,request=randomUUID()){
 const s=await state(code,id);return rpc(db,id,'submit_answer',{p_code:code,p_challenge:challenge||s.question.id,p_answer:choice,p_request_id:request})
}
async function finish(code,id=student,wrongAt=[]){
 for(let i=0;i<12;i++){
  const s=await state(code,id)
  const correct=(await db.query('select answer from game_private.challenges where seq=$1',[i])).rows[0].answer
  const choice=wrongAt.includes(i)?s.question.options.find(o=>o.id!==correct).id:correct
  await answer(code,id,choice)
 }
 return state(code,id)
}
before(async()=>{db=await openDatabase();teacher=await user(true);student=await user();outsider=await user()})
after(async()=>db.close())

test('suma exacta de 1000 y cinco misiones de 200',async()=>{
 const groups=(await db.query('select mission,sum(points)::int points from game_private.challenges group by mission order by mission')).rows
 assert.deepEqual(groups.map(r=>r.points),[200,200,200,200,200]);assert.equal(groups.reduce((s,r)=>s+r.points,0),1000)
})
test('solo docentes habilitados crean salas; código único',async()=>{
 await assert.rejects(rpc(db,student,'create_room',{p_title:'Intento'}),/exclusivo/)
 const a=await room(),b=await room();assert.match(a,/^[A-F0-9]{6}$/);assert.notEqual(a,b)
})
test('no se envía un desafío ni su solución antes del inicio',async()=>{
 const code=await room();const s=await join(code);assert.equal(s.question,null);assert.equal(s.review,null);assert.deepEqual(s.history,[])
 await start(code);const active=await state(code);assert.equal(active.question.seq,0);assert.equal(active.question.answer,undefined);assert.equal(active.question.explanation,undefined);assert.equal(active.history.length,0)
})
test('el apodo se valida en el servidor y se muestra sin datos de autenticación',async()=>{
 const code=await room();await assert.rejects(join(code,student,'a'),/apodo/);await assert.rejects(join(code,student,'x'.repeat(25)),/apodo/)
 const s=await join(code,student,'Sol');assert.equal(s.board[0].name,'Sol');assert.equal(s.board[0].user_id,undefined);assert.equal(s.board[0].email,undefined)
})
test('no se permite adelantar desafíos ni enviar opciones inventadas',async()=>{
 const code=await room();await join(code);await start(code)
 await assert.rejects(answer(code,student,'cane','machine-cane'),/actual/)
 await assert.rejects(answer(code,student,'inventada'),/inválida/)
 assert.equal((await state(code)).player.next,0)
})
test('un error da cero, explica la respuesta y permite avanzar',async()=>{
 const code=await room();await join(code);await start(code);const feedback=await answer(code,student,'standard')
 assert.equal(feedback.correct,false);assert.equal(feedback.points,0);assert.equal(feedback.answer,'vines');assert.match(feedback.explanation,/angosto/)
 const s=await state(code);assert.equal(s.player.next,1);assert.equal(s.player.score,0);assert.equal(s.question.id,'machine-cane')
})
test('reintentos y llamadas concurrentes no acumulan puntos',async()=>{
 const code=await room();await join(code);await start(code);const request=randomUUID()
 const params={p_code:code,p_challenge:'machine-vines',p_answer:'vines',p_request_id:request}
 const both=await Promise.all([rpc(db,student,'submit_answer',params),rpc(db,student,'submit_answer',params)])
 assert.equal(both[0].points,100);assert.deepEqual(both[0],both[1]);assert.equal((await state(code)).player.score,100)
 await answer(code,student,'standard','machine-vines');const s=await state(code);assert.equal(s.player.score,100);assert.equal(s.player.next,1)
})
test('las doce respuestas correctas terminan el juego con 1000 puntos',async()=>{
 const code=await room();await join(code);await start(code);const s=await finish(code)
 assert.equal(s.player.score,1000);assert.equal(s.player.next,12);assert.equal(s.player.finished,true);assert.equal(s.question,null);assert.equal(s.history.length,12);assert.equal(s.board[0].missions,5);assert.equal(s.board[0].rank,1)
})
test('se puede completar todo con errores: cero puntos y doce explicaciones',async()=>{
 const code=await room();await join(code);await start(code);const s=await finish(code,student,Array.from({length:12},(_,i)=>i))
 assert.equal(s.player.score,0);assert.equal(s.player.finished,true);assert.equal(s.history.length,12);assert.ok(s.history.every(h=>!h.correct&&h.explanation.length>10))
})
test('la última misión y las conexiones reparten 67 + 67 + 66 puntos',async()=>{
 const code=await room();await join(code);await start(code);const s=await finish(code,student,[6,9,11])
 assert.equal(s.player.score,800);assert.equal(s.history.filter(x=>x.mission===4).reduce((n,x)=>n+x.points,0),133)
})
test('sesiones independientes avanzan a su ritmo y los parciales no tienen puesto',async()=>{
 const code=await room();const second=await user();await join(code,student,'Ana');await join(code,second,'Bruno');await start(code)
 await answer(code,student,'vines');const a=await state(code);const b=await state(code,second)
 assert.equal(a.player.next,1);assert.equal(b.player.next,0);assert.ok(a.board.every(x=>x.rank===null))
 const final=await finish(code,second);assert.equal(final.board.find(x=>x.id===a.player.id).rank,null);assert.equal(final.board.find(x=>x.finished).rank,1)
})
test('empates comparten posición sin usar velocidad; otra sala queda aislada',async()=>{
 const code=await room();const second=await user();await join(code,student,'Primero');await join(code,second,'Segundo');await start(code);await finish(code);const s=await finish(code,second)
 assert.deepEqual(s.board.map(p=>p.rank),[1,1]);const other=await room();const third=await user();await join(other,third,'Tercero');assert.equal((await state(other,third)).board.length,1)
})
test('recuperación de sesión conserva identidad, progreso y retroalimentación',async()=>{
 const code=await room();const initial=await join(code);await start(code);await answer(code,student,'vines');const resumed=await join(code,student,'Otro nombre')
 assert.equal(resumed.player.id,initial.player.id);assert.equal(resumed.player.name,'Operador');assert.equal(resumed.player.score,100);assert.equal(resumed.question.seq,1);assert.equal(resumed.review.id,'machine-vines')
})
test('nadie inicia ni cierra la sala de otra cuenta',async()=>{
 const code=await room();await join(code);await assert.rejects(rpc(db,student,'set_room_status',{p_code:code,p_status:'running'}),/exclusivo/)
 await assert.rejects(rpc(db,outsider,'get_state',{p_code:code}),/Primero/)
 await assert.rejects(rpc(db,outsider,'submit_answer',{p_code:code,p_challenge:'machine-vines',p_answer:'vines',p_request_id:randomUUID()}),/sesión/)
})
test('cierre conserva resultados, bloquea respuestas nuevas y no puede reabrirse',async()=>{
 const code=await room();await join(code);await start(code);await answer(code,student,'vines')
 await rpc(db,teacher,'set_room_status',{p_code:code,p_status:'closed'})
 await assert.rejects(answer(code,student,'cane','machine-cane'),/no está en juego/)
 const s=await state(code);assert.equal(s.player.score,100);assert.equal(s.player.next,1);assert.equal(s.question,null)
 await assert.rejects(rpc(db,teacher,'set_room_status',{p_code:code,p_status:'running'}),/no está permitido/)
 const replay=await answer(code,student,'vines','machine-vines');assert.equal(replay.points,100)
 await assert.rejects(join(code,outsider),/cerrada/)
})
test('RLS y permisos impiden leer soluciones o modificar puntos desde el cliente',async()=>{
 const code=await room();const s=await join(code)
 for(const sql of ["select * from game_private.challenges","update game_private.players set score=1000","insert into game_private.teachers(user_id) values(gen_random_uuid())","update public.room_events set revision=999"]){
  await assert.rejects(db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[student]);await tx.exec('set local role authenticated');await tx.exec(sql)}),/permission denied/)
 }
 const rows=await db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[outsider]);await tx.exec('set local role authenticated');return tx.query('select * from public.room_events where room_id=$1',[s.room.id])})
 assert.equal(rows.rows.length,0)
 const own=await db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[student]);await tx.exec('set local role authenticated');return tx.query('select * from public.room_events where room_id=$1',[s.room.id])})
 assert.equal(own.rows.length,1)
})
test('una sesión anónima sin auth.uid no obtiene datos ni privilegios',async()=>{
 await assert.rejects(rpc(db,'','create_room',{p_title:'Sin sesión'}),/exclusivo/)
 const code=await room();await assert.rejects(rpc(db,'','join_room',{p_code:code,p_name:'Sin sesión'}),/venció/)
})
test('clasificaciones respetan todos los límites',()=>{
 assert.equal(classification(1000),'Maestro de la potencia');assert.equal(classification(900),'Maestro de la potencia');assert.equal(classification(899),'Operador experto');assert.equal(classification(700),'Operador experto');assert.equal(classification(699),'Operador en entrenamiento');assert.equal(classification(500),'Operador en entrenamiento');assert.equal(classification(499),'Aprendiz agrícola');assert.equal(classification(0),'Aprendiz agrícola')
})
test('el progreso sobrevive al cierre y reapertura de PostgreSQL en disco',async()=>{
 const root=resolve('.data');await mkdir(root,{recursive:true});const path=await mkdtemp(pathJoin(root,'persistence-test-'))
 const owner=randomUUID(),player=randomUUID();let disk
 try {
  disk=await openDatabase(path)
  await disk.query('insert into auth.users(id) values($1),($2)',[owner,player]);await disk.query('insert into game_private.teachers(user_id) values($1)',[owner])
  const {code}=await rpc(disk,owner,'create_room',{p_title:'Persistencia real'})
  await rpc(disk,player,'join_room',{p_code:code,p_name:'Persistente'});await rpc(disk,owner,'set_room_status',{p_code:code,p_status:'running'})
  await rpc(disk,player,'submit_answer',{p_code:code,p_challenge:'machine-vines',p_answer:'vines',p_request_id:randomUUID()})
  await disk.close();disk=await openDatabase(path)
  const restored=await rpc(disk,player,'get_state',{p_code:code});assert.equal(restored.player.score,100);assert.equal(restored.player.next,1);assert.equal(restored.player.name,'Persistente');assert.equal(restored.review.correct,true)
 } finally {
  if(disk)await disk.close()
  if(!resolve(path).startsWith(root+sep))throw new Error('Ruta de limpieza fuera del directorio de pruebas.')
  await rm(path,{recursive:true,force:true})
 }
})
