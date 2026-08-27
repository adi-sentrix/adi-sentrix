-- === db/migraciones/001_esquema_base.sql · LAS CUATRO TABLAS Y EL MURO ==============================
--
-- QUÉ RESUELVE. Hasta hoy el pack de datos del cliente se produce entero —plantilla congelada, ingesta
-- determinística, sello de plausibilidad— y después vive en la memoria del navegador: si el usuario
-- recarga, se fue. Esto es el lugar donde queda.
--
-- LA DECISIÓN QUE GOBIERNA TODO ESTE ARCHIVO (owner 2026-08-27): ni llave de servicio ni Supabase Auth.
-- El servidor verifica el código de acceso firmado como hoy y emite un PASE CORTO que lleva `tenant_id`
-- adentro; las políticas de acá abajo filtran por ese claim y por nada más.
--
-- POR QUÉ NO LA LLAVE DE SERVICIO: con ella RLS no protege nada —el servidor puede leer todo— y el
-- aislamiento vuelve a depender de que el código no tenga un bug, que es exactamente lo que este frente
-- salió a eliminar. Con el pase, un error de filtro devuelve CERO FILAS, no las filas de otra empresa.
-- Falla cerrada. Esa frase es el criterio de diseño de todo lo que sigue.
--
-- COMPATIBILIDAD HACIA ADELANTE (pedido explícito del owner): las columnas de persona y la tabla
-- `memberships` NACEN ACÁ, vacías. El día que haya cuentas, el pase suma `sub` y las políticas se
-- extienden con un OR. Las tablas no se rehacen.
--
-- CÓMO SE APLICA: ver `db/README.md`. Se corre con la llave de servicio, una sola vez, y es idempotente.

create extension if not exists pgcrypto;
create schema if not exists adi;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · EL ROL DEL PRODUCTO
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Un rol propio y no `authenticated`: este pase NO es una sesión de Supabase Auth y no queremos que
-- herede supuestos de un sistema de cuentas que todavía no existe. Cuando existan, será otra cosa, y
-- se verá que es otra cosa.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'adi_tenant') then
    create role adi_tenant nologin;
  end if;
  -- `authenticator` es el rol que PostgREST usa para cambiarse al rol del token. En una base que no sea
  -- Supabase puede no existir: no es motivo para que la migración falle.
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant adi_tenant to authenticator';
  end if;
end
$$;

grant usage on schema public to adi_tenant;
grant usage on schema adi    to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · DE QUÉ EMPRESA ES ESTA CONSULTA
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- La única fuente autorizada. Sale del claim del pase, jamás de un parámetro que mande el cliente.
--
-- ⚠️ EL `exception` NO ES DEFENSIVO POR COSTUMBRE: es la falla cerrada escrita en código. Ante un claim
-- ausente, vacío o que no sea JSON válido, esto devuelve NULL — y ninguna fila iguala a NULL, así que
-- una consulta sin pase legítimo no devuelve nada en vez de devolver todo.
create or replace function adi.tenant_actual() returns text
language plpgsql
stable
as $$
declare
  crudo text;
begin
  crudo := current_setting('request.jwt.claims', true);
  if crudo is null or crudo = '' then
    return null;
  end if;
  return nullif(crudo::jsonb ->> 'tenant_id', '');
exception when others then
  return null;
end;
$$;

grant execute on function adi.tenant_actual() to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · LAS TABLAS
-- ════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── tenants ─────────────────────────────────────────────────────────────────────────────────────────
-- El id es TEXTO y con el mismo alfabeto que valida `tenantLimpio()` en `accessToken.js`. No es
-- casualidad: es el mismo identificador que ya viaja firmado dentro del código de acceso, así que la
-- base y la puerta hablan del mismo valor sin traducción en el medio.
create table if not exists public.tenants (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  nombre      text        not null,
  estado      text        not null default 'activo' check (estado in ('activo', 'suspendido')),
  created_at  timestamptz not null default now()
);

