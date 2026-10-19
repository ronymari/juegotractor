-- Única autoridad para preguntas, avance y puntajes. Aplicar una vez.
create schema if not exists game_private;
revoke all on schema game_private from public, anon, authenticated;

create table game_private.teachers (user_id uuid primary key references auth.users(id) on delete cascade);
create table game_private.rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 owner_id uuid not null references auth.users(id), title text not null,
 status text not null default 'lobby' check(status in ('lobby','running','closed')),
 created_at timestamptz not null default now(), started_at timestamptz, closed_at timestamptz
);
create table game_private.players (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references game_private.rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id), name text not null check(char_length(name) between 2 and 24),
 score int not null default 0 check(score between 0 and 1000), next_seq int not null default 0 check(next_seq between 0 and 12),
 last_seen timestamptz not null default now(), finished_at timestamptz,
 unique(room_id,user_id)
);
create table game_private.challenges (
 id text primary key, seq int unique not null, mission int not null, points int not null,
 kind text not null, title text not null, prompt text not null, options jsonb not null,
 answer jsonb not null, explanation text not null
);
create table game_private.answers (
 player_id uuid not null references game_private.players(id) on delete cascade,
 challenge_id text not null references game_private.challenges(id), request_id uuid not null,
 choice jsonb not null, correct boolean not null, points int not null, created_at timestamptz not null default now(),
 primary key(player_id,challenge_id), unique(player_id,request_id)
);
create table public.room_events (
 room_id uuid primary key references game_private.rooms(id) on delete cascade,
 revision int not null default 0, updated_at timestamptz not null default now()
);
alter table game_private.teachers enable row level security;
alter table game_private.rooms enable row level security;
alter table game_private.players enable row level security;
alter table game_private.challenges enable row level security;
alter table game_private.answers enable row level security;
alter table public.room_events enable row level security;
revoke all on public.room_events from anon, authenticated;
grant select on public.room_events to authenticated;

create function public.can_access_room(p_id uuid) returns boolean
language sql security definer stable set search_path = '' as $$
 select exists(select 1 from game_private.rooms r where r.id=p_id and
 (r.owner_id=auth.uid() or exists(select 1 from game_private.players p where p.room_id=r.id and p.user_id=auth.uid())));
$$;
create policy members_read_events on public.room_events for select to authenticated using(public.can_access_room(room_id));

create function public.create_room(p_title text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r game_private.rooms;
begin
 if auth.uid() is null or not exists(select 1 from game_private.teachers where user_id=auth.uid()) then
  raise exception 'Acceso exclusivo del docente.';
 end if;
 if char_length(trim(p_title)) not between 2 and 60 then raise exception 'El nombre de la sala debe tener entre 2 y 60 caracteres.'; end if;
 for attempt in 1..10 loop
  begin
   insert into game_private.rooms(code,owner_id,title) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),auth.uid(),trim(p_title)) returning * into r;
   exit;
  exception when unique_violation then if attempt=10 then raise; end if;
  end;
 end loop;
 insert into public.room_events(room_id) values(r.id);
 return jsonb_build_object('code',r.code,'id',r.id);
end; $$;

create function public.teacher_rooms() returns jsonb language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'title',title,'status',status) order by created_at desc),'[]'::jsonb)
 from (select * from game_private.rooms where owner_id=auth.uid() order by created_at desc limit 20) r;
$$;

