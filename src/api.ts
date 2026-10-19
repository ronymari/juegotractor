import { createClient } from '@supabase/supabase-js'

const env=import.meta.env
export const local=env.VITE_BACKEND==='local' || (env.DEV && !env.VITE_SUPABASE_URL)
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
export const configured=local || !!(env.VITE_SUPABASE_URL && key)
const supabase=!local && configured ? createClient(env.VITE_SUPABASE_URL,key):null
let publicOrigin=''
export function roomAccessOrigin(){return publicOrigin||location.origin}
export const localTeacherBrowser=['localhost','127.0.0.1','[::1]'].includes(location.hostname)
async function request(path:string,body?:unknown) {
 const res=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
 const data=await res.json()
 if(!res.ok) throw new Error(data.error || 'No se pudo conectar con el servidor.')
 return data
}
let sessionPromise:Promise<unknown>|null=null
export function ensureSession():Promise<unknown> {
 if(!configured) return Promise.reject(new Error('Falta configurar Supabase. Consultá el README del proyecto.'))
 if(!sessionPromise) sessionPromise=(async()=>{
  if(local){const data=await request('session');if(typeof data.publicOrigin==='string'&&data.publicOrigin.startsWith('https://'))publicOrigin=new URL(data.publicOrigin).origin;return data}
  const {data,error}=await supabase!.auth.getSession()
  if(error) throw error
  if(!data.session){const {error}=await supabase!.auth.signInAnonymously();if(error) throw error}
 })().catch(e=>{sessionPromise=null;throw e})
 return sessionPromise
}
export async function rpc<T>(name:string,params:Record<string,unknown>={}):Promise<T> {
 await ensureSession()
 if(local) return request(`rpc/${name}`,params)
 const {data,error}=await supabase!.rpc(name,params)
 if(error) throw new Error(error.message)
 return data as T
}
export async function loginTeacher(email:string,password:string) {
 if(local){await ensureSession();return request('teacher-login',{password})}
 if(!supabase) throw new Error('Falta configurar Supabase.')
 const {error}=await supabase.auth.signInWithPassword({email,password});if(error) throw new Error('No se pudo ingresar. Revisá tus credenciales docentes.')
 sessionPromise=null
}
export async function logout() {
 if(local) await request('logout',{})
 else await supabase?.auth.signOut()
 sessionPromise=null
}
export function subscribe(code:string,id:string,onChange:()=>void,onStatus:(connected:boolean)=>void,overview=true) {
 if(local) {
  // Los Quick Tunnels no transportan SSE. Usar consultas breves evita
  // dejar conexiones abiertas y mantiene el inicio/ranking sincronizados.
  if(location.hostname.endsWith('.trycloudflare.com') || env.VITE_REALTIME_TRANSPORT==='poll') {
   onStatus(navigator.onLine)
   const timer=setInterval(()=>{onStatus(navigator.onLine);if(!document.hidden&&navigator.onLine)onChange()},2500)
   return ()=>clearInterval(timer)
  }
  const stream=new EventSource(`/api/events?code=${encodeURIComponent(code)}&scope=${overview?'overview':'player'}`)
  stream.onopen=()=>onStatus(true);stream.onmessage=onChange;stream.onerror=()=>onStatus(false)
  return ()=>stream.close()
 }
 const channel=supabase!.channel(`room-${id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'room_events',filter:`room_id=eq.${id}`},onChange).subscribe(status=>onStatus(status==='SUBSCRIBED'))
 return ()=>{void supabase!.removeChannel(channel)}
}
