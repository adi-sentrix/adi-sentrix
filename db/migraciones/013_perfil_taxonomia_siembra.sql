-- === db/migraciones/013_perfil_taxonomia_siembra.sql · TIPOPRODUCTO Y LA SIEMBRA DE LA TAXONOMÍA (camino B) ==
--
-- QUÉ RESUELVE. Dos cosas del encargo «bandas de tamaño y siembra de la taxonomía» (owner 2026-09-23,
-- `_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md`, aprobada):
--   1 · RENOMBRA `subsector` → `tipo_producto` en `public.tenants` y en `perfil_taxonomia` — la propuesta §2 lo
--       señaló desde el borrador («el plan lo llamaba subsector pero el contenido es tipo de producto») y el
--       owner lo confirmó al usar «tipoProducto» en el encargo mismo. Se renombra por MIGRACIÓN NUEVA, no
--       editando la 012 (que ya quedó commiteada en `dev`, aunque sin aplicar) — la misma disciplina de nunca
--       reescribir una migración anterior, aplicada o no.
--   2 · SIEMBRA `perfil_taxonomia`, que la 012 dejó vacía A PROPÓSITO mientras el owner decidía el vocabulario.
--       Las cinco listas de abajo son EXACTAMENTE las de `_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md` (aprobadas) y
--       EXACTAMENTE las de `src/config/contract/taxonomiaPerfil.js` (`TAXONOMIA_PERFIL`) — la misma verdad en
--       los dos lugares. El candado `_entrega_gate.mjs` («una sola verdad por vocabulario») lee este archivo
--       como TEXTO y compara los códigos de cada `insert` contra el array de `taxonomiaPerfil.js`: si alguien
--       cambia uno sin el otro, el candado arde. No hay forma de que una migración `.sql` importe un `.js`, así
--       que la comparación corre al revés — el candado, no el código, es lo que mantiene la sincronía.
--
-- ⚠️ ESTO ES UN ARCHIVO, NO UN HECHO EN LA BASE — igual que la 012, sin aplicar contra ningún proyecto de
-- Supabase: aplicar una migración es un paso de despliegue y esta tarea no tiene esa autorización.
--
-- ⚠️ EL SECTOR «obras» ENTRA DESDE AHORA (owner, textual: «lo incluyó desde ahora») — no espera al primer
-- cliente de obras. Meter obras en servicios (su vecino más cercano en la lista) entregaría cobranza y plazos
-- falsos: obras se cobra por hitos y con retenciones, servicios no.
--
-- LA REGLA NUEVA QUE EL TRIGGER GANA ACÁ (propuesta §2, textual): «tipoProducto... solo aplica a distribución,
-- fabricación y minorista; para servicios y obras tiene que ser nulo obligatoriamente». La 012 no la tenía
-- porque la taxonomía todavía no existía cuando se escribió — ahora que sector tiene una lista cerrada, la
-- regla se puede expresar como una comparación de columnas dentro del mismo trigger que ya valida los códigos.
--
-- CÓMO SE APLICARÍA (cuando el owner lo autorice): SQL Editor, después de la 012. Es idempotente: se puede
-- correr más de una vez sin romper nada (el rename de columna se guarda detrás de un chequeo de
-- `information_schema`, y la siembra usa `on conflict do nothing`).


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · RENOMBRAR subsector → tipo_producto EN `tenants` (guardado con un chequeo, RENAME no admite IF EXISTS)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tenants' and column_name = 'subsector_codigo'
  ) then
    alter table public.tenants rename column subsector_codigo to tipo_producto_codigo;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tenants' and column_name = 'subsector_procedencia'
  ) then
    alter table public.tenants rename column subsector_procedencia to tipo_producto_procedencia;
  end if;
end $$;

-- por si esta migración corre en una base donde la 012 todavía no corrió: las columnas nacen con su nombre
-- final directamente, sin pasar por «subsector» — el mismo patrón `add column if not exists` que ya usa la 012.
alter table public.tenants add column if not exists tipo_producto_codigo      text;
alter table public.tenants add column if not exists tipo_producto_procedencia text;