create function public.join_room(p_code text,p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r game_private.rooms; p game_private.players;
begin
 if auth.uid() is null then raise exception 'La sesión venció. Volvé a ingresar.'; end if;
 select * into r from game_private.rooms where code=upper(trim(p_code)) for update;
 if r.id is null then raise exception 'No encontramos esa sala. Revisá el código.'; end if;
 select * into p from game_private.players where room_id=r.id and user_id=auth.uid();
 if p.id is not null then return jsonb_build_object('code',r.code); end if;
 if r.status='closed' then raise exception 'La sala está cerrada.'; end if;
 if r.owner_id=auth.uid() then raise exception 'Usá otra ventana o dispositivo para jugar como estudiante.'; end if;
 if char_length(trim(p_name)) not between 2 and 24 or p_name ~ '[[:cntrl:]]' then raise exception 'Usá un apodo de 2 a 24 caracteres.'; end if;
 if (select count(*) from game_private.players where room_id=r.id)>=200 then raise exception 'La sala llegó al límite de 200 participantes.'; end if;
 insert into game_private.players(room_id,user_id,name) values(r.id,auth.uid(),trim(p_name)) on conflict(room_id,user_id) do nothing;
 update public.room_events set revision=revision+1,updated_at=now() where room_id=r.id;
 return jsonb_build_object('code',r.code);
end; $$;

create function public.set_room_status(p_code text,p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r game_private.rooms;
begin
 select * into r from game_private.rooms where code=upper(trim(p_code)) for update;
 if r.id is null or r.owner_id is distinct from auth.uid() then raise exception 'Acceso exclusivo del docente.'; end if;
 if not ((r.status='lobby' and p_status='running') or (r.status in ('lobby','running') and p_status='closed')) then raise exception 'Ese cambio de estado no está permitido.'; end if;
 update game_private.rooms set status=p_status,started_at=case when p_status='running' then now() else started_at end,
 closed_at=case when p_status='closed' then now() else null end where id=r.id;
 update public.room_events set revision=revision+1,updated_at=now() where room_id=r.id;
 return jsonb_build_object('status',p_status);
end; $$;

create function public.get_state(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r game_private.rooms; p game_private.players; q jsonb; board jsonb; review jsonb; history jsonb;
begin
 select * into r from game_private.rooms where code=upper(trim(p_code));
 if r.id is null then raise exception 'No encontramos esa sala.'; end if;
 select * into p from game_private.players where room_id=r.id and user_id=auth.uid();
 if auth.uid() is null or (p.id is null and r.owner_id is distinct from auth.uid()) then raise exception 'Primero ingresá a la sala con tu apodo.'; end if;
 if p.id is not null then update game_private.players set last_seen=now() where id=p.id; end if;
 if p.id is not null and p.next_seq<12 and r.status='running' then
  select jsonb_build_object('id',id,'seq',seq,'mission',mission,'points',points,'kind',kind,'title',title,'prompt',prompt,'options',options)
  into q from game_private.challenges where seq=p.next_seq;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'score',score,'next',next_seq,
 'missions',case when next_seq>=12 then 5 when next_seq>=9 then 4 when next_seq>=6 then 3 when next_seq>=4 then 2 when next_seq>=2 then 1 else 0 end,
 'finished',next_seq=12,'rank',position,'online',last_seen>now()-interval '45 seconds')
 order by (next_seq=12) desc,position nulls last,lower(name),id),'[]'::jsonb) into board
 from (select x.*,case when next_seq=12 then (select count(distinct y.score)+1 from game_private.players y where y.room_id=r.id and y.next_seq=12 and y.score>x.score) else null end position
 from game_private.players x where x.room_id=r.id) z;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'mission',c.mission,'title',c.title,'correct',a.correct,'points',a.points,'answer',c.answer,'explanation',c.explanation) order by c.seq),'[]'::jsonb)
 into history from game_private.answers a join game_private.challenges c on c.id=a.challenge_id where a.player_id=p.id;
 review=history->(jsonb_array_length(history)-1);
 return jsonb_build_object('room',jsonb_build_object('id',r.id,'code',r.code,'title',r.title,'status',r.status),
 'teacher',r.owner_id=auth.uid(),'player',case when p.id is null then null else jsonb_build_object('id',p.id,'name',p.name,'score',p.score,'next',p.next_seq,'finished',p.next_seq=12) end,
 'question',q,'board',board,'review',review,'history',history);
end; $$;

