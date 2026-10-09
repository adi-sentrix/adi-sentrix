-- === db/migraciones/016_libro_de_conversacion_64kb.sql · EL LIBRO DE CONVERSACIÓN SUBE DE 16 KB A 64 KB ===============================
-- (owner 2026-10-09, ensayo 11 de la medición con anfitrión — `_ADI_DISENO_CONTRATO_ANFITRION.md` §17)
--
-- QUÉ RESUELVE. El ensayo 11 mostró que una Entrega amplia («¿cómo viene el año?» de Río Claro: 125 cifras con id) llena sola los 16 KB que la 015 le pone a
-- `conversaciones.estado`: al segundo `derivar` del mismo mensaje ADI tenía que recortar las cifras de esa Entrega y el anfitrión, que ya había emitido las demás
-- llamadas, recibía `entrega_recortada` sobre una derivación válida. El owner decidió subir el tope a 64 KB. Textual: «la garantía importante no es el número
-- exacto: no puede haber pérdida silenciosa de hechos por capacidad o por cálculos paralelos. Si se alcanza un límite, el anfitrión debe saberlo antes de
-- utilizar una memoria incompleta» — eso lo hace el código (`continuidad/libro.js:estadoDeLaMemoria`: `memoria` en toda respuesta; `id_recortado`); el tope es solo
-- el espacio que se le da antes de tener que recortar.
--
-- ⚠️ ESTO ES UN ARCHIVO, NO UN HECHO EN LA BASE — igual que 012 a 015, sin aplicar contra ningún proyecto de Supabase: aplicar una migración es un paso de
-- despliegue y esta tarea no tiene esa autorización. La 015 tampoco está aplicada en producción, pero NO se edita: las migraciones son históricas (la 013 corrige
-- a la 012 y la 015 a la 012 con `create or replace`, sin reescribirla) y un candado, `_migracion_015_gate`, la lee tal cual. Esta migración corrige el tope con
-- un `check` nuevo y `create or replace`. SE APLICA DESPUÉS DE LA 015 (necesita la columna `estado` y la función de guardado). Es idempotente.
--
-- EL NÚMERO. 65536 = `libro.js:LIBRO_TOPE_BYTES` (64 * 1024); `_migracion_015_gate` compara los dos textos para que no diverjan en silencio (un `.sql` no puede
-- importar un `.js`). `pg_column_size(estado)` mide el jsonb como lo guarda Postgres; el código mide la FORMA GUARDADA (`comprimirLibro`).

-- ── 1 · EL CHECK DE LA TABLA ───────────────────────────────────────────────────────────────────────────────────
alter table public.conversaciones drop constraint if exists conversaciones_estado_tamano_check;
alter table public.conversaciones add constraint conversaciones_estado_tamano_check
  check (pg_column_size(estado) <= 65536);

comment on column public.conversaciones.estado is
  'El libro de conversación (continuidad/libro.js, Etapa 2): turno, criterio vigente, supuestos vivos (≤3), entregas como REFERENCIAS (ids + versión de datos, nunca prosa), premisas tipadas con veredicto, ofertas en pie, hechos aportados a memoria_empresa. Tope de 64KB (016; 16KB en la 015) — lo aplica el código (libro.js:recortarATope) antes de guardar y lo dice en toda respuesta (memoria); el check de la tabla es el respaldo estructural.';

-- ── 2 · LA GUARDA DE `adi_guardar_estado_conversacion` — la misma función de la 015, con el tope nuevo (create or replace) ──────────────────────────
create or replace function public.adi_guardar_estado_conversacion(
  p_hilo_id     text,
  p_estado      jsonb,
  p_actor_id    uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns table (hilo_id text, estado jsonb, actualizado_en timestamptz)
language plpgsql
security invoker
as $$
/* ⚠️ `use_column`: la lección de la 009 — los nombres de `returns table` son variables PL/pgSQL acá dentro, y
 * `on conflict (tenant_id, hilo_id)` no admite calificar la columna. */
#variable_conflict use_column
declare
  v_tenant text := adi.tenant_actual();
  v_estado jsonb;
  v_n      integer;
begin
  if v_tenant is null or p_hilo_id is null or length(trim(p_hilo_id)) = 0 then
    raise exception 'sin empresa o sin hilo: no se guarda un libro anónimo';
  end if;
  if p_estado is null or jsonb_typeof(p_estado) <> 'object' then
    raise exception 'el libro de conversación tiene que ser un objeto';
  end if;
  -- ★ EL ORIGEN LO SELLA LA BASE (D3): este hilo es del Complemento, lo diga o no quien llama.
  v_estado := jsonb_set(p_estado, '{origen}', to_jsonb('complemento'::text));
  if pg_column_size(v_estado) > 65536 then
    raise exception 'el libro de conversación supera el tamaño máximo (64KB)';
  end if;

  insert into public.conversaciones as c (tenant_id, hilo_id, titulo, mensajes, estado, actor_id, actor_label, actor_rol)
  values (v_tenant, p_hilo_id, '', '[]'::jsonb, v_estado, p_actor_id, p_actor_label, p_actor_rol)
  on conflict (tenant_id, hilo_id) do update
    set estado         = excluded.estado,
        actualizado_en = now()
    -- nunca se escribe un libro ENCIMA de un hilo del chat de la app (lo haría desaparecer de su Historial)
    where coalesce(c.estado ->> 'origen', 'app') = 'complemento';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'ese hilo es una conversación del chat de la app: no se guarda un libro encima';
  end if;

  return query
    select c.hilo_id, c.estado, c.actualizado_en
      from public.conversaciones c
     where c.tenant_id = v_tenant and c.hilo_id = p_hilo_id;
end;
$$;

grant execute on function public.adi_guardar_estado_conversacion(text, jsonb, uuid, text, text) to adi_tenant;
