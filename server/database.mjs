import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export async function openDatabase(path) {
  const db = new PGlite(path)
  await db.waitReady
  const exists = await db.query("select exists(select 1 from information_schema.tables where table_schema='game_private' and table_name='challenges') ok")
  if (!exists.rows[0].ok) {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true),'''')::uuid';
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/001_game.sql', import.meta.url), 'utf8'))
    await db.exec(`create table game_private.local_sessions (hash text primary key,user_id uuid not null references auth.users(id),created_at timestamptz not null default now());`)
  }
  return db
}

const procedures = {
  create_room: ['p_title'], teacher_rooms: [], join_room: ['p_code','p_name'],
  get_state: ['p_code'], set_room_status: ['p_code','p_status'],
  submit_answer: ['p_code','p_challenge','p_answer','p_request_id'],
}
export async function rpc(db, userId, name, params = {}) {
  if (!Object.hasOwn(procedures,name)) throw new Error('Operación desconocida.')
  const keys = procedures[name]
  if (keys.some(k => params[k] === undefined)) throw new Error('Faltan datos de la operación.')
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId])
    await tx.exec('set local role authenticated')
    const values = keys.map(k => k==='p_answer' ? JSON.stringify(params[k]) : params[k])
    const args = keys.map((_,i) => `$${i+1}`).join(',')
    const result = await tx.query(`select public.${name}(${args}) result`,values)
    return result.rows[0].result
  })
}
