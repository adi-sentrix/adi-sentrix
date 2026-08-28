-- === db/migraciones/004_moneda_al_activar.sql · LA MONEDA SE DECLARA AL ADOPTAR LOS DATOS ===========
--
-- QUÉ RESUELVE. «No quiero que ADI asuma CLP ni USD» (owner 2026-08-27). Si la planilla no trae la moneda,
-- la pantalla de carga la pregunta una vez, después de la preview y antes de «Usar estos datos». Esa
-- respuesta tiene que quedar DENTRO del pack, igual que el sello de plausibilidad.
--
-- POR QUÉ ACÁ Y NO EN UNA ESCRITURA APARTE: el pack ya está guardado —inactivo— cuando el usuario responde.
-- Escribir la moneda por un lado y activar por otro abre una ventana donde la versión queda activa con el
-- dato sin rotular, o rotulada sin estar activa. Las tres cosas que decide el usuario al confirmar —adoptar,
-- asumir las observaciones y declarar la moneda— son un solo acto, y acá pasan juntas o no pasa ninguna.
--
-- ⚠️ LA MONEDA NO SE INFIERE NI ACÁ. `p_moneda` nulo deja el pack como está: no se le pone un valor por
-- defecto «mientras tanto». Un pack sin moneda se rotula SIN símbolo, que es lo honesto — decir «$» sería
-- afirmarle al usuario en qué moneda está su dato cuando nadie se lo preguntó.
--
-- CÓMO SE APLICA: SQL Editor, después de la 003. Es idempotente.

-- Se suelta la versión de dos parámetros antes de crear la de tres: `create or replace` con otra firma
-- dejaría las DOS funciones vivas y una llamada de dos argumentos quedaría ambigua.
drop function if exists public.adi_activar_version(uuid, jsonb);

create or replace function public.adi_activar_version(
  p_version_id uuid,
  p_sello      jsonb default null,
  p_moneda     text  default null
)
returns table (id uuid, version integer, activa boolean)
language plpgsql
security invoker
as $$
declare
  v_tenant text;
  v_moneda text;
begin
  -- Si el pase no alcanza esta versión, RLS hace que no exista para esta consulta. No hace falta comparar
  -- empresas a mano: preguntarlo YA es la comprobación.
  select fpv.tenant_id into v_tenant
    from public.fact_pack_versions fpv
   where fpv.id = p_version_id;

  if v_tenant is null then
    raise exception 'la versión no existe o no es alcanzable con este pase';
  end if;

  -- La misma limpieza que hace `monedaLimpia()` en el código: entre 2 y 6 letras, en mayúscula. No traduce ni
  -- corrige — solo evita que entre basura al pack. Lo que no pase por acá se ignora, no se aproxima.
  v_moneda := nullif(upper(trim(coalesce(p_moneda, ''))), '');
  if v_moneda is not null and v_moneda !~ '^[A-Z]{2,6}$' then
    v_moneda := null;
  end if;

  update public.fact_pack_versions
     set activa = false
   where fact_pack_versions.tenant_id = v_tenant
     and fact_pack_versions.activa;

  update public.fact_pack_versions
     set activa = true,
         sello  = coalesce(p_sello, fact_pack_versions.sello),
         -- `jsonb_set` con `create_missing = true`: si el pack no traía `perfil`, se crea. Si `p_moneda` es
         -- nulo el pack queda intacto, que es lo que corresponde cuando la planilla ya la declaraba.
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

grant execute on function public.adi_activar_version(uuid, jsonb, text) to adi_tenant;
