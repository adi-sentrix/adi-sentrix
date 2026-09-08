-- === db/migraciones/009_conversaciones.sql · EL HISTORIAL DE CONVERSACIONES ===========================
--
-- LA ORDEN DEL OWNER (2026-09-08), textual: «no tiene el panel para crear un nuevo chat, y guardando el
-- historial etc. tal como lo hago con claude o gpt» — y con la referencia en pantalla: una columna con
-- «Nuevo chat» arriba y «Recientes» debajo, donde cada conversación se vuelve a abrir con un clic.
--
-- POR QUÉ UNA TABLA PROPIA Y NO EL PACK. El diario vive en `perfil.diario` porque es CHICO, es de la relación
-- y viaja bien con la versión activa. Una conversación es lo contrario: crece sin techo natural, no es política
-- del negocio, y el arrastre entre versiones la copiaría entera cada vez que el cliente sube una planilla.
-- Va en su tabla, con su propio ciclo de vida.
--
-- LAS TRES DECISIONES DE PRODUCTO QUE ESTA MIGRACIÓN FIJA (y el owner puede cambiar):
--   · BORRAR SE PUEDE, Y QUEDA AUDITADO. Es la misma regla que él aprobó para el diario («olvidar» deja su
--     fila). Un historial que no se puede borrar es una jaula; un borrado que no deja rastro, en una empresa
--     multiusuario, es un agujero. Se borra de verdad —la fila se va— y el rastro dice quién y cuándo.
--   · NO HAY EXPIRACIÓN AUTOMÁTICA. Nada se borra solo: borrar el trabajo de alguien por una fecha es una
--     decisión del dueño, no del sistema. Lo que sí hay es un TECHO POR CONVERSACIÓN (256 KB), porque un
--     historial sin límite de tamaño es un log con otro nombre — la misma doctrina del diario.
--   · EL TÍTULO ES DETERMINÍSTICO: la primera pregunta del usuario, recortada. CERO llamadas al modelo. Un
--     título bonito generado por IA costaría dinero en cada conversación y no vale lo que cuesta.
--
-- IDEMPOTENTE, como las tres anteriores: correrla dos veces seguidas es inocuo.

-- ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.conversaciones (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.tenants(id) on delete cascade,
  hilo_id        text        not null,          -- el `conversationId` que ChatADI ya genera por hilo
  titulo         text        not null default '',
  mensajes       jsonb       not null default '[]'::jsonb,
  actor_id       uuid,
  actor_label    text,
  actor_rol      text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- por si una versión previa existiera con menos columnas (la orden del owner: no romper si ya hay algo)
alter table public.conversaciones add column if not exists titulo         text not null default '';
alter table public.conversaciones add column if not exists mensajes       jsonb not null default '[]'::jsonb;
alter table public.conversaciones add column if not exists actor_id       uuid;
alter table public.conversaciones add column if not exists actor_label    text;
alter table public.conversaciones add column if not exists actor_rol      text;
alter table public.conversaciones add column if not exists creado_en      timestamptz not null default now();
alter table public.conversaciones add column if not exists actualizado_en timestamptz not null default now();

-- UNA fila por hilo y por empresa: guardar el mismo hilo dos veces ACTUALIZA, no duplica. Es lo que hace
-- que el guardado pueda correr en cada turno sin llenar la tabla de copias de la misma conversación.
create unique index if not exists conversaciones_hilo_unico on public.conversaciones (tenant_id, hilo_id);
-- el orden del panel: lo más reciente primero, filtrado por empresa.
create index if not exists conversaciones_por_tenant on public.conversaciones (tenant_id, actualizado_en desc);

-- ── EL MURO ──────────────────────────────────────────────────────────────────────────────────────────
-- La MISMA fuente de verdad que el resto: el claim del pase (`adi.tenant_actual()`), jamás un parámetro del
-- cliente. Una empresa no lee, no escribe y no borra las conversaciones de otra.
-- ⚠️ Y ACÁ EL MURO PESA MÁS QUE EN NINGUNA OTRA TABLA: el diario guarda una tesis y unas citas; esto guarda
-- las preguntas del dueño y las respuestas con sus cifras — el negocio entero, conversado.
alter table public.conversaciones enable row level security;

drop policy if exists conversaciones_lectura_del_pase on public.conversaciones;
create policy conversaciones_lectura_del_pase on public.conversaciones
  for select
  using (tenant_id = adi.tenant_actual());

drop policy if exists conversaciones_escritura_del_pase on public.conversaciones;
create policy conversaciones_escritura_del_pase on public.conversaciones
  for insert
  with check (tenant_id = adi.tenant_actual());

drop policy if exists conversaciones_actualizacion_del_pase on public.conversaciones;
create policy conversaciones_actualizacion_del_pase on public.conversaciones
  for update
  using (tenant_id = adi.tenant_actual())
  with check (tenant_id = adi.tenant_actual());

-- ⚠️ ACÁ SÍ HAY BORRADO, y es la diferencia deliberada con `access_audit` y con las cargas. Aquellas son
-- append-only porque son el REGISTRO de lo que pasó: borrarlas sería reescribir la historia. Una conversación
-- es trabajo del usuario, y el dueño de su trabajo decide si lo tira. Lo que NO se puede borrar es el rastro
-- de que lo tiró: eso vive en `access_audit`, que sigue siendo append-only.
drop policy if exists conversaciones_borrado_del_pase on public.conversaciones;
create policy conversaciones_borrado_del_pase on public.conversaciones
  for delete
  using (tenant_id = adi.tenant_actual());

grant select, insert, update, delete on public.conversaciones to adi_tenant;

-- ── GUARDAR (upsert por hilo) ────────────────────────────────────────────────────────────────────────
create or replace function public.adi_guardar_conversacion(
  p_hilo_id     text,
  p_titulo      text,
  p_mensajes    jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns table (hilo_id text, titulo text, actualizado_en timestamptz)
language plpgsql
security invoker
as $$
/* ⚠️ `use_column` NO ES DECORACIÓN: sin esta línea la función se crea sin quejarse y REVIENTA AL LLAMARLA con
 * «column reference "hilo_id" is ambiguous» (42702). Los nombres de `returns table (...)` son variables PL/pgSQL
 * dentro del cuerpo, y el `on conflict (tenant_id, hilo_id)` de más abajo no admite calificar la columna —
 * así que PostgreSQL no sabe si ese `hilo_id` es la columna o la variable de salida. Medido contra la base
 * real: la primera versión de esta migración dio Success al correrla y falló en el primer guardado.
 * Ningún candado offline lo podía ver: es semántica de Postgres, no texto. La verificación en vivo sí. */
#variable_conflict use_column
declare
  v_tenant text := adi.tenant_actual();
  v_nueva  boolean;
begin
  if v_tenant is null or p_hilo_id is null or length(trim(p_hilo_id)) = 0 then
    raise exception 'sin empresa o sin hilo: no se guarda una conversación anónima';
  end if;
  if p_mensajes is null or jsonb_typeof(p_mensajes) <> 'array' then
    raise exception 'los mensajes son una lista';
  end if;
  -- TAMAÑO: un historial no es un log con otro nombre. 256KB por conversación es holgado (≈80 turnos largos)
  -- y sigue siendo un techo. Sin techo, una sola conversación puede volverse un problema de la base.
  if pg_column_size(p_mensajes) > 262144 then
    raise exception 'la conversación supera el tamaño máximo (256KB)';
  end if;

  select not exists (select 1 from public.conversaciones c
                      where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id) into v_nueva;

  insert into public.conversaciones as c (tenant_id, hilo_id, titulo, mensajes, actor_id, actor_label, actor_rol)
  values (v_tenant, p_hilo_id, coalesce(p_titulo, ''), p_mensajes, p_actor_id, p_actor_label, p_actor_rol)
  on conflict (tenant_id, hilo_id) do update
    set mensajes       = excluded.mensajes,
        -- el título se fija con la PRIMERA pregunta y no se re-escribe: una conversación que cambia de nombre
        -- a mitad de camino es una conversación que el usuario ya no reconoce en la lista.
        titulo         = case when coalesce(c.titulo, '') = '' then excluded.titulo else c.titulo end,
        actualizado_en = now();

  -- EL RASTRO · solo al ABRIR la conversación, no en cada turno: auditar cada tecla convertiría el registro
  -- en ruido y escondería lo que importa (quién abrió y quién borró). El detalle lleva el CONTEO, jamás el
  -- contenido — la misma regla que el diario: lo que se conversó vive en la conversación, no en la auditoría.
  if v_nueva then
    begin
      insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
      values (v_tenant, p_actor_id, p_actor_label, p_actor_rol, 'conversacion:abrir',
              jsonb_build_object('hilo', p_hilo_id, 'mensajes', jsonb_array_length(p_mensajes)));
    exception when undefined_table then null;
    end;
  end if;

  return query
    select c.hilo_id, c.titulo, c.actualizado_en
      from public.conversaciones c
     where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id;
end;
$$;

-- ── LISTAR (el panel) ────────────────────────────────────────────────────────────────────────────────
-- SIN los mensajes a propósito: el panel solo necesita el nombre y la fecha. Traer el contenido de 50
-- conversaciones para pintar una lista sería mover megabytes para mostrar títulos.
create or replace function public.adi_listar_conversaciones(p_limite integer default 50)
returns table (hilo_id text, titulo text, actualizado_en timestamptz, mensajes integer)
language sql
security invoker
as $$
  select c.hilo_id, c.titulo, c.actualizado_en, jsonb_array_length(c.mensajes)
    from public.conversaciones c
   where c.tenant_id = adi.tenant_actual()
   order by c.actualizado_en desc
   limit greatest(1, least(coalesce(p_limite, 50), 200));
$$;

-- ── ABRIR UNA ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.adi_leer_conversacion(p_hilo_id text)
returns table (hilo_id text, titulo text, mensajes jsonb, actualizado_en timestamptz)
language sql
security invoker
as $$
  select c.hilo_id, c.titulo, c.mensajes, c.actualizado_en
    from public.conversaciones c
   where c.tenant_id = adi.tenant_actual() and c.hilo_id = p_hilo_id;
$$;

-- ── BORRAR (con su rastro, que es lo que NO se puede borrar) ──────────────────────────────────────────
create or replace function public.adi_borrar_conversacion(
  p_hilo_id     text,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_tenant text := adi.tenant_actual();
  v_n      integer;
begin
  if v_tenant is null then raise exception 'sin empresa: no se borra nada'; end if;
  delete from public.conversaciones c
   where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id;
  get diagnostics v_n = row_count;

  -- el rastro va SIEMPRE que algo se haya borrado — la regla del owner: «si alguien cambia o borra una
  -- tesis/intención, debe quedar quién, cuándo, rol y detalle». Vale igual para una conversación.
  if v_n > 0 then
    begin
      insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
      values (v_tenant, p_actor_id, p_actor_label, p_actor_rol, 'conversacion:borrar',
              jsonb_build_object('hilo', p_hilo_id));
    exception when undefined_table then null;
    end;
  end if;
  return v_n;
end;
$$;

grant execute on function public.adi_guardar_conversacion(text, text, jsonb, uuid, text, text) to adi_tenant;
grant execute on function public.adi_listar_conversaciones(integer)                             to adi_tenant;
grant execute on function public.adi_leer_conversacion(text)                                    to adi_tenant;
grant execute on function public.adi_borrar_conversacion(text, uuid, text, text)                to adi_tenant;
