-- === db/migraciones/008_access_audit.sql · EL RASTRO, QUE HASTA HOY SE SALTABA EN SILENCIO ==============
--
-- LA ORDEN DEL OWNER (2026-09-05, textual): «Haz la 008 con access_audit. Prefiero tener rastro: empresa
-- multiusuario + memoria entre sesiones lo necesitan. Si alguien cambia o borra una tesis/intención, debe
-- quedar quién, cuándo, rol y detalle.»
--
-- EL HALLAZGO QUE LA MOTIVA (verificado contra la base real): la 007 escribe en `access_audit` con una
-- cláusula defensiva (`exception when undefined_table then null`) y NINGUNA migración creaba la tabla — la
-- escritura del diario funcionaba y el rastro se saltaba en silencio. La cláusula defensiva SE QUEDA (es lo
-- que salvó la operación); lo que faltaba es esta tabla.
--
-- EL CONTRATO DE COLUMNAS LO FIJA EL INSERT QUE YA EXISTE en la 007: (tenant_id, actor_id, actor_label,
-- actor_rol, accion, detalle) + su `creado_en`. Esta migración no lo inventa: lo materializa.
--
-- APPEND-ONLY POR AUSENCIA (la doctrina de la 001/004/006): hay política de SELECT y de INSERT, y NO hay
-- política de UPDATE ni DELETE — con RLS habilitado, lo que no tiene política está negado. Un rastro que se
-- puede borrar no es rastro. El `detalle` lleva las CLAVES tocadas, jamás el contenido: el diario tiene
-- citas del dueño y no se duplican en la auditoría.
--
-- CÓMO SE APLICA: SQL Editor, después de la 007. Es idempotente — correrla dos veces seguidas es inocuo.

-- ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.access_audit (
  id          uuid        not null default gen_random_uuid() primary key,
  tenant_id   text        not null references public.tenants(id) on delete cascade,
  actor_id    uuid,
  actor_label text,
  actor_rol   text,
  accion      text        not null,
  detalle     jsonb       not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);

-- por si una versión previa de la tabla existiera con menos columnas (la orden: no romper si ya hay algo)
alter table public.access_audit add column if not exists actor_id    uuid;
alter table public.access_audit add column if not exists actor_label text;
alter table public.access_audit add column if not exists actor_rol   text;
alter table public.access_audit add column if not exists accion      text;
alter table public.access_audit add column if not exists detalle     jsonb default '{}'::jsonb;
alter table public.access_audit add column if not exists creado_en   timestamptz default now();

create index if not exists access_audit_por_tenant on public.access_audit (tenant_id, creado_en desc);

-- ── EL MURO ──────────────────────────────────────────────────────────────────────────────────────────
-- RLS por tenant, con la MISMA fuente de verdad que todo lo demás: el claim del pase (adi.tenant_actual()),
-- jamás un parámetro del cliente. Una empresa no lee la auditoría de otra.
alter table public.access_audit enable row level security;

drop policy if exists access_audit_lectura_del_pase   on public.access_audit;
create policy access_audit_lectura_del_pase on public.access_audit
  for select
  using (tenant_id = adi.tenant_actual());
-- ⚠️ LECTURA POR ROL (decisión del owner, dejada LISTA): hoy un tenant = un acceso, así que la lectura por
-- tenant equivale a la del dueño. El día que `memberships` tenga personas reales, la política de arriba se
-- reemplaza por esta (owner/admin solamente). OJO: exige que para entonces el pase lleve `actor_id` como
-- claim — hoy el pase firma {role, tenant_id} y nada más (src/data/paseTenant.js), así que esta política
-- activada HOY dejaría la lectura vacía. Por eso va comentada: es el plano, no el muro.
--   drop policy if exists access_audit_lectura_del_pase on public.access_audit;
--   create policy access_audit_lectura_del_pase on public.access_audit
--     for select using (tenant_id = adi.tenant_actual() and exists (
--       select 1 from public.memberships m
--        where m.tenant_id = access_audit.tenant_id
--          and m.user_id = (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'actor_id')::uuid
--          and m.rol in ('owner', 'admin')));

drop policy if exists access_audit_escritura_del_pase on public.access_audit;
create policy access_audit_escritura_del_pase on public.access_audit
  for insert
  with check (tenant_id = adi.tenant_actual());

-- SIN política de update ni delete: append-only. Y explícito además del RLS, por si algún rol heredara más:
revoke update, delete on public.access_audit from public;

