-- === db/migraciones/012_perfil_empresa.sql · EL PERFIL DE LA EMPRESA, FUERA DE LA PLANTILLA (camino B) =====
--
-- QUÉ RESUELVE. El motor de conocimiento (`config/contract/perfilCliente.js`, plan `_ADI_LLMBUSINESS_PLAN.md`
-- §3) necesita sector, subsector, país, modelo comercial y una banda de tamaño para poder citar algo del
-- oficio del cliente — y hoy NINGUNO de los cinco existe en ningún lugar del producto: no en la plantilla
-- congelada (`config/contract/plantilla.js`), no en la pantalla de carga, no en `tenants`
-- (`001_esquema_base.sql`: id, nombre, estado, created_at). El owner aprobó el CAMINO B: este perfil se
-- captura FUERA de la plantilla, sin tocarla — porque `tenants` es la fila POR EMPRESA (una por cliente)
-- mientras que `fact_pack_versions` es la fila POR ARCHIVO SUBIDO (una por período): el rubro de un negocio
-- no cambia cada vez que sube un Excel, así que su perfil vive donde vive la EMPRESA, no donde vive el archivo.
--
-- ⚠️ ESTO ES UN ARCHIVO, NO UN HECHO EN LA BASE. No se aplicó contra ningún proyecto de Supabase: aplicar una
-- migración es un paso de despliegue y esta tarea no tiene autorización de gasto ni de despliegue para darlo.
-- Queda escrita y lista, igual que las que esperan su turno.
--
-- ⚠️ TODO OPCIONAL, NULO POR DEFECTO — Y ESO ES LO QUE MANTIENE INTACTO LO QUE YA FUNCIONA. Ninguna columna
-- de esta migración tiene un default distinto de null, así que una empresa de hoy —sin una sola fila
-- nueva— sigue leyendo EXACTAMENTE lo que lee ahora: `perfilCliente.js` declara cada campo ausente, con su
-- motivo, igual que antes de este archivo existir.
--
-- LA TAXONOMÍA TODAVÍA NO EXISTE. El owner la está decidiendo en paralelo (qué sectores, qué bandas de
-- tamaño) y esta tarea NO la inventa — inventarla sería una decisión de significado que no le toca a quien
-- escribe la cañería. Por eso el valor de cada campo se guarda como un CÓDIGO DE TEXTO LIBRE, validado contra
-- una lista (`perfil_taxonomia`, más abajo) que hoy está VACÍA A PROPÓSITO: mientras esté vacía, NINGÚN
-- código pasa la validación —ni siquiera uno que parezca razonable—, así que no hay forma de que un valor
-- inventado se cuele mientras nadie decidió el vocabulario. El día que el owner la llene, la validación
-- empieza a aceptar exactamente esos códigos y ninguno más.
--
-- PROCEDENCIA, EL MISMO VOCABULARIO QUE `notario/hechos.js:PROCEDENCIAS` — "medido" (lo declaró el usuario) o
-- "derivado" (lo calculó el motor). Nunca "estimacion_referencia" / "supuesto_usuario" / "propuesta" acá:
-- ningún campo de este perfil nace de una brecha, de un supuesto de simulación ni de una recomendación.
--
-- LA MONEDA SE SUMA ACÁ TAMBIÉN (Etapa 2 §3 — medido antes de escribir esto, con una sonda offline: ver el
-- informe de la tarea). Hoy vive DENTRO de cada versión del pack (`fact_pack_versions.pack.perfil.moneda`,
-- ligada al ARCHIVO subido — `004_moneda_al_activar.sql`), y la sonda confirmó que un cliente que sube un
-- período nuevo sin volver a declararla en ESE archivo se la encuentra preguntada otra vez: la versión nueva
-- se guarda con `perfil.moneda` vacío aunque la empresa ya la haya declarado en una carga anterior — el
-- comentario de `persistirCarga.server.js` ya lo decía, textual: «la MONEDA no se arrastra acá a propósito».
-- Guardarla también en `tenants` deja que se declare UNA vez por empresa y se herede hacia los períodos
-- siguientes, sin tocar la ley de que se declara y nunca se infiere — el check de más abajo la hace
-- estructural: la procedencia de la moneda de la empresa SOLO puede ser 'medido', nunca 'derivado'.
--
-- CÓMO SE APLICARÍA (cuando el owner lo autorice): SQL Editor, después de la 011. Es idempotente.


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · LAS COLUMNAS · todas opcionales, nulas por defecto
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.tenants add column if not exists sector_codigo               text;
alter table public.tenants add column if not exists sector_procedencia          text;
alter table public.tenants add column if not exists subsector_codigo            text;
alter table public.tenants add column if not exists subsector_procedencia       text;
alter table public.tenants add column if not exists pais_codigo                 text;
alter table public.tenants add column if not exists pais_procedencia            text;
alter table public.tenants add column if not exists modelo_comercial_codigo     text;
alter table public.tenants add column if not exists modelo_comercial_procedencia text;
alter table public.tenants add column if not exists tamano_banda_codigo         text;
alter table public.tenants add column if not exists tamano_banda_procedencia    text;
alter table public.tenants add column if not exists moneda                      text;
alter table public.tenants add column if not exists moneda_procedencia          text;

