-- === db/migraciones/003_activar_version.sql · ADOPTAR UNA VERSIÓN ES UN SOLO ACTO ===================
--
-- QUÉ RESUELVE. Cambiar de versión activa son dos cosas: apagar la que estaba y encender la nueva. Hechas
-- como dos llamadas separadas hay un instante en que la empresa no tiene NINGUNA versión activa — y si la
-- segunda falla, ese instante se vuelve permanente: el cliente confirmó sus datos y ADI se queda sin nada
-- que leer. Acá las dos pasan juntas o no pasa ninguna.
--
-- Y HAY UNA SEGUNDA RAZÓN, ESTRUCTURAL: el índice `fact_pack_una_sola_activa` impide que existan dos activas.
-- Encender antes de apagar no es «un orden distinto»: es una operación que la base RECHAZA. Adentro de una
-- función las dos ocurren en la misma transacción y el índice se evalúa al final, con una sola activa.
--
-- ⚠️ `security invoker` Y NO `definer`. La función corre con los permisos de QUIEN LLAMA, así que RLS sigue
-- aplicándose adentro: una versión de otra empresa sencillamente no se ve, y el `select` de abajo devuelve
-- nulo. El aislamiento lo sigue haciendo la política, no un `if` escrito acá. Una función `definer` habría
-- saltado el muro — que es justo lo que este frente no hace.
--
-- ⚠️ VIVE EN `public` Y NO EN `adi` A PROPÓSITO: PostgREST solo expone los esquemas configurados, y `adi` no
-- es uno de ellos. Una función en `adi` no se podría llamar desde el producto.
--
-- CÓMO SE APLICA: SQL Editor, después de la 001. Es idempotente.

create or replace function public.adi_activar_version(p_version_id uuid, p_sello jsonb default null)
returns table (id uuid, version integer, activa boolean)
language plpgsql
security invoker
as $$
declare
  v_tenant text;
begin
  -- Si el pase no alcanza esta versión, RLS hace que no exista para esta consulta. No hace falta comparar
  -- empresas a mano: preguntarlo YA es la comprobación.
  select fpv.tenant_id into v_tenant
    from public.fact_pack_versions fpv
   where fpv.id = p_version_id;

  if v_tenant is null then
    raise exception 'la versión no existe o no es alcanzable con este pase';
  end if;

  update public.fact_pack_versions
     set activa = false
   where fact_pack_versions.tenant_id = v_tenant
     and fact_pack_versions.activa;

  -- El sello pasa a confirmado en el MISMO acto: confirmar y activar son lo mismo desde el punto de vista del
  -- usuario, y separarlos dejaría una versión activa cuyo sello todavía dice que nadie la asumió.
  -- `coalesce` para que llamar sin sello no borre el que ya está.
  update public.fact_pack_versions
     set activa = true,
         sello  = coalesce(p_sello, fact_pack_versions.sello)
   where fact_pack_versions.id = p_version_id;

  return query
    select fpv.id, fpv.version, fpv.activa
      from public.fact_pack_versions fpv
     where fpv.id = p_version_id;
end;
$$;

grant execute on function public.adi_activar_version(uuid, jsonb) to adi_tenant;


-- ── LA VERSIÓN ACTIVA, EN UNA SOLA CONSULTA ─────────────────────────────────────────────────────────
-- No es imprescindible —se puede pedir con un filtro— pero deja el contrato escrito en la base: «la activa
-- es una sola y es esta». Sirve para que el paso siguiente (servir el pack) no dependa de que quien pregunte
-- se acuerde de filtrar por `activa`.
create or replace function public.adi_version_activa()
returns table (id uuid, version integer, pack jsonb, sello jsonb, plantilla_version text)
language sql
security invoker
stable
as $$
  select fpv.id, fpv.version, fpv.pack, fpv.sello, fpv.plantilla_version
    from public.fact_pack_versions fpv
   where fpv.activa
   limit 1;
$$;

grant execute on function public.adi_version_activa() to adi_tenant;
