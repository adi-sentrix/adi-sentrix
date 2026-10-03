-- === db/migraciones/015_memoria_empresa_y_conversacion.sql · LA CONTINUIDAD FACTUAL, EN LA BASE ==============
-- (Etapa 2 · Carril B · `_ADI_PLAN_PRODUCTO_V2.md` B4 · diseño `_ADI_DISENO_FLUJO_V2.md` §B + REVISIÓN 2/3)
--
-- LA LEY MADRE DE ESTA PIEZA (owner, textual, 2026-09-25): «No acepto que la continuidad factual del producto
-- dependa de la memoria del LLM.» Y REVISIÓN 3 §2: «Tres dueños, sin copias: los DATOS MEDIDOS viven en las
-- cargas; LO QUE LA EMPRESA ES Y DECLARA (perfil, criterios, hechos declarados, documentos) vive en la empresa,
-- sobrevive a las cargas, con vigencia y período, y se reemplaza con historia, nunca en silencio; las
-- CONVERSACIONES solo guardan referencias… más lo que es propio de la conversación.»
--
-- ⚠️ ESTO ES UN ARCHIVO, NO UN HECHO EN LA BASE — igual que 012/013/014: no se aplicó contra ningún proyecto de
-- Supabase. Aplicar una migración es un paso de despliegue que esta tarea no tiene autorización de dar.
--
-- CUATRO PIEZAS, EN ESTE ORDEN:
--   1 · `memoria_empresa` — tabla NUEVA (la ÚNICA memoria de empresa: absorbe lo que hoy vive disperso en
--       `pack.perfil.diario` (007) y `pack.perfil.contexto` (011) — REVISIÓN 2 del supervisor, textual: «UNA
--       memoria de empresa que absorbe diario y contexto, con migración de datos», en vez de una TERCERA tabla
--       de memoria al lado de esas dos). Guarda SOLO lo que la empresa DECLARA o APORTA (criterios, hechos,
--       documentos) — nunca un dato medido: eso sigue viviendo en `fact_pack_versions`. El PERFIL (sector, tipo
--       de producto, país, modelo comercial, banda, moneda) NO se mueve acá: sigue en las columnas de `tenants`
--       (012/013) — esta migración solo le agrega el origen que le faltaba (pieza 3).
--   2 · `conversaciones.estado` — la columna NUEVA donde vive el libro de conversación (`continuidad/libro.js`).
--       Ley del owner (2026-09-26, textual): «el libro de conversación va como `estado` en la tabla
--       `conversaciones` de la migración 009, no en tabla nueva» — así que esta migración NO crea
--       `libro_conversacion` (esa tabla estaba en el diseño §B original; la corrige la ley de arriba).
--   3 · EL PERFIL — la ley de los cuatro orígenes, aplicada CAMPO POR CAMPO (§4). Owner, textual (2026-09-25):
--       «medido · documento · declarado · supuesto, SIEMPRE distinguibles». Owner, textual, sobre el perfil
--       (2026-09-26, al revisar esta pieza): «el perfil y la moneda son atributos persistentes de la empresa,
--       no del archivo, y ADI debe recordarlos SIN INFERIRLOS».
--       ⚠️ CORRECCIÓN DEL SUPERVISOR, EN DOS RONDAS. La PRIMERA versión de esta migración solo AGREGABA
--       `'declarado'` a los cinco checks del perfil (sector/tipo_producto/país/modelo_comercial/banda),
--       dejando `'medido'`/`'derivado'` admitidos también, y dejaba `moneda_procedencia` intacta («SOLO
--       `medido`»), razonando que en el vocabulario de 012 `'medido'` YA significaba «lo declaró el usuario».
--       Las DOS cosas eran la MISMA mezcla de procedencias que el owner prohibió: en el vocabulario de
--       `notario/hechos.js:ORIGENES`, «medido» es lo que ADI MIDE sobre el dato de la empresa — nunca lo que la
--       empresa declara. El supervisor corrigió primero la moneda y después extendió la misma corrección al
--       resto del perfil: sector, tipo de producto, país y modelo comercial los declara SIEMPRE la empresa
--       (nunca los mide ni los deriva ADI) → su única procedencia correcta es `'declarado'`, sin admitir
--       `'medido'` ni `'derivado'`. La EXCEPCIÓN es la banda de tamaño: `bandaTamano.js` la CALCULA siempre —
--       «no se pregunta, se calcula» (owner 2026-09-23) — así que su única procedencia correcta es `'derivado'`,
--       sin admitir `'declarado'` ni `'medido'`. Los valores `'medido'` que ya existieran se migran a
--       `'declarado'` (sector/tipo_producto/país/modelo_comercial/moneda) o se limpian (banda, §4).
--   4 · `adi_declarar_perfil_empresa` redefinida (§5) para escribir el origen CORRECTO de los seis campos
--       (los cinco del perfil + moneda) de ahora en más, sin confiar en lo que el caller le pase.
--
-- IDEMPOTENTE, como las cinco anteriores: correrla dos veces seguidas es inocua.

