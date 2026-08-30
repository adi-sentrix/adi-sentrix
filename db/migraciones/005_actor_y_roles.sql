-- === db/migraciones/005_actor_y_roles.sql · QUIÉN HIZO QUÉ, ANTES DE QUE HAYA PERSONAS ==============
--
-- LA ORDEN DEL OWNER (2026-08-30), textual: «aunque hoy entremos por código de empresa, el diseño debe asumir
-- que pronto una empresa pedirá habilita un segundo usuario». Y la condición: no implementar Auth completo
-- todavía, pero **que lo de ahora no lo bloquee**.
--
-- EL MODELO QUE SE FIJA ACÁ:
--   · la EMPRESA es el contenedor de datos      (`tenants`, y `tenant_id` en todo)
--   · la PERSONA es quien actúa                 (`memberships.user_id`, nulo hasta que haya cuentas)
--   · `memberships` une persona + empresa + ROL
--   · toda acción sensible responde tres cosas: quién · en qué empresa · con qué rol
--
-- ⚠️ POR QUÉ ESTO SE HACE HOY Y NO CUANDO HAYA CUENTAS. Agregar columnas nulas a tablas casi vacías es
-- gratis. Agregarlas con clientes reales adentro obliga a decidir qué poner en el histórico —y cualquier
-- respuesta es inventada—. El costo de anticiparse es una migración de treinta líneas; el de no hacerlo es
-- una migración de datos con agujeros.
--
-- ⚠️ NO SE CREA UNA TABLA DE AUDITORÍA VACÍA. La tentación era una `acciones` que nadie escribe todavía: eso
-- es el defecto de «nace muerta» que ya apareció dos veces en este frente. Las acciones sensibles YA tienen
-- su fila —subir un archivo, crear una versión, activarla— así que el actor se registra AHÍ, sobre algo que
-- de verdad se escribe. Si algún día hace falta un registro aparte, se agrega sin deshacer nada.
--
-- ⚠️ EL ROL SE GUARDA EN EL MOMENTO DE LA ACCIÓN, no se lee después de `memberships`. Los roles cambian: lo
-- que hay que poder responder es con qué rol se hizo ESO, no qué rol tiene hoy esa persona.
--
-- CÓMO SE APLICA: SQL Editor, después de la 004. Es idempotente.

-- ── LOS ROLES ────────────────────────────────────────────────────────────────────────────────────────
-- Los que declaró el owner. `owner` y `admin` comparten capacidades hoy; se distinguen porque el owner es
-- el que no se puede quitar a sí mismo. El default es el MENOS privilegiado: un rol que se otorga por
-- descuido tiene que ser el que no puede romper nada.
alter table public.memberships drop constraint if exists memberships_rol_check;
alter table public.memberships alter column rol set default 'viewer';
update public.memberships set rol = 'viewer' where rol = 'usuario';
alter table public.memberships add constraint memberships_rol_check
  check (rol in ('owner', 'admin', 'editor', 'viewer'));

comment on column public.memberships.rol is
  'owner/admin: invita usuarios, cambia configuración y ACTIVA versiones · editor: sube planillas y ve la preview, no activa · viewer: solo consulta';


-- ── EL ACTOR DE CADA ACCIÓN SENSIBLE ─────────────────────────────────────────────────────────────────
-- Tres campos, siempre juntos: id (nulo hasta que haya cuentas) · etiqueta legible · rol al momento.
--
-- ⚠️ LA ETIQUETA NO ES UN PLACEHOLDER: HOY YA SE PUEDE LLENAR. El código de acceso lleva adentro el nombre
-- de a quién se le emitió, firmado. Eso no identifica a una persona en el sentido de una cuenta —dos
-- personas pueden compartir un código— pero es información REAL y verificada, no un «desconocido». Cuando
-- existan las cuentas, `actor_id` se llena y la etiqueta pasa a ser el nombre de la cuenta.

alter table public.uploads add column if not exists subido_por_label text;
alter table public.uploads add column if not exists subido_por_rol   text;

alter table public.fact_pack_versions add column if not exists creado_por_label text;
alter table public.fact_pack_versions add column if not exists creado_por_rol   text;

-- ACTIVAR ES LA ACCIÓN MÁS SENSIBLE DE TODAS y era la única sin rastro: la fila cambiaba de `activa` y no
-- quedaba quién ni cuándo. Es la que decide de qué datos habla ADI para toda la empresa — y desde la 2.3
-- también la que fija la moneda, y desde el flujo comercial fijará el plazo de pago.
alter table public.fact_pack_versions add column if not exists activada_en          timestamptz;
alter table public.fact_pack_versions add column if not exists activada_por         uuid;
alter table public.fact_pack_versions add column if not exists activada_por_label   text;
alter table public.fact_pack_versions add column if not exists activada_por_rol     text;


-- ── ACTIVAR REGISTRA A SU ACTOR ──────────────────────────────────────────────────────────────────────
-- Misma transacción que apagar la anterior, encender esta y fijar el sello y la moneda: quién lo hizo es
-- parte del acto, no una anotación posterior que pueda quedarse sin escribir.
drop function if exists public.adi_activar_version(uuid, jsonb, text);

create or replace function public.adi_activar_version(
  p_version_id  uuid,
  p_sello       jsonb default null,
  p_moneda      text  default null,
  p_actor_id    uuid  default null,
  p_actor_label text  default null,
  p_actor_rol   text  default null
)
returns table (id uuid, version integer, activa boolean)
language plpgsql
security invoker
as $$
declare
  v_tenant text;
  v_moneda text;
begin
  select fpv.tenant_id into v_tenant
    from public.fact_pack_versions fpv
   where fpv.id = p_version_id;

  if v_tenant is null then
    raise exception 'la versión no existe o no es alcanzable con este pase';
  end if;

  v_moneda := nullif(upper(trim(coalesce(p_moneda, ''))), '');
  if v_moneda is not null and v_moneda !~ '^[A-Z]{2,6}$' then
    v_moneda := null;
  end if;

  update public.fact_pack_versions
     set activa = false
   where fact_pack_versions.tenant_id = v_tenant
     and fact_pack_versions.activa;

  update public.fact_pack_versions
     set activa             = true,
         sello              = coalesce(p_sello, fact_pack_versions.sello),
         activada_en        = now(),
         activada_por       = p_actor_id,
         activada_por_label = nullif(trim(coalesce(p_actor_label, '')), ''),
         activada_por_rol   = nullif(trim(coalesce(p_actor_rol, '')), ''),
         pack   = case
                    when v_moneda is null then fact_pack_versions.pack
                    else jsonb_set(
                           case when fact_pack_versions.pack ? 'perfil'
                                then fact_pack_versions.pack
                                else jsonb_set(fact_pack_versions.pack, '{perfil}', '{}'::jsonb, true)
                           end,
                           '{perfil,moneda}', to_jsonb(v_moneda), true)
                  end
   where fact_pack_versions.id = p_version_id;

  return query
    select fpv.id, fpv.version, fpv.activa
      from public.fact_pack_versions fpv
     where fpv.id = p_version_id;
end;
$$;

grant execute on function public.adi_activar_version(uuid, jsonb, text, uuid, text, text) to adi_tenant;
