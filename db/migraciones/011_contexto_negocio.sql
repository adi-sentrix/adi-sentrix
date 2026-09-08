-- === db/migraciones/011_contexto_negocio.sql · «TU NEGOCIO» — EL CONTEXTO DECLARADO POR EL DUEÑO ======
--
-- LA ORDEN DEL OWNER (2026-09-08), con sus reglas textuales: «Sí, construirlo como Pro. Me gusta el concepto
-- "Tu negocio": contexto visible, criterios y diario en un solo lugar.» Reglas: el contexto no es fuente de
-- cifras · se cita como declarado, no como dato medido · cada edición queda auditada · tope de tamaño para
-- controlar costo · aislado por empresa · sobrevive a nuevas cargas.
--
-- QUÉ ES Y QUÉ NO ES. El contexto es EL NEGOCIO EN PALABRAS DE SU DUEÑO («el volumen en los grandes es
-- criterio estratégico de ventas»): orienta la LECTURA de ADI, jamás sus números. Las cifras salen del pack y
-- de ningún otro lado — esa frontera la sostiene el notario del turno, no esta migración; acá lo que se fija
-- es dónde vive, quién lo puede tocar y qué rastro deja.
--
-- DÓNDE VIVE: `perfil.contexto` de la versión ACTIVA, como el diario (007) — viaja DENTRO del pack que
-- adi-data ya sirve (cero fetch extra), el arrastre de `persistirCarga` lo lleva a cada versión nueva
-- («sobrevive a nuevas cargas»), y el muro RLS del pack lo aísla por empresa.
--
-- IDEMPOTENTE, como todas: correrla dos veces es inocuo.

-- ── LEER ─────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.adi_leer_contexto()
returns jsonb
language sql
security invoker
as $$
  select coalesce(fpv.pack #> '{perfil,contexto}', '{}'::jsonb)
    from public.fact_pack_versions fpv
   where fpv.activa
   limit 1;
$$;

-- ── ESCRIBIR ─────────────────────────────────────────────────────────────────────────────────────────
-- Recibe el contexto COMPLETO ya saneado por el servidor: {texto, fecha} — texto vacío = contexto borrado.
create or replace function public.adi_escribir_contexto(
  p_contexto    jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns table (version integer, contexto jsonb)
language plpgsql
security invoker
as $$
/* `use_column`: la lección de la 009 — los nombres de `returns table` son variables acá dentro. */
#variable_conflict use_column
declare
  v_id uuid;
begin
  select fpv.id into v_id from public.fact_pack_versions fpv where fpv.activa limit 1;
  if v_id is null then
    raise exception 'esta empresa no tiene datos activos: primero hay que cargar una planilla';
  end if;

  -- PRO, VALIDADO EN LA BASE: el contexto es de la misma suite de memoria que el historial, y el cobro es
  -- justo la regla que no puede depender de que nadie se olvide de chequearla en una ruta nueva (la 010).
  if adi.plan_actual() <> 'pro' then
    raise exception 'el contexto del negocio es del plan pro';
  end if;

  -- FORMA: {texto, fecha} y nada más. Lo que no se entiende se RECHAZA, nunca se aproxima (la regla del diario).
  if p_contexto is null or jsonb_typeof(p_contexto) <> 'object' then
    raise exception 'el contexto tiene que ser un objeto';
  end if;
  if exists (select 1 from jsonb_object_keys(p_contexto) k where k not in ('texto', 'fecha')) then
    raise exception 'el contexto solo guarda texto y fecha (v1)';
  end if;
  -- EL TOPE DEL OWNER («tope de tamaño para controlar costo»): 2.000 caracteres de texto. El contexto viaja
  -- en cada pregunta que el negocio hace — sin techo, cada turno se encarece sin que nadie lo haya decidido.
  if length(coalesce(p_contexto->>'texto', '')) > 2000 then
    raise exception 'el contexto supera el tamaño máximo (2000 caracteres)';
  end if;

  update public.fact_pack_versions fpv
     set pack = jsonb_set(fpv.pack, '{perfil,contexto}', p_contexto, true)
   where fpv.id = v_id;

  -- «CADA EDICIÓN QUEDA AUDITADA» (regla del owner): quién, cuándo, rol — y si fue edición o borrado. El
  -- detalle lleva el LARGO del texto, jamás el texto: lo declarado vive en el contexto, no en la auditoría.
  begin
    insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
    select fpv.tenant_id, p_actor_id, p_actor_label, p_actor_rol,
           case when length(coalesce(p_contexto->>'texto', '')) = 0 then 'contexto:borrar' else 'contexto:editar' end,
           jsonb_build_object('caracteres', length(coalesce(p_contexto->>'texto', '')))
      from public.fact_pack_versions fpv where fpv.id = v_id;
  exception when undefined_table then null;
  end;

  return query
    select fpv.version, fpv.pack #> '{perfil,contexto}'
      from public.fact_pack_versions fpv
     where fpv.id = v_id;
end;
$$;

grant execute on function public.adi_leer_contexto()                                    to adi_tenant;
grant execute on function public.adi_escribir_contexto(jsonb, uuid, text, text)         to adi_tenant;