comment on column public.tenants.sector_codigo is
  'Código de texto libre, validado por `adi.validar_perfil_tenant()` contra `perfil_taxonomia` (campo=''sector''). Nulo = no declarado.';
comment on column public.tenants.subsector_codigo is
  'Igual que sector, un nivel más fino. Validado contra `perfil_taxonomia` (campo=''subsector'').';
comment on column public.tenants.pais_codigo is
  'Validado contra `perfil_taxonomia` (campo=''pais''). NUNCA se deriva de la moneda — varios países comparten moneda.';
comment on column public.tenants.modelo_comercial_codigo is
  'Distribución / retail / servicios / manufactura, etc. Validado contra `perfil_taxonomia` (campo=''modelo_comercial'').';
comment on column public.tenants.tamano_banda_codigo is
  'pyme / mediana / grande, etc. — la BANDA, no la venta anual (esa se deriva en el motor, no vive acá). Validado contra `perfil_taxonomia` (campo=''tamano_banda'').';
comment on column public.tenants.moneda is
  'La moneda de la EMPRESA, heredada hacia los períodos siguientes (Etapa 2 §3). Se declara UNA vez —al activar una versión, o por una pantalla futura— y nunca se infiere. Formato: 2-6 letras mayúsculas, el mismo patrón que `monedaLimpia()` en `config/moneda.js`.';
comment on column public.tenants.moneda_procedencia is
  'SOLO puede ser ''medido'' — el check de abajo lo hace estructural: la moneda nunca se infiere, ni siquiera acá.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · LOS CHECKS · vocabulario cerrado para la procedencia, formato cerrado para la moneda
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.tenants drop constraint if exists tenants_sector_procedencia_check;
alter table public.tenants add constraint tenants_sector_procedencia_check
  check (sector_procedencia is null or sector_procedencia in ('medido', 'derivado'));

alter table public.tenants drop constraint if exists tenants_subsector_procedencia_check;
alter table public.tenants add constraint tenants_subsector_procedencia_check
  check (subsector_procedencia is null or subsector_procedencia in ('medido', 'derivado'));

alter table public.tenants drop constraint if exists tenants_pais_procedencia_check;
alter table public.tenants add constraint tenants_pais_procedencia_check
  check (pais_procedencia is null or pais_procedencia in ('medido', 'derivado'));

alter table public.tenants drop constraint if exists tenants_modelo_comercial_procedencia_check;
alter table public.tenants add constraint tenants_modelo_comercial_procedencia_check
  check (modelo_comercial_procedencia is null or modelo_comercial_procedencia in ('medido', 'derivado'));