comment on column public.tenants.tipo_producto_codigo is
  'Antes "subsector" (renombrado 013 — el contenido siempre fue tipo de producto, nunca un nivel más fino del rubro). Solo tiene sentido con sector IN (''distribucion'',''fabricacion'',''minorista''); NULO OBLIGATORIO para ''servicios'' y ''obras'' — el trigger de más abajo lo hace estructural. Validado contra `perfil_taxonomia` (campo=''tipo_producto'').';
comment on column public.tenants.tipo_producto_procedencia is
  'Igual que sector_procedencia: SOLO ''medido'' o ''derivado''.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · EL CHECK DE `perfil_taxonomia.campo` · agrega 'tipo_producto', saca 'subsector'
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.perfil_taxonomia drop constraint if exists perfil_taxonomia_campo_check;
alter table public.perfil_taxonomia add constraint perfil_taxonomia_campo_check
  check (campo in ('sector', 'tipo_producto', 'pais', 'modelo_comercial', 'tamano_banda'));

-- una fila vieja con campo='subsector' (si alguna vez se sembró contra la 012 sola) no sobrevive al check nuevo
-- ni al trigger de más abajo — se limpia acá para que la migración deje la base consistente con el código.
delete from public.perfil_taxonomia where campo = 'subsector';


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · EL TRIGGER · valida tipo_producto (renombrado) Y LA REGLA NUEVA sector↔tipo_producto
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
create or replace function adi.validar_perfil_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.sector_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'sector' and codigo = new.sector_codigo
  ) then
    raise exception 'sector «%» no está en la lista autorizada', new.sector_codigo;
  end if;

  if new.tipo_producto_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'tipo_producto' and codigo = new.tipo_producto_codigo
  ) then
    raise exception 'tipo de producto «%» no está en la lista autorizada', new.tipo_producto_codigo;
  end if;

  -- LA REGLA NUEVA (propuesta §2, textual: «solo aplica a distribución, fabricación y minorista; para
  -- servicios y obras tiene que ser nulo obligatoriamente»). Sin sector declarado, tipo_producto tampoco puede
  -- declararse — no hay con qué validar la combinación, y dejarlo pasar sería el mismo hueco al revés.
  if new.tipo_producto_codigo is not null
     and (new.sector_codigo is null or new.sector_codigo not in ('distribucion', 'fabricacion', 'minorista'))
  then
    raise exception 'tipo de producto «%» no aplica al sector «%» — solo distribución, fabricación y minorista lo usan; servicios y obras deben declarar tipo_producto nulo',
      new.tipo_producto_codigo, coalesce(new.sector_codigo, '(sin declarar)');
  end if;

  if new.pais_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'pais' and codigo = new.pais_codigo
  ) then
    raise exception 'país «%» no está en la lista autorizada', new.pais_codigo;
  end if;

  if new.modelo_comercial_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'modelo_comercial' and codigo = new.modelo_comercial_codigo
  ) then
    raise exception 'modelo comercial «%» no está en la lista autorizada', new.modelo_comercial_codigo;
  end if;

  if new.tamano_banda_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'tamano_banda' and codigo = new.tamano_banda_codigo
  ) then
    raise exception 'la banda de tamaño «%» no está en la lista autorizada', new.tamano_banda_codigo;
  end if;

  return new;
