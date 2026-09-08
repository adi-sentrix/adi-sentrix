-- === db/migraciones/010_plan_y_ocultar.sql · EL PLAN DE LA EMPRESA Y EL «QUITAR DEL PANEL» ============
--
-- DOS ÓRDENES DEL OWNER (2026-09-08), textuales:
--   1. «los chat deben poder borrarse del panel, no de la data»
--   2. «el historial debemos permitirlo solo en la version de pago»
--
-- ⚠️ UNA ADVERTENCIA QUE VA ARRIBA PORQUE ES LA QUE IMPORTA. Quitar del panel sin borrar de la base es
-- legítimo —el dueño del producto decide qué conserva— pero SOLO si la pantalla dice exactamente eso. Un
-- botón que diga «Borrar» y no borre es una promesa falsa sobre el dato financiero de un cliente, y este
-- proyecto no las hace. Por eso el verbo de la base es OCULTAR, la acción auditada se llama
-- `conversacion:ocultar` y la pantalla dice «Quitar del panel». Si algún día hace falta el borrado real
-- (un cliente que exige que su conversación desaparezca), es OTRA acción, con su propio nombre y su rastro.
--
-- IDEMPOTENTE, como las anteriores: correrla dos veces es inocuo.

-- ── 1 · OCULTAR EN VEZ DE BORRAR ─────────────────────────────────────────────────────────────────────
alter table public.conversaciones add column if not exists oculta_en timestamptz;
comment on column public.conversaciones.oculta_en is
  'Cuándo el usuario la quitó de SU panel. La fila no se borra (orden del owner 2026-09-08): el historial deja de listarla, el dato queda.';

-- el índice del panel ahora ignora las ocultas: es el orden que la lista pide, no un filtro que se hace después
drop index if exists public.conversaciones_por_tenant;
create index if not exists conversaciones_visibles on public.conversaciones (tenant_id, actualizado_en desc)
  where oculta_en is null;

-- ── 2 · EL PLAN DE LA EMPRESA ────────────────────────────────────────────────────────────────────────
-- Vive en `tenants` y no en el pack: el plan es de la EMPRESA, no de una carga de datos — sobrevive a cada
-- planilla nueva y no se arrastra de versión en versión.
alter table public.tenants add column if not exists plan text not null default 'gratis';
comment on column public.tenants.plan is
  'gratis | pro. Gobierna las funciones de pago (hoy: el historial de conversaciones). El default es gratis: una función de pago que se activa sola no es una función de pago.';

-- ⚠️ LAS EMPRESAS QUE YA EXISTEN SE QUEDAN EN `pro`, y es deliberado: hoy todas tienen el historial andando y
-- una migración no puede quitarle a nadie algo que ya está usando. Lo que se estrena cerrado es lo NUEVO —el
-- default de arriba— no lo que ya funciona. Para probar la experiencia sin historial:
--     update public.tenants set plan = 'gratis' where id = 'demo';
update public.tenants set plan = 'pro' where plan is null or plan = 'gratis';

-- ── 3 · EL PLAN DE LA SESIÓN, DEL LADO DE LA BASE ────────────────────────────────────────────────────
-- ⚠️ POR QUÉ ACÁ Y NO SOLO EN EL SERVIDOR: la doctrina de la casa es que una regla que vive únicamente en el
-- código es una costumbre, no una garantía. El cobro es exactamente el tipo de regla que no puede depender de
-- que nadie se olvide de chequearla en una ruta nueva.
create or replace function adi.plan_actual()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select t.plan from public.tenants t where t.id = adi.tenant_actual()), 'gratis');
$$;
grant execute on function adi.plan_actual() to adi_tenant;

-- ── 4 · LAS CUATRO FUNCIONES DEL HISTORIAL, CON EL PLAN ADENTRO ──────────────────────────────────────
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
/* `use_column`: los nombres de `returns table (...)` son variables acá dentro y el `on conflict` no admite
 * calificar la columna — sin esto la función se crea bien y revienta al llamarla (42702). Ver la 009. */
#variable_conflict use_column
declare
  v_tenant text := adi.tenant_actual();
  v_nueva  boolean;
begin
  if v_tenant is null or p_hilo_id is null or length(trim(p_hilo_id)) = 0 then
    raise exception 'sin empresa o sin hilo: no se guarda una conversación anónima';
  end if;
  if adi.plan_actual() <> 'pro' then
    raise exception 'el historial de conversaciones es del plan pro';
  end if;
  if p_mensajes is null or jsonb_typeof(p_mensajes) <> 'array' then
    raise exception 'los mensajes son una lista';
  end if;
  if pg_column_size(p_mensajes) > 262144 then
    raise exception 'la conversación supera el tamaño máximo (256KB)';
  end if;

  select not exists (select 1 from public.conversaciones c
                      where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id) into v_nueva;

  insert into public.conversaciones as c (tenant_id, hilo_id, titulo, mensajes, actor_id, actor_label, actor_rol)
  values (v_tenant, p_hilo_id, coalesce(p_titulo, ''), p_mensajes, p_actor_id, p_actor_label, p_actor_rol)
  on conflict (tenant_id, hilo_id) do update
    set mensajes       = excluded.mensajes,
        titulo         = case when coalesce(c.titulo, '') = '' then excluded.titulo else c.titulo end,
        actualizado_en = now();

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

create or replace function public.adi_listar_conversaciones(p_limite integer default 50)
returns table (hilo_id text, titulo text, actualizado_en timestamptz, mensajes integer)
language sql
security invoker
as $$
  select c.hilo_id, c.titulo, c.actualizado_en, jsonb_array_length(c.mensajes)
    from public.conversaciones c
   where c.tenant_id = adi.tenant_actual()
     and c.oculta_en is null            -- quitada del panel: la fila queda, la lista no la muestra
     and adi.plan_actual() = 'pro'      -- sin plan, el historial no existe para esta empresa
   order by c.actualizado_en desc
   limit greatest(1, least(coalesce(p_limite, 50), 200));
$$;

create or replace function public.adi_leer_conversacion(p_hilo_id text)
returns table (hilo_id text, titulo text, mensajes jsonb, actualizado_en timestamptz)
language sql
security invoker
as $$
  select c.hilo_id, c.titulo, c.mensajes, c.actualizado_en
    from public.conversaciones c
   where c.tenant_id = adi.tenant_actual() and c.hilo_id = p_hilo_id
     and c.oculta_en is null
     and adi.plan_actual() = 'pro';
$$;

-- ── 5 · QUITAR DEL PANEL (la 009 la borraba; ahora la oculta) ────────────────────────────────────────
-- El nombre de la función se conserva para no romper a quien ya la llama, pero su CONDUCTA es la que el owner
-- pidió y el rastro lo dice con la palabra correcta: `conversacion:ocultar`, no «borrar».
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
  if v_tenant is null then raise exception 'sin empresa: no se oculta nada'; end if;
  update public.conversaciones c
     set oculta_en = now()
   where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id and c.oculta_en is null;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    begin
      insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
      values (v_tenant, p_actor_id, p_actor_label, p_actor_rol, 'conversacion:ocultar',
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
