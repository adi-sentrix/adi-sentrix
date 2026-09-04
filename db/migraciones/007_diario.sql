-- === db/migraciones/007_diario.sql · EL DIARIO DE LA RELACIÓN, QUE ES MEMORIA Y NO DATO =================
--
-- LA ORDEN DEL OWNER (GO 2026-09-05, sobre _DIARIO_ETAPA2_PLAN.md): que ADI llegue el lunes recordando la
-- tesis del jueves y las respuestas de intención del dueño («el volumen de Falabella es apuesta mía»), y que
-- confirme o corrija en voz alta RE-MIDIENDO — jamás repitiendo de memoria.
--
-- ⚠️ NO SE CREA NINGUNA TABLA, Y ES DELIBERADO — el patrón EXACTO de la 006 (política de cobro): el diario
-- vive en `perfil.diario` de la versión ACTIVA del pack, porque el pack es autosuficiente para siempre (la
-- decisión del owner en la vía 3): un pack leído dentro de un año sabe con qué memoria habló ADI ese mes.
-- Se arrastra a la versión siguiente en `persistirCarga` (el mismo arrastre del cobro) — y el arrastre copia
-- el objeto TAL CUAL: lo que el usuario borró NO está en el objeto, así que una carga nueva no lo revive.
--
-- ⚠️ ESCRIBE SOBRE LA VERSIÓN ACTIVA, y eso NO rompe el append-only: lo inmutable es el HECHO (las ventas,
-- los abonos, el archivo original), no la relación con la que se lee — la doctrina de la 004 y la 006.
--
-- QUÉ GUARDA (v1, y nada más): { tesis: {clave, resumen, huella, fecha, carga, origenTurno} | null,
--   intenciones: [{cita, pregunta, entidades, fecha, carga}] (tope 10) }.
-- La regla de oro del diseño: al diario solo entra lo que pasó por un turno VERIFICADO; la cita es la frase
-- del usuario, textual — nunca prosa libre del modelo. El SERVIDOR arma el objeto final (read-modify-write
-- con estas dos funciones); la base valida FORMA y TAMAÑO, porque una regla que solo vive en el servidor es
-- una costumbre, no una garantía.
--
-- CÓMO SE APLICA: SQL Editor, después de la 006. Es idempotente.

-- ── LEER EL DIARIO ───────────────────────────────────────────────────────────────────────────────────
-- La versión activa de la empresa del pase; RLS acota a esa empresa. Devuelve el diario o un objeto vacío.
create or replace function public.adi_leer_diario()
returns jsonb
language sql
security invoker
as $$
  select coalesce(fpv.pack #> '{perfil,diario}', '{}'::jsonb)
    from public.fact_pack_versions fpv
   where fpv.activa
   limit 1;
$$;

-- ── ESCRIBIR EL DIARIO ───────────────────────────────────────────────────────────────────────────────
-- Recibe el diario COMPLETO ya armado por el servidor (guardar = merge, olvidar = quitar — la mutación es
-- del servidor; la base escribe el resultado y lo devuelve, para que nadie tenga que adivinar qué quedó).
-- ⚠️ LA VERSIÓN CANÓNICA DE ESTA FUNCIÓN VIVE EN LA 008 (agrega `p_accion` para distinguir guardar de
-- olvidar en el rastro, y retira esta firma para que no queden dos sobrecargas). Esta queda como historia
-- para leer la base tal como estuvo entre la 007 y la 008 — esta migración NO se reescribe: ya corrió.
create or replace function public.adi_escribir_diario(
  p_diario      jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
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

  -- FORMA: un objeto con a lo sumo {tesis, intenciones}; lo que no se entiende se RECHAZA, nunca se aproxima.
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
  -- TAMAÑO: un diario no es un log con otro nombre (el tope del diseño). 16KB sobran para v1.
  if pg_column_size(p_diario) > 16384 then
    raise exception 'el diario supera el tamaño máximo (16KB)';
  end if;

  update public.fact_pack_versions fpv
     set pack = jsonb_set(fpv.pack, '{perfil,diario}', p_diario, true)
   where fpv.id = v_id;

  -- el rastro de QUIÉN, con el mecanismo de la 005 (si la tabla de auditoría existe, se anota; si no, no rompe)
  begin
    insert into public.access_audit (tenant_id, actor_id, actor_label, actor_rol, accion, detalle)
    select fpv.tenant_id, p_actor_id, p_actor_label, p_actor_rol, 'diario', jsonb_build_object('claves', (select array_agg(k) from jsonb_object_keys(p_diario) k))
      from public.fact_pack_versions fpv where fpv.id = v_id;
  exception when undefined_table then null;
  end;

  return query
    select fpv.version, fpv.pack #> '{perfil,diario}'
      from public.fact_pack_versions fpv
     where fpv.id = v_id;
end;
$$;