create function public.submit_answer(p_code text,p_challenge text,p_answer jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r game_private.rooms; p game_private.players; c game_private.challenges; a game_private.answers; ok boolean;
begin
 select * into r from game_private.rooms where code=upper(trim(p_code)) for share;
 if r.id is null then raise exception 'No encontramos esa sala.'; end if;
 select * into p from game_private.players where room_id=r.id and user_id=auth.uid() for update;
 if p.id is null then raise exception 'La sesión no pertenece a esta sala.'; end if;
 select * into c from game_private.challenges where id=p_challenge;
 if c.id is null then raise exception 'Desafío inexistente.'; end if;
 select * into a from game_private.answers where player_id=p.id and challenge_id=c.id;
 if a.player_id is null then
  if r.status<>'running' then raise exception 'La sala no está en juego.'; end if;
  if p.next_seq<>c.seq then raise exception 'Completá el desafío actual antes de avanzar.'; end if;
  if not exists(select 1 from jsonb_array_elements(c.options) o where o->'id'=p_answer) then raise exception 'Opción inválida.'; end if;
  ok=(p_answer=c.answer);
  insert into game_private.answers(player_id,challenge_id,request_id,choice,correct,points)
  values(p.id,c.id,p_request_id,p_answer,ok,case when ok then c.points else 0 end) returning * into a;
  update game_private.players set score=score+a.points,next_seq=next_seq+1,last_seen=now(),finished_at=case when next_seq=11 then now() else null end where id=p.id;
  update public.room_events set revision=revision+1,updated_at=now() where room_id=r.id;
 end if;
 return jsonb_build_object('id',c.id,'mission',c.mission,'title',c.title,'correct',a.correct,'points',a.points,'answer',c.answer,'explanation',c.explanation);
end; $$;

-- Realtime publica solamente una señal. Los datos salen por get_state y su control de membresía.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.room_events;
 end if;
end $$;

revoke all on all tables in schema game_private from public,anon,authenticated;
revoke all on function public.can_access_room(uuid) from public,anon;
revoke all on function public.create_room(text),public.teacher_rooms(),public.join_room(text,text),public.set_room_status(text,text),public.get_state(text),public.submit_answer(text,text,jsonb,uuid) from public,anon;
grant execute on function public.can_access_room(uuid),public.create_room(text),public.teacher_rooms(),public.join_room(text,text),public.set_room_status(text,text),public.get_state(text),public.submit_answer(text,text,jsonb,uuid) to authenticated;

-- Fuente principal: guion Word, diapositivas 3, 4, 5, 7, 8 y 9.
insert into game_private.challenges values
('machine-vines',0,1,100,'machine','Entre hileras','Te esperan hileras estrechas en un viñedo. Elegí la máquina que puede pasar entre ellas.',
 '[{"id":"standard","label":"Estándar"},{"id":"vines","label":"Frutero / viñatero"},{"id":"cane","label":"Cañero de alto despeje"},{"id":"garden","label":"Hortícola"},{"id":"tracks","label":"Orugas"}]',
 '"vines"','El frutero o viñatero tiene un chasis angosto, adecuado para trabajar entre hileras estrechas.'),
('machine-cane',1,1,100,'machine','Espacio bajo el chasis','Ahora trabajás en un cañaveral. Necesitás un chasis con alto despeje. Elegí tu tractor.',
 '[{"id":"standard","label":"Estándar"},{"id":"vines","label":"Frutero / viñatero"},{"id":"cane","label":"Cañero de alto despeje"},{"id":"garden","label":"Hortícola"},{"id":"tracks","label":"Orugas"}]',
 '"cane"','El tractor cañero tiene alto despeje. El estándar se usa en tareas generales; el hortícola se adapta a labores de huerta y el de orugas se distingue por su rodado.'),
('traction-best',2,2,100,'traction','Que la potencia llegue al suelo','Tenés que arrastrar un implemento. Según la clase, ¿qué sistema tiene la mayor eficiencia tractiva?',
 '[{"id":"simple","label":"Simple 2×4","value":"50%","efficiency":50},{"id":"assisted","label":"Asistida 4×4","value":"65%","efficiency":65},{"id":"articulated","label":"Articulada 4×4","value":"75–80%","efficiency":80},{"id":"tracks","label":"Orugas","value":"90% o superior","efficiency":92}]',
 '"tracks"','Las orugas logran una eficiencia de tracción superior al 90% en la referencia de la clase. Reparten el peso sobre una mayor superficie.'),
('traction-value',3,2,100,'efficiency','Calibrá la tracción','Tu tractor tiene tracción asistida 4×4, con ruedas desiguales. Ajustá su eficiencia al valor visto en clase.',
 '[{"id":"50","label":"50%"},{"id":"65","label":"65%"},{"id":"80","label":"75–80%"},{"id":"90","label":"90% o superior"}]',
 '"65"','La tracción asistida 4×4 tiene una eficiencia del 65%. La simple alcanza 50%; la articulada, 75–80%; las orugas superan 90%, según la microclase.'),
('engine-temp',4,3,100,'temperature','Poné el motor a punto','Seleccioná en el tablero el rango de temperatura de trabajo del motor diésel explicado en clase.',
 '[{"id":"cold","label":"40–50 °C","value":45},{"id":"warm","label":"60–70 °C","value":65},{"id":"work","label":"80–90 °C","value":85},{"id":"hot","label":"100–110 °C","value":105}]',
 '"work"','El rango explicado es 80–90 °C. Trabajar con el motor frío aumenta el desgaste; el recalentamiento puede dañarlo.'),
('engine-torque',5,3,100,'torque','El suelo se pone difícil','El tractor entra en tierra más dura. ¿Qué hace la reserva de par motor?',
 '[{"id":"stop","label":"Detiene el motor para protegerlo"},{"id":"extra","label":"Entrega fuerza adicional ante la resistencia, sin detener el motor"},{"id":"speed","label":"Aumenta siempre las revoluciones al máximo"}]',
 '"extra"','La reserva de par aporta fuerza extra ante una mayor resistencia, bajando un poco las revoluciones sin detener el motor. La clase indica una reserva del 20–25%.'),
('power-drawbar',6,4,67,'connect','Conectá la barra de tiro','Tocá la BARRA DE TIRO en el tractor. Después elegí la función que le corresponde.',
 '[{"id":"pull","label":"Arrastrar implementos"},{"id":"spin","label":"Transmitir movimiento giratorio"},{"id":"lift","label":"Levantar y sostener implementos"}]',
 '"pull"','La barra de tiro permite acoplar y arrastrar implementos. Se regula en altura y longitud.'),
('power-pto',7,4,67,'connect','Activá la toma de potencia','Tocá la TOMA DE POTENCIA en el tractor. Después conectala con su función.',
 '[{"id":"pull","label":"Arrastrar implementos"},{"id":"spin","label":"Transmitir movimiento giratorio"},{"id":"lift","label":"Levantar y sostener implementos"}]',
 '"spin"','La TDP transmite movimiento giratorio a los mecanismos del implemento. Sus velocidades de referencia son 540 y 1000 rpm.'),
('power-hitch',8,4,66,'connect','Prepará el enganche','Tocá el ENGANCHE DE TRES PUNTOS. Después elegí qué permite hacer con el implemento.',
 '[{"id":"pull","label":"Arrastrar implementos"},{"id":"spin","label":"Transmitir movimiento giratorio"},{"id":"lift","label":"Levantar y sostener implementos"}]',
 '"lift"','El enganche de tres puntos levanta y sostiene implementos acoplados. Sus dos brazos inferiores y el superior permiten montar equipos y regular la profundidad.'),
('day-slip',9,5,67,'slip','Encontrá el agarre justo','Estás en una tarea pesada. Ajustá el patinamiento al rango explicado en clase.',
 '[{"id":"zero","label":"0–2%"},{"id":"optimal","label":"5–12%"},{"id":"high","label":"20–30%"},{"id":"extreme","label":"40–50%"}]',
 '"optimal"','En tareas pesadas, el rango de referencia es 5–12%. Si falta agarre, la clase propone lastrado con contrapesos o hidroinflado, según la necesidad.'),
('day-road',10,5,67,'road','Del lote al camino','Terminaste la labor y vas a circular por asfalto. ¿Qué hacés con la doble tracción?',
 '[{"id":"on","label":"La mantengo conectada"},{"id":"off","label":"La desconecto antes de circular por asfalto"},{"id":"fast","label":"Acelero y la desconecto en movimiento"}]',
 '"off"','Según la microclase, hay que desconectar la doble tracción al circular por asfalto o caminos duros para evitar desgaste de cubiertas y daños en la transmisión.'),
('day-stop',11,5,66,'shutdown','Una buena jornada merece un buen cierre','El motor acaba de terminar un trabajo pesado. Elegí cómo apagarlo.',
 '[{"id":"now","label":"Lo apago de golpe"},{"id":"idle","label":"Lo dejo en ralentí unos minutos y después lo apago"},{"id":"rev","label":"Lo acelero al máximo y lo apago"}]',
 '"idle"','Dejá el motor en ralentí unos minutos antes de apagarlo. Así se enfría gradualmente y se cuidan el turbocompresor y la tapa de cilindros. Al terminar la tarea pesada también se retira el lastre innecesario.');