end;
$$;
-- el trigger `tenants_validar_perfil` de la 012 ya apunta a esta función por nombre — `create or replace` alcanza,
-- no hace falta recrear el trigger.


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · `adi_declarar_perfil_empresa` · los parámetros de subsector se renombran junto con la columna
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.adi_declarar_perfil_empresa(
  text, text, text, text, text, text, text, text, text, text, text
);
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

  update public.tenants set
    sector_codigo                  = coalesce(p_sector_codigo, sector_codigo),
    sector_procedencia             = coalesce(p_sector_procedencia, sector_procedencia),
    tipo_producto_codigo           = coalesce(p_tipo_producto_codigo, tipo_producto_codigo),
    tipo_producto_procedencia      = coalesce(p_tipo_producto_procedencia, tipo_producto_procedencia),
    pais_codigo                    = coalesce(p_pais_codigo, pais_codigo),
    pais_procedencia               = coalesce(p_pais_procedencia, pais_procedencia),
    modelo_comercial_codigo        = coalesce(p_modelo_comercial_codigo, modelo_comercial_codigo),
    modelo_comercial_procedencia   = coalesce(p_modelo_comercial_procedencia, modelo_comercial_procedencia),
    tamano_banda_codigo            = coalesce(p_tamano_banda_codigo, tamano_banda_codigo),
    tamano_banda_procedencia       = coalesce(p_tamano_banda_procedencia, tamano_banda_procedencia),
    moneda                         = coalesce(v_moneda, moneda),
    moneda_procedencia             = case when v_moneda is not null then 'medido' else moneda_procedencia end
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


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · LA SIEMBRA · las cinco listas aprobadas, byte a byte iguales a `src/config/contract/taxonomiaPerfil.js`
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- `on conflict do nothing` — correr esta migración dos veces no duplica filas ni revienta.

-- sector (6): las cinco de la propuesta §1 + 'obras' (owner, desde ahora) + 'ninguno' (propuesta §1, "sexta
-- opción" — respondido y fuera de la taxonomía, distinto de null="no respondido").
insert into public.perfil_taxonomia (campo, codigo) values
  ('sector', 'distribucion'),
  ('sector', 'fabricacion'),
  ('sector', 'minorista'),
  ('sector', 'servicios'),
  ('sector', 'obras'),
  ('sector', 'ninguno')
on conflict (campo, codigo) do nothing;

-- tipo_producto (5): propuesta §2 — solo aplica a distribucion/fabricacion/minorista (el trigger de arriba lo exige).
insert into public.perfil_taxonomia (campo, codigo) values
  ('tipo_producto', 'vence'),
  ('tipo_producto', 'consumo'),
  ('tipo_producto', 'durable'),
  ('tipo_producto', 'temporada'),
  ('tipo_producto', 'insumos')
on conflict (campo, codigo) do nothing;

-- modelo_comercial (4): propuesta §4.
insert into public.perfil_taxonomia (campo, codigo) values
  ('modelo_comercial', 'cuentas_grandes'),
  ('modelo_comercial', 'comercios'),
  ('modelo_comercial', 'consumidor'),
  ('modelo_comercial', 'publico')
on conflict (campo, codigo) do nothing;

-- pais (20): propuesta §5 — ISO alfa-2, habla hispana de América + Brasil y España, Chile primero (el orden de
-- la lista es conveniencia, no inferencia: la fila de Chile no se pre-marca en ningún formulario por estar acá).
insert into public.perfil_taxonomia (campo, codigo) values
  ('pais', 'CL'),
  ('pais', 'AR'), ('pais', 'BO'), ('pais', 'CO'), ('pais', 'CR'), ('pais', 'CU'),
  ('pais', 'EC'), ('pais', 'SV'), ('pais', 'GT'), ('pais', 'HN'), ('pais', 'MX'),
  ('pais', 'NI'), ('pais', 'PA'), ('pais', 'PY'), ('pais', 'PE'), ('pais', 'DO'),
  ('pais', 'UY'), ('pais', 'VE'),
  ('pais', 'BR'), ('pais', 'ES')
on conflict (campo, codigo) do nothing;

-- tamano_banda (4): propuesta §3 — las cuatro bandas; el CÁLCULO de cuál corresponde vive en
-- `src/config/contract/bandaTamano.js`, esto es solo el vocabulario cerrado que valida el trigger.
insert into public.perfil_taxonomia (campo, codigo) values
  ('tamano_banda', 'micro'),
  ('tamano_banda', 'pequena'),
  ('tamano_banda', 'mediana'),
  ('tamano_banda', 'grande')
on conflict (campo, codigo) do nothing;