-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · `memoria_empresa` · la memoria única — criterios declarados, hechos declarados, documentos
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- CADA FILA ES INMUTABLE UNA VEZ ESCRITA (el mismo principio append-only que `access_audit`): un cambio de
-- valor es una fila NUEVA con `reemplaza` apuntando a la vieja, y la vieja pasa a `estado = 'retirado'` — nunca
-- un UPDATE que borre lo que decía antes («vigencia e historia», REVISIÓN 3 §2). Los ÚNICOS campos que un
-- UPDATE puede tocar después de creada la fila son `estado`, `confirmacion` y `reemplaza` (ver §2, las
-- funciones no aceptan cambiar `valor`, `concepto` ni `origen`).
create table if not exists public.memoria_empresa (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.tenants(id) on delete cascade,
  -- 'perfil' NO vive acá (sigue en `tenants`, 012/013): esta tabla es solo criterio·hecho·documento.
  clase           text        not null check (clase in ('criterio', 'hecho', 'documento')),
  concepto        text        not null check (length(trim(concepto)) > 0),
  eje             text,
  entidad         text,
  periodo         text,
  valor           jsonb,                        -- {raw?, unidad?, texto?} — el mismo par que ya usa `perfil.diario`/`contexto`
  -- subconjunto ESTRICTO de `notario/hechos.js:ORIGENES` (medido·documento·declarado·supuesto): acá nunca
  -- "medido" (eso es del pack) ni "supuesto" (eso es del motor de escenarios, vive en el turno, no en la empresa).
  origen          text        not null check (origen in ('declarado', 'documento')),
  documento       jsonb,                        -- {nombre, tipo, parte, extraidoPor, sello: extraido|confirmado|verificado, huella?} — REVISIÓN 3 §4
  confirmacion    jsonb,                        -- {por, cuando, medio, sobre} — un sello APARTE; NUNCA cambia `origen`
  estado          text        not null default 'vigente' check (estado in ('pendiente', 'vigente', 'retirado', 'omitido')),
  declarado_en    timestamptz not null default now(),
  actor_label     text,
  conversacion_id text,                          -- el `hilo_id`/conversacionId donde se aportó (o null: fuera de una conversación)
  reemplaza       uuid        references public.memoria_empresa(id),
  -- un documento SIN el objeto `documento` no es un documento; un declarado/criterio/hecho normal no lo trae.
  constraint memoria_empresa_documento_si_origen_documento
    check ((origen = 'documento') = (documento is not null))
);

comment on table public.memoria_empresa is
  'La memoria única de empresa (Etapa 2, owner 2026-09-25/26): criterios declarados, hechos declarados y documentos, cada uno con origen, confirmación, vigencia e historia. Absorbe en su diseño lo que hoy vive en pack.perfil.diario (007) y pack.perfil.contexto (011) — la migración de esos DATOS es un paso de despliegue aparte; mientras tanto `continuidad/empresa.js:memoriaDeEmpresa` los traduce EN LECTURA para que nada se pierda. El perfil (sector/tipo_producto/país/modelo_comercial/banda/moneda) sigue en `tenants` (012/013): no es de esta tabla.';

create index if not exists memoria_empresa_por_tenant on public.memoria_empresa (tenant_id, estado, clase);
-- la llave de colisión que usa `continuidad/empresa.js:claveDeHecho` (clase, concepto, eje, entidad, período) —
-- filtrada a `estado = 'vigente'`, que es la única consulta caliente (buscar si ya hay un vigente con esa llave).
create index if not exists memoria_empresa_vigente_por_llave on public.memoria_empresa (tenant_id, clase, concepto, eje, entidad, periodo) where estado = 'vigente';