alter table public.tenants drop constraint if exists tenants_tamano_banda_procedencia_check;
alter table public.tenants add constraint tenants_tamano_banda_procedencia_check
  check (tamano_banda_procedencia is null or tamano_banda_procedencia in ('medido', 'derivado'));

-- ⚠️ LA LEY ESTRUCTURAL: la moneda de la empresa NUNCA es 'derivado'. Si algún día un motor quisiera
-- «adivinarla», este check la rechaza antes de que llegue a una fila — no depende de que nadie se acuerde
-- de revisar el código que la escribe.
alter table public.tenants drop constraint if exists tenants_moneda_procedencia_check;
alter table public.tenants add constraint tenants_moneda_procedencia_check
  check (moneda_procedencia is null or moneda_procedencia = 'medido');

-- El mismo patrón que `monedaLimpia()` valida en el código: 2 a 6 letras mayúsculas. Lo que no calza no
-- entra — no se corrige ni se aproxima.
alter table public.tenants drop constraint if exists tenants_moneda_formato_check;
alter table public.tenants add constraint tenants_moneda_formato_check
  check (moneda is null or moneda ~ '^[A-Z]{2,6}$');


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · LA LISTA AUTORIZADA · vacía a propósito, lista para llenarse
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- No es una tabla de datos de un cliente: es un catálogo compartido por todo el producto, así que no lleva
-- `tenant_id` ni RLS — es de solo lectura para la sesión (grant de abajo) y de escritura solo para quien
-- aplique una migración, que es exactamente el mismo régimen que ya rige `plantilla.js` en el código.
create table if not exists public.perfil_taxonomia (
  campo   text not null check (campo in ('sector', 'subsector', 'pais', 'modelo_comercial', 'tamano_banda')),
  codigo  text not null check (codigo ~ '^[a-z0-9_]{1,40}$'),
  primary key (campo, codigo)
);

comment on table public.perfil_taxonomia is
  'La lista autorizada de códigos por campo del perfil de empresa. VACÍA A PROPÓSITO (owner 2026-09-23): la taxonomía (qué sectores, qué bandas de tamaño) todavía no está decidida. Mientras esté vacía, NINGÚN código pasa `adi.validar_perfil_tenant()` — ni uno solo. Se llena cuando el owner fije el vocabulario; esta migración no propone ni un ejemplo.';

grant select on public.perfil_taxonomia to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · EL CANDADO · un código que no está en la lista autorizada NO ENTRA
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Un `check` normal no puede mirar otra tabla — por eso esto es un trigger y no una restricción en línea
-- con las de arriba. Corre en INSERT y en UPDATE: una fila que nace con un código inválido se rechaza igual
-- que una que lo cambia a uno inválido después.
create or replace function adi.validar_perfil_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.sector_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'sector' and codigo = new.sector_codigo
  ) then
    raise exception 'sector «%» no está en la lista autorizada (todavía vacía: la taxonomía no se decidió)', new.sector_codigo;
  end if;

  if new.subsector_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'subsector' and codigo = new.subsector_codigo
  ) then
    raise exception 'subsector «%» no está en la lista autorizada (todavía vacía: la taxonomía no se decidió)', new.subsector_codigo;
  end if;

  if new.pais_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'pais' and codigo = new.pais_codigo
  ) then
    raise exception 'país «%» no está en la lista autorizada (todavía vacía: la taxonomía no se decidió)', new.pais_codigo;
  end if;

  if new.modelo_comercial_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'modelo_comercial' and codigo = new.modelo_comercial_codigo
  ) then
    raise exception 'modelo comercial «%» no está en la lista autorizada (todavía vacía: la taxonomía no se decidió)', new.modelo_comercial_codigo;
  end if;

  if new.tamano_banda_codigo is not null and not exists (
    select 1 from public.perfil_taxonomia where campo = 'tamano_banda' and codigo = new.tamano_banda_codigo
  ) then
    raise exception 'la banda de tamaño «%» no está en la lista autorizada (todavía vacía: la taxonomía no se decidió)', new.tamano_banda_codigo;
  end if;

  return new;