-- ── LOS PERMISOS DEL ROL DEL PASE ────────────────────────────────────────────────────────────────────
-- ⚠️ SIN ESTA LÍNEA, LA 008 ROMPERÍA EL DIARIO EN VEZ DE COMPLETARLO: `adi_escribir_diario` es
-- `security invoker` — el insert del rastro corre como `adi_tenant`, y un `permission denied` NO es
-- `undefined_table`: la cláusula defensiva no lo atrapa y el guardado entero fallaría. Crear la tabla
-- obliga a otorgar el permiso en el mismo acto. Select para que la lectura por API quede lista (el muro
-- RLS ya acota al tenant del pase). Update y delete NO se otorgan: la otra mitad del append-only.
grant select, insert on public.access_audit to adi_tenant;

-- ── LA FUNCIÓN DEL DIARIO, RE-DECLARADA CON LA ACCIÓN DISTINGUIDA ────────────────────────────────────
-- La 007 registraba `accion: 'diario'` sin distinguir guardar de olvidar. El mínimo honesto que pidió el
-- owner («si alguien cambia o borra… debe quedar quién, cuándo, rol y detalle») es la acción con verbo:
-- `p_accion` ∈ {diario:guardar, diario:olvidar} — el servidor la infiere del objeto (vacío = olvido) y la
-- base la valida. La VERSIÓN CANÓNICA de `adi_escribir_diario` pasa a vivir acá (la de la 007 queda como
-- historia para bases que se detuvieron en ella).
--
-- ⚠️ PRIMERO SE RETIRA LA FIRMA VIEJA (4 parámetros). Un `create or replace` con la firma nueva NO la
-- reemplaza: en Postgres una firma distinta crea una SOBRECARGA, y con las dos vivas la llamada por nombre
-- (`adi_escribir_diario(p_diario => …)`) se vuelve ambigua — `function is not unique` — y el diario deja
-- de escribir. El drop es idempotente (`if exists`): correr la 008 dos veces es inocuo.
drop function if exists public.adi_escribir_diario(jsonb, uuid, text, text);

create or replace function public.adi_escribir_diario(
  p_diario      jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null,
  p_accion      text default 'diario'
)
returns table (version integer, diario jsonb)
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  select fpv.id into v_id
    from public.fact_pack_versions fpv
   where fpv.activa
   limit 1;

  if v_id is null then
    raise exception 'esta empresa no tiene datos activos: primero hay que cargar una planilla';
  end if;

  if p_diario is null or jsonb_typeof(p_diario) <> 'object' then
    raise exception 'el diario tiene que ser un objeto';
  end if;
  if exists (select 1 from jsonb_object_keys(p_diario) k where k not in ('tesis', 'intenciones')) then
    raise exception 'el diario solo guarda tesis e intenciones (v1)';
  end if;
  if p_diario ? 'intenciones' and (jsonb_typeof(p_diario->'intenciones') <> 'array'
     or jsonb_array_length(p_diario->'intenciones') > 10) then
    raise exception 'las intenciones son una lista de hasta 10';
  end if;
  if pg_column_size(p_diario) > 16384 then
    raise exception 'el diario supera el tamaño máximo (16KB)';
  end if;
  if p_accion is null or p_accion not in ('diario', 'diario:guardar', 'diario:olvidar') then
    raise exception 'la acción del diario tiene que ser diario:guardar o diario:olvidar';
  end if;

  update public.fact_pack_versions fpv
     set pack = jsonb_set(fpv.pack, '{perfil,diario}', p_diario, true)
   where fpv.id = v_id;

  -- el rastro — la cláusula defensiva SE QUEDA (fue la que evitó romper cuando la tabla no existía);
  -- desde la 008 la tabla existe y esto registra SIEMPRE, con las claves tocadas y jamás el contenido.
  begin
    insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
    select fpv.tenant_id, p_actor_id, p_actor_label, p_actor_rol, p_accion,
           jsonb_build_object('claves', coalesce((select jsonb_agg(k) from jsonb_object_keys(p_diario) k), '[]'::jsonb))
      from public.fact_pack_versions fpv where fpv.id = v_id;
  exception when undefined_table then null;
  end;

  return query
    select fpv.version, fpv.pack #> '{perfil,diario}'
      from public.fact_pack_versions fpv
     where fpv.id = v_id;
end;
$$;

grant execute on function public.adi_escribir_diario(jsonb, uuid, text, text, text) to adi_tenant;