alter table public.memoria_empresa enable row level security;

-- SOLO LECTURA directa por RLS (como `conversaciones`, 009): cada empresa lee la suya. La ESCRITURA no tiene
-- política de INSERT/UPDATE/DELETE a propósito — el mismo patrón que 012/014 usan para `tenants` («es de solo
-- lectura para el producto»): solo entra por las funciones `security definer` de más abajo, acotadas a
-- `adi.tenant_actual()` — nunca por un INSERT/UPDATE directo del cliente, ni siquiera dentro de su propia empresa.
drop policy if exists memoria_empresa_lectura_del_pase on public.memoria_empresa;
create policy memoria_empresa_lectura_del_pase on public.memoria_empresa
  for select
  using (tenant_id = adi.tenant_actual());

grant select on public.memoria_empresa to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · LAS FUNCIONES DE ESCRITURA · `security definer`, acotadas a `adi.tenant_actual()` (patrón de 012/014)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── APORTAR (declarar un criterio/hecho/documento nuevo) ────────────────────────────────────────────────────
-- ⚠️ NO decide "colisión con lo vigente" acá: esa lógica (§`_mismoValorDeclarado`, «pendiente» + `conflictoCon`
-- si el valor difiere sin `reemplaza` explícito) vive en `continuidad/empresa.js:declararHecho`, que es quien
-- LLAMA a esta función ya con el `p_estado`/`p_reemplaza` decididos — la base valida FORMA y aplica el
-- `reemplaza` (retira la vieja), nunca reinterpreta la ley de negocio: la misma separación que `007_diario.sql`
-- ya declara entre «el servidor arma el objeto, la base valida forma y tamaño».
create or replace function public.adi_aportar_hecho_empresa(
  p_clase           text,
  p_concepto        text,
  p_eje             text default null,
  p_entidad         text default null,
  p_periodo         text default null,
  p_valor           jsonb default null,
  p_origen          text default 'declarado',
  p_documento       jsonb default null,
  p_estado          text default 'vigente',
  p_reemplaza       uuid default null,
  p_conversacion_id text default null,
  p_actor_label     text default null,
  p_actor_rol       text default null
)
returns setof public.memoria_empresa
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text;
  v_id     uuid;
begin
  v_tenant := adi.tenant_actual();
  if v_tenant is null then
    raise exception 'sin pase: no se declara nada sin saber de qué empresa es';
  end if;
  if p_clase not in ('criterio', 'hecho', 'documento') then
    raise exception 'clase «%» no admitida (criterio | hecho | documento — el perfil no se declara por esta vía)', p_clase;
  end if;
  if p_origen not in ('declarado', 'documento') then
    raise exception 'origen «%» no admitido en la memoria de empresa (declarado | documento)', p_origen;
  end if;
  if p_concepto is null or length(trim(p_concepto)) = 0 then
    raise exception 'falta el concepto del hecho';
  end if;
  if p_estado not in ('pendiente', 'vigente', 'retirado', 'omitido') then
    raise exception 'estado «%» no admitido', p_estado;
  end if;
  if p_origen = 'documento' and p_documento is null then
    raise exception 'un hecho de documento exige {documento:{nombre,tipo,parte,...}}';
  end if;

  -- el reemplazo explícito retira la vigente ANTES de insertar la nueva — nunca al revés, para que jamás
  -- exista una ventana con dos vigentes de la misma llave por un reemplazo a medio aplicar.
  if p_reemplaza is not null then
    update public.memoria_empresa
       set estado = 'retirado'
     where id = p_reemplaza and tenant_id = v_tenant and estado = 'vigente';
  end if;

  insert into public.memoria_empresa
    (tenant_id, clase, concepto, eje, entidad, periodo, valor, origen, documento, estado, actor_label, conversacion_id, reemplaza)
  values
    (v_tenant, p_clase, trim(p_concepto), p_eje, p_entidad, p_periodo, p_valor, p_origen, p_documento, p_estado, p_actor_label, p_conversacion_id, p_reemplaza)
  returning id into v_id;

  begin
    insert into public.access_audit (tenant_id, actor_label, actor_rol, accion, detalle)
    values (v_tenant, p_actor_label, p_actor_rol, 'memoria_empresa:aportar',
            jsonb_build_object('clase', p_clase, 'concepto', p_concepto, 'estado', p_estado, 'reemplaza', p_reemplaza));
  exception when undefined_table then null;
  end;

  return query select * from public.memoria_empresa where id = v_id;