end;
$$;

drop trigger if exists tenants_validar_perfil on public.tenants;
create trigger tenants_validar_perfil
  before insert or update on public.tenants
  for each row execute function adi.validar_perfil_tenant();


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · CÓMO SE ESCRIBE · `tenants` sigue siendo de solo lectura para el producto (001), así que esto va
--     por una función controlada, no por una política nueva de UPDATE
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ POR QUÉ NO UNA POLÍTICA `for update` EN `tenants`. La 001 lo dejó escrito, textual: «es de solo lectura
-- para el producto: dar de alta una empresa es un acto de administración, no algo que una sesión pueda hacer
-- por su cuenta». Abrir UPDATE ahí de golpe permitiría a una sesión tocar `nombre`/`estado` además del
-- perfil — mucho más de lo que este camino necesita. En vez de eso, la misma receta que ya usa
-- `adi_activar_version`: una función `security definer`, acotada por columna, que solo puede tocar la fila
-- de `adi.tenant_actual()` — nunca otra empresa, RLS o no, porque el tenant sale del pase firmado y de
-- ningún parámetro que mande el cliente.
--
-- Los cinco pares (código + procedencia) y la moneda son independientes: llamar con un solo par no toca
-- los demás (`coalesce` conserva lo que ya había). Sirve tanto para lo que declare una pantalla futura
-- (Etapa siguiente, no construida) como para la herencia automática de la moneda al activar una versión
-- (`persistirCarga.server.js:activarVersion`, ya cableado).
create or replace function public.adi_declarar_perfil_empresa(
  p_sector_codigo                text default null,
  p_sector_procedencia           text default null,
  p_subsector_codigo             text default null,
  p_subsector_procedencia        text default null,
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
  subsector_codigo               text,
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

  -- La misma limpieza que `monedaLimpia()` hace en el código — entre 2 y 6 letras, en mayúscula. Lo que
  -- no pasa por acá se descarta, no se aproxima; y si viene vacío, no se toca lo que ya había.
  v_moneda := nullif(upper(trim(coalesce(p_moneda, ''))), '');
  if v_moneda is not null and v_moneda !~ '^[A-Z]{2,6}$' then
    v_moneda := null;
  end if;

  update public.tenants set
    sector_codigo                  = coalesce(p_sector_codigo, sector_codigo),
    sector_procedencia             = coalesce(p_sector_procedencia, sector_procedencia),
    subsector_codigo               = coalesce(p_subsector_codigo, subsector_codigo),
    subsector_procedencia          = coalesce(p_subsector_procedencia, subsector_procedencia),
    pais_codigo                    = coalesce(p_pais_codigo, pais_codigo),
    pais_procedencia               = coalesce(p_pais_procedencia, pais_procedencia),
    modelo_comercial_codigo        = coalesce(p_modelo_comercial_codigo, modelo_comercial_codigo),
    modelo_comercial_procedencia   = coalesce(p_modelo_comercial_procedencia, modelo_comercial_procedencia),
    tamano_banda_codigo            = coalesce(p_tamano_banda_codigo, tamano_banda_codigo),
    tamano_banda_procedencia       = coalesce(p_tamano_banda_procedencia, tamano_banda_procedencia),
    -- la moneda de la empresa SIEMPRE es 'medido' cuando se escribe: la ley no admite otra procedencia acá
    moneda                         = coalesce(v_moneda, moneda),
    moneda_procedencia             = case when v_moneda is not null then 'medido' else moneda_procedencia end
  where id = v_tenant;

  return query
    select t.id, t.sector_codigo, t.subsector_codigo, t.pais_codigo, t.modelo_comercial_codigo,
           t.tamano_banda_codigo, t.moneda
      from public.tenants t
     where t.id = v_tenant;
end;
$$;

grant execute on function public.adi_declarar_perfil_empresa(
  text, text, text, text, text, text, text, text, text, text, text
) to adi_tenant;