-- ── memberships ─────────────────────────────────────────────────────────────────────────────────────
-- VACÍA HOY, A PROPÓSITO. Es el enganche para cuando haya personas. El rol vive en la MEMBRESÍA y no
-- en el usuario, para no cerrar la puerta a pertenecer a más de una empresa.
create table if not exists public.memberships (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.tenants(id) on delete cascade,
  user_id     uuid,                       -- nulo hoy: todavía no hay cuentas
  rol         text        not null default 'usuario' check (rol in ('admin', 'usuario')),
  estado      text        not null default 'activo'  check (estado in ('activo', 'revocado')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ── uploads ─────────────────────────────────────────────────────────────────────────────────────────
-- `tipo` nace con la tabla, no se agrega después: es la decisión 1 del §7 del frente. Una referencia
-- sectorial y el negocio del cliente son dos cosas distintas desde el primer día.
--
-- EL HASH NO ES ÚNICO Y ESO ES DELIBERADO: un cliente puede subir el mismo archivo dos veces con razón.
-- Sirve para avisar («este archivo ya lo subiste el 12 de agosto») y para auditar, no para bloquear.
create table if not exists public.uploads (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.tenants(id) on delete cascade,
  tipo            text        not null check (tipo in ('negocio', 'referencia')),
  nombre_archivo  text        not null,
  hash_sha256     text        not null check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  bytes           integer     not null check (bytes > 0),
  storage_path    text,                   -- nulo hasta que se guarda; nulo otra vez a los 12 meses
  estado          text        not null default 'recibido'
                              check (estado in ('recibido', 'ingestado', 'rechazado')),
  subido_por      uuid,                   -- nulo hoy: todavía no hay cuentas
  created_at      timestamptz not null default now()
);

create index if not exists uploads_por_hash  on public.uploads (tenant_id, hash_sha256);
create index if not exists uploads_por_fecha on public.uploads (tenant_id, created_at desc);

-- ── fact_pack_versions ──────────────────────────────────────────────────────────────────────────────
-- El pack va en jsonb, y eso se decidió MIDIENDO: 10 KB el de un archivo chico, 98 KB el del negocio de
-- demostración. No hace falta almacenamiento de objetos para el pack; el .xlsx original sí va a Storage.
--
-- ⚠️ `upload_id` es `on delete set null` Y NUNCA `cascade`. Borrar el rastro de un archivo no puede
-- llevarse por delante la versión de datos que produjo: el original se borra a los 12 meses y el pack
-- vive para siempre. Por eso mismo el pack tiene que ser AUTOSUFICIENTE — la fuente de cada cifra
-- (archivo · hoja · fila) se guarda como texto DENTRO del pack, nunca como puntero a este archivo.
--
-- El SELLO DE PLAUSIBILIDAD va acá y no en `uploads`: califica las lecturas de ESTE pack. Si el usuario
-- asumió una observación, eso tiene que volver con el pack al recargar la página.
create table if not exists public.fact_pack_versions (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.tenants(id) on delete cascade,
  upload_id          uuid        references public.uploads(id) on delete set null,
  version            integer     not null check (version > 0),
  pack               jsonb       not null,
  sello              jsonb,
  plantilla_version  text,
  activa             boolean     not null default false,
  creado_por         uuid,                -- nulo hoy: todavía no hay cuentas
  created_at         timestamptz not null default now(),
  unique (tenant_id, version)
);

-- ⚠️ LA GARANTÍA DE UNA SOLA VERSIÓN ACTIVA VIVE ACÁ, NO EN UN `if` DEL SERVIDOR. Un booleano invita a
-- que haya dos; este índice hace que tener dos sea IMPOSIBLE, no improbable. Es la misma idea que RLS.
create unique index if not exists fact_pack_una_sola_activa
  on public.fact_pack_versions (tenant_id) where activa;

create index if not exists fact_pack_por_fecha
  on public.fact_pack_versions (tenant_id, created_at desc);


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · EL MURO · RLS EN TODAS, SIN EXCEPCIÓN
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- `force` además de `enable`: sin él, el dueño de la tabla se salta sus propias políticas. La llave de
-- servicio sigue pasando (es un atributo del rol, BYPASSRLS) y por eso se usa SOLO para migrar y sembrar.
alter table public.tenants            enable row level security;
alter table public.tenants            force  row level security;
alter table public.memberships        enable row level security;
alter table public.memberships        force  row level security;
alter table public.uploads            enable row level security;
alter table public.uploads            force  row level security;
alter table public.fact_pack_versions enable row level security;
alter table public.fact_pack_versions force  row level security;

-- Las políticas se recrean para que la migración sea idempotente sin dejar una versión vieja conviviendo.
drop policy if exists tenants_del_pase            on public.tenants;
drop policy if exists memberships_del_pase        on public.memberships;
drop policy if exists uploads_del_pase            on public.uploads;
drop policy if exists fact_pack_versions_del_pase on public.fact_pack_versions;

-- Una sola idea, repetida cuatro veces: se ve y se escribe solo donde la empresa sea la del pase.
--
-- `tenants` es la única que se acota por `id` en vez de por `tenant_id`, porque ELLA es la empresa. Y es
-- de solo lectura para el producto: dar de alta una empresa es un acto de administración, no algo que
-- una sesión pueda hacer por su cuenta.
create policy tenants_del_pase on public.tenants
  for select
  using (id = adi.tenant_actual());

create policy memberships_del_pase on public.memberships
  for select
  using (tenant_id = adi.tenant_actual());

create policy uploads_del_pase on public.uploads
  for all
  using      (tenant_id = adi.tenant_actual())
  with check (tenant_id = adi.tenant_actual());

create policy fact_pack_versions_del_pase on public.fact_pack_versions
  for all
  using      (tenant_id = adi.tenant_actual())
  with check (tenant_id = adi.tenant_actual());


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · LOS PERMISOS · Y LO QUE NO SE OTORGA
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ ACÁ NO HAY UN SOLO `delete`, Y ESA AUSENCIA ES LA GARANTÍA DE APPEND-ONLY. Una versión de datos no
-- se borra ni se pisa: se agrega una nueva y se marca activa. Volver atrás es marcar activa la anterior
-- —una operación, sin recálculo y auditada—. Si algún día hace falta borrar, es un acto de
-- administración con la llave de servicio, no algo que una sesión pueda hacer.
grant select                 on public.tenants            to adi_tenant;
grant select                 on public.memberships        to adi_tenant;
grant select, insert, update on public.uploads            to adi_tenant;
grant select, insert, update on public.fact_pack_versions to adi_tenant;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6 · RETENCIÓN DEL ARCHIVO ORIGINAL · 12 MESES
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Decisión 4 del §7: el original se borra a los 12 meses, las versiones del pack viven siempre.
--
-- ⚠️ ESTA FUNCIÓN NO BORRA NADA NI SE EJECUTA SOLA: solo LISTA lo vencido. Borrar el objeto de Storage y
-- soltar el puntero es el paso que la acompaña, y programarla es trabajo posterior. Está declarado como
-- tal a propósito: prometer una retención que nadie dispara sería peor que no tenerla.
create or replace function adi.originales_vencidos(meses integer default 12)
returns table (id uuid, tenant_id text, storage_path text)
language sql
stable
as $$
  select u.id, u.tenant_id, u.storage_path
    from public.uploads u
   where u.storage_path is not null
     and u.created_at < now() - make_interval(months => meses);
$$;