end;
$$;

grant execute on function public.adi_aportar_hecho_empresa(
  text, text, text, text, text, jsonb, text, jsonb, text, uuid, text, text, text
) to adi_tenant;

-- ── CONFIRMAR (el sello APARTE que nunca cambia el origen; o resolver un conflicto pendiente) ────────────────
create or replace function public.adi_confirmar_hecho_empresa(
  p_id          uuid,
  p_confirmacion jsonb default null,
  p_estado      text default null,
  p_reemplaza   uuid default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns setof public.memoria_empresa
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_tenant text;
begin
  v_tenant := adi.tenant_actual();
  if v_tenant is null then
    raise exception 'sin pase: no se confirma nada sin saber de qué empresa es';
  end if;
  if p_estado is not null and p_estado not in ('pendiente', 'vigente', 'retirado', 'omitido') then
    raise exception 'estado «%» no admitido', p_estado;
  end if;

  if p_reemplaza is not null then
    update public.memoria_empresa
       set estado = 'retirado'
     where id = p_reemplaza and tenant_id = v_tenant and estado = 'vigente';
  end if;

  -- ⚠️ NUNCA toca `valor`, `concepto` ni `origen` — la ley del owner, textual: «un dato confirmado de un
  -- contrato sigue viniendo del contrato». Solo `confirmacion`/`estado`/`reemplaza` son mutables.
  update public.memoria_empresa
     set confirmacion = coalesce(p_confirmacion, confirmacion),
         estado       = coalesce(p_estado, estado),
         reemplaza    = coalesce(p_reemplaza, reemplaza)
   where id = p_id and tenant_id = v_tenant;

  begin
    insert into public.access_audit (tenant_id, actor_label, actor_rol, accion, detalle)
    values (v_tenant, p_actor_label, p_actor_rol, 'memoria_empresa:confirmar', jsonb_build_object('id', p_id, 'estado', p_estado));
  exception when undefined_table then null;
  end;

  return query select * from public.memoria_empresa where id = p_id and tenant_id = v_tenant;
end;
$$;

grant execute on function public.adi_confirmar_hecho_empresa(uuid, jsonb, text, uuid, text, text) to adi_tenant;

-- ── RETIRAR (nunca borra: queda en la historia con `estado = 'retirado'`) ─────────────────────────────────────
create or replace function public.adi_retirar_hecho_empresa(
  p_id          uuid,
  p_motivo      text default null,
  p_actor_label text default null,
  p_actor_rol   text default null
)
returns setof public.memoria_empresa
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_tenant text;
begin
  v_tenant := adi.tenant_actual();
  if v_tenant is null then
    raise exception 'sin pase: no se retira nada sin saber de qué empresa es';
  end if;

  update public.memoria_empresa set estado = 'retirado' where id = p_id and tenant_id = v_tenant;

  begin
    insert into public.access_audit (tenant_id, actor_label, actor_rol, accion, detalle)
    values (v_tenant, p_actor_label, p_actor_rol, 'memoria_empresa:retirar', jsonb_build_object('id', p_id, 'motivo', p_motivo));
  exception when undefined_table then null;
  end;

  return query select * from public.memoria_empresa where id = p_id and tenant_id = v_tenant;
end;
$$;

grant execute on function public.adi_retirar_hecho_empresa(uuid, text, text, text) to adi_tenant;

-- ── LEER (toda la memoria de la empresa — vigentes, pendientes, retirados, omitidos: el filtro es de quien
--    llama, `continuidad/empresa.js:leerVigentes`/`leerHistoria`, nunca de la base) ───────────────────────────
create or replace function public.adi_leer_memoria_empresa()
returns setof public.memoria_empresa
language sql
security invoker
as $$
  select * from public.memoria_empresa where tenant_id = adi.tenant_actual() order by declarado_en asc;
$$;

grant execute on function public.adi_leer_memoria_empresa() to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · EL LIBRO DE CONVERSACIÓN · columna `estado` de `conversaciones` (009) — NO una tabla nueva
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Ley del owner (2026-09-26, textual): «el libro de conversación va como `estado` en la tabla `conversaciones`
-- de la migración 009, no en tabla nueva». `estado` guarda el objeto `Libro` de `continuidad/libro.js` —
-- turno, criterio vigente, supuestos vivos, entregas (referencias, nunca prosa), premisas, ofertas en pie,
-- hechos aportados. NUNCA una frase del usuario: eso sigue siendo de `mensajes` (009).
alter table public.conversaciones add column if not exists estado jsonb not null default '{}'::jsonb;

comment on column public.conversaciones.estado is
  'El libro de conversación (continuidad/libro.js, Etapa 2): turno, criterio vigente, supuestos vivos (≤3), entregas como REFERENCIAS (ids + versión de datos, nunca prosa), premisas tipadas con veredicto, ofertas en pie, hechos aportados a memoria_empresa. Tope de 16KB igual que `mensajes` en 009 — lo aplica el código (`libro.js:recortarATope`) antes de guardar; el check de abajo es el mismo respaldo estructural que ya usa 007/009 para no depender de que nadie se acuerde de revisar una ruta nueva.';

-- el mismo respaldo estructural que 007 (diario, 16KB) y 009 (mensajes, 256KB): el código recorta ANTES de
-- guardar, pero el check no depende de que nadie se acuerde de llamarlo en una ruta nueva.
alter table public.conversaciones drop constraint if exists conversaciones_estado_tamano_check;
alter table public.conversaciones add constraint conversaciones_estado_tamano_check
  check (pg_column_size(estado) <= 16384);

-- ── EL ORIGEN DEL HILO (Etapa 2, bloque 1 · defecto D3) ───────────────────────────────────────────────────────
-- Un libro de conversación se guarda como una fila de `conversaciones` con título vacío y cero mensajes (el
-- libro guarda referencias, nunca una frase). Sin una marca estructural, `adi_listar_conversaciones` (010) la
-- listaría en el Historial de la app de un usuario PRO como una fila fantasma. La marca es el ORIGEN DEL HILO,
-- un dato del propio libro (`estado ->> 'origen'`, `'complemento'`): lo SELLA la base al guardar (la función de
-- abajo lo escribe ella misma, no confía en quien llama), un hilo del chat de la app no lo trae (su `estado` es
-- `'{}'`, ⇒ origen `'app'` por omisión), y el Historial solo lista `origen = 'app'`. NO es un filtro por título
-- vacío ni por conteo de mensajes: un hilo del Complemento con título o con mensajes seguiría sin aparecer, y un
-- hilo de la app vacío (recién abierto) seguiría apareciendo. No agrega ninguna columna: vive dentro de `estado`.
-- (Alternativa descartada por ahora: una columna `origen` aparte — es una migración con decisión del owner.)

-- ── LEER el libro de una conversación ────────────────────────────────────────────────────────────────────────
-- Solo devuelve un LIBRO (origen 'complemento'): una fila de la app (estado '{}') no es un libro.
create or replace function public.adi_leer_estado_conversacion(p_hilo_id text)
returns table (hilo_id text, estado jsonb, actualizado_en timestamptz)
language sql
security invoker
as $$
  select c.hilo_id, c.estado, c.actualizado_en
    from public.conversaciones c
   where c.tenant_id = adi.tenant_actual() and c.hilo_id = p_hilo_id
     and c.estado ->> 'origen' = 'complemento';
$$;

grant execute on function public.adi_leer_estado_conversacion(text) to adi_tenant;

-- ── GUARDAR el libro (upsert por hilo — abre la conversación si todavía no existía, igual que
--    `adi_guardar_conversacion` de 009, pero tocando SOLO `estado`: título y mensajes siguen siendo de esa
--    función, para no crear una segunda vía que pueda pisarlos) ────────────────────────────────────────────────
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
  if pg_column_size(v_estado) > 16384 then
    raise exception 'el libro de conversación supera el tamaño máximo (16KB)';
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

-- ── EL HISTORIAL DE LA APP NO VE LOS HILOS DEL COMPLEMENTO (D3) ──────────────────────────────────────────────
-- Las dos funciones de lectura del Historial (010) se redefinen con la MISMA firma y la MISMA lógica (plan pro,
-- ocultas) más UNA condición estructural: solo hilos de origen 'app'. Mismo patrón de 013 sobre 012 y de esta
-- misma migración sobre `adi_declarar_perfil_empresa`: `create or replace`, sin reescribir la migración vieja.
-- ⚠️ SI ALGUNA VEZ SE VUELVE A REDEFINIR `adi_listar_conversaciones` (una migración 016), tiene que conservar la
-- condición de origen: `_guardado_durable_gate` lee este archivo y la verificación en vivo
-- (`scripts/verificar-supabase.mjs`, sección «continuidad») lo comprueba contra la base.
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
     and coalesce(c.estado ->> 'origen', 'app') = 'app'   -- los hilos del Complemento no son del Historial de la app
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
     and adi.plan_actual() = 'pro'
     and coalesce(c.estado ->> 'origen', 'app') = 'app';
$$;

grant execute on function public.adi_listar_conversaciones(integer) to adi_tenant;
grant execute on function public.adi_leer_conversacion(text)        to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · EL PERFIL — la ley de los cuatro orígenes, aplicada CAMPO POR CAMPO (CORRECCIÓN DEL SUPERVISOR, 2026-09-26)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ ESTA SECCIÓN REEMPLAZA LA PRIMERA VERSIÓN DE ESTA MIGRACIÓN, que solo AGREGABA `'declarado'` a los cinco
-- checks (dejando `'medido'`/`'derivado'` admitidos también). El supervisor extendió la misma corrección que
-- ya se aplicó a la moneda: la ley del owner sobre el perfil, textual, es «el perfil y la moneda son atributos
-- persistentes de la empresa, no del archivo, y ADI debe recordarlos SIN INFERIRLOS» — y con la ley de los
-- cuatro orígenes (2026-09-25), "medido" es lo que ADI MIDE sobre el dato, nunca lo que la empresa declara.
-- Sector, tipo de producto, país y modelo comercial los declara SIEMPRE la empresa (hoy por camino B; mañana
-- conversando con el LLM, Etapa 3) — nunca los mide ni los deriva ADI — así que su única procedencia correcta
-- es `'declarado'`. La banda de tamaño es la EXCEPCIÓN inversa: `bandaTamano.js` la CALCULA siempre a partir de
-- la venta y la UF del período — «no se pregunta, se calcula» (owner 2026-09-23) — así que nunca puede ser
-- `'declarado'`, y su única procedencia correcta es `'derivado'`.
alter table public.tenants drop constraint if exists tenants_sector_procedencia_check;
alter table public.tenants add constraint tenants_sector_procedencia_check
  check (sector_procedencia is null or sector_procedencia = 'declarado');

-- el nombre viejo del constraint (`…subsector_procedencia_check`) quedó de la 012, previo al rename de la 013
-- (RENAME COLUMN no renombra los constraints que la referencian) — se limpia el nombre viejo si sobrevive y se
-- crea el definitivo sobre la columna ya renombrada.
alter table public.tenants drop constraint if exists tenants_subsector_procedencia_check;
alter table public.tenants drop constraint if exists tenants_tipo_producto_procedencia_check;
alter table public.tenants add constraint tenants_tipo_producto_procedencia_check
  check (tipo_producto_procedencia is null or tipo_producto_procedencia = 'declarado');

alter table public.tenants drop constraint if exists tenants_pais_procedencia_check;
alter table public.tenants add constraint tenants_pais_procedencia_check
  check (pais_procedencia is null or pais_procedencia = 'declarado');

alter table public.tenants drop constraint if exists tenants_modelo_comercial_procedencia_check;
alter table public.tenants add constraint tenants_modelo_comercial_procedencia_check
  check (modelo_comercial_procedencia is null or modelo_comercial_procedencia = 'declarado');

-- ★ LA EXCEPCIÓN: banda de tamaño, SOLO 'derivado' — nunca 'declarado' (no se pregunta) ni 'medido' (ADI no la
-- mide, la calcula desde otros dos hechos ya medidos: venta anual y UF del período).
alter table public.tenants drop constraint if exists tenants_tamano_banda_procedencia_check;
alter table public.tenants add constraint tenants_tamano_banda_procedencia_check
  check (tamano_banda_procedencia is null or tamano_banda_procedencia = 'derivado');

-- MIGRACIÓN DE DATOS (sector/tipo_producto/país/modelo_comercial): todo `'medido'` que ya existiera —escrito
-- por `adi_declarar_perfil_empresa` de 012/013, bajo el vocabulario viejo donde esa palabra significaba «lo
-- declaró el usuario»— pasa a `'declarado'`. El MISMO hecho, la palabra correcta; ningún código se toca.
update public.tenants set sector_procedencia           = 'declarado' where sector_procedencia           = 'medido';
update public.tenants set tipo_producto_procedencia     = 'declarado' where tipo_producto_procedencia     = 'medido';
update public.tenants set pais_procedencia              = 'declarado' where pais_procedencia              = 'medido';
update public.tenants set modelo_comercial_procedencia  = 'declarado' where modelo_comercial_procedencia  = 'medido';

-- DEFENSA PARA LA BANDA: el diseño de 012 dejaba abierta la puerta a un valor 'medido' («una corrección humana
-- manual de la banda, si algún día existiera») que HOY NO OCURRE EN NINGÚN CAMINO REAL del producto
-- (`config/contract/perfilCliente.js`, comentario junto a `bandaManual`: «hoy nunca ocurre en la práctica»).
-- Con la ley corregida esa puerta deja de existir: un valor 'medido' para la banda sería un ajuste manual que
-- la ley del owner ya no admite, no un hecho que se pueda re-etiquetar como 'derivado' sin mentir sobre su
-- origen. Se limpia (nunca se re-etiqueta) por si alguna fila lo tuviera al aplicar esta migración — no debería
-- existir ninguna, y esta línea es la red de seguridad, no una migración de datos real esperada.
update public.tenants set tamano_banda_codigo = null, tamano_banda_procedencia = null where tamano_banda_procedencia = 'medido';

-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · LA MONEDA Y LA FUNCIÓN DE ESCRITURA · CORRECCIÓN DEL SUPERVISOR (2026-09-26)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- `moneda_procedencia` pasa a admitir SOLO 'declarado' — y, más abajo, `adi_declarar_perfil_empresa` se
-- redefine UNA sola vez para corregir el origen de los CINCO campos del perfil (§4) y de la moneda a la vez:
-- es la misma función, no tiene sentido reescribirla dos veces en el mismo archivo.
-- Ver la cabecera de este archivo, §0, punto 3. La moneda SIEMPRE la declara la empresa (por el archivo o por
-- la pantalla de carga) — nunca la MIDE ADI sobre datos ni la DERIVA el motor. Con la ley de los cuatro
-- orígenes, eso es «declarado», no «medido» (en `notario/hechos.js:ORIGENES`, «medido» es lo que ADI mide
-- sobre el dato de la empresa). El check de 012 («SOLO `medido`») tenía la ley correcta («nunca se infiere») con
-- la PALABRA equivocada — se corrige la palabra, la ley no se afloja: sigue sin admitir `'derivado'`.
alter table public.tenants drop constraint if exists tenants_moneda_procedencia_check;
alter table public.tenants add constraint tenants_moneda_procedencia_check
  check (moneda_procedencia is null or moneda_procedencia = 'declarado');

-- MIGRACIÓN DE DATOS: todo `'medido'` que ya existiera (escrito por `adi_declarar_perfil_empresa` de 012/013,
-- bajo el vocabulario viejo) pasa a `'declarado'` — el MISMO hecho («la empresa lo declaró»), con la palabra
-- correcta. No es un cambio de qué se sabe, es corregir cómo se lo llama; ningún valor de `moneda` se toca.
update public.tenants set moneda_procedencia = 'declarado' where moneda_procedencia = 'medido';

-- `adi_declarar_perfil_empresa` (013) ESCRIBÍA la procedencia que el CALLER le pasara (`p_sector_procedencia`,
-- etc. — confiaba en quien llamara para decir "medido" o "derivado") y fijaba `moneda_procedencia = 'medido'`
-- a mano. Con los checks de arriba ya corregidos, eso rompería la PRÓXIMA declaración de cualquier campo. Se
-- redefine con la MISMA firma (mismo patrón que 013 usó sobre 012: `create or replace`, no se reescribe la
-- migración vieja — y se mantienen los parámetros `p_*_procedencia` para no romper la firma que ya llama
-- `persistirCarga.server.js:declararPerfilEmpresa`) y la función deja de CONFIAR en el origen que el caller le
-- pasa: lo DECIDE ella misma, igual que ya hacía con la moneda — sector/tipo_producto/país/modelo_comercial
-- siempre "declarado" cuando llega un código nuevo (la empresa los declara, ADI nunca los mide ni los deriva);
-- tamano_banda siempre "derivado" (se calcula, nunca se pregunta). Los parámetros `p_*_procedencia` quedan
-- ACEPTADOS PERO IGNORADOS — documentado acá para que no se lean como un origen configurable que ya no existe.
create or replace function public.adi_declarar_perfil_empresa(
  p_sector_codigo                text default null,
  p_sector_procedencia           text default null,
  p_tipo_producto_codigo         text default null,
  p_tipo_producto_procedencia    text default null,
  p_pais_codigo                  text default null,
  p_pais_procedencia             text default null,
  p_modelo_comercial_codigo      text default null,
  p_modelo_comercial_procedencia text default null,
  p_tamano_banda_codigo          text default null,
  p_tamano_banda_procedencia     text default null,
  p_moneda                       text default null
)
returns table (
  id                             text,
  sector_codigo                  text,
  tipo_producto_codigo           text,
  pais_codigo                    text,
  modelo_comercial_codigo        text,
  tamano_banda_codigo            text,
  moneda                         text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text;
  v_moneda text;
begin
  v_tenant := adi.tenant_actual();
  if v_tenant is null then
    raise exception 'sin pase: no se declara nada sin saber de qué empresa es';
  end if;

  v_moneda := nullif(upper(trim(coalesce(p_moneda, ''))), '');
  if v_moneda is not null and v_moneda !~ '^[A-Z]{2,6}$' then
    v_moneda := null;
  end if;

  -- ★ CORREGIDO (015) — el ORIGEN de cada campo lo decide esta función, no el parámetro `p_*_procedencia`
  -- (que se sigue aceptando en la firma, pero se ignora: ver el comentario de arriba). Sector, tipo de
  -- producto, país y modelo comercial son SIEMPRE "declarado" cuando llega un código; la banda de tamaño es
  -- SIEMPRE "derivado" cuando llega una (nunca la declara nadie, `bandaTamano.js` la calcula).
  update public.tenants set
    sector_codigo                  = coalesce(p_sector_codigo, sector_codigo),
    sector_procedencia             = case when p_sector_codigo is not null then 'declarado' else sector_procedencia end,
    tipo_producto_codigo           = coalesce(p_tipo_producto_codigo, tipo_producto_codigo),
    tipo_producto_procedencia      = case when p_tipo_producto_codigo is not null then 'declarado' else tipo_producto_procedencia end,
    pais_codigo                    = coalesce(p_pais_codigo, pais_codigo),
    pais_procedencia               = case when p_pais_codigo is not null then 'declarado' else pais_procedencia end,
    modelo_comercial_codigo        = coalesce(p_modelo_comercial_codigo, modelo_comercial_codigo),
    modelo_comercial_procedencia   = case when p_modelo_comercial_codigo is not null then 'declarado' else modelo_comercial_procedencia end,
    tamano_banda_codigo            = coalesce(p_tamano_banda_codigo, tamano_banda_codigo),
    tamano_banda_procedencia       = case when p_tamano_banda_codigo is not null then 'derivado' else tamano_banda_procedencia end,
    moneda                         = coalesce(v_moneda, moneda),
    moneda_procedencia             = case when v_moneda is not null then 'declarado' else moneda_procedencia end
  where id = v_tenant;

  return query
    select t.id, t.sector_codigo, t.tipo_producto_codigo, t.pais_codigo, t.modelo_comercial_codigo,
           t.tamano_banda_codigo, t.moneda
      from public.tenants t
     where t.id = v_tenant;
end;
$$;

grant execute on function public.adi_declarar_perfil_empresa(
  text, text, text, text, text, text, text, text, text, text, text
) to adi_tenant;
