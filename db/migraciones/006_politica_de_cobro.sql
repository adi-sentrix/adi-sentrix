-- === db/migraciones/006_politica_de_cobro.sql · EL PLAZO DE PAGO, QUE ES POLÍTICA Y NO DATO =============
--
-- LA ORDEN DEL OWNER (2026-08-30), textual: «Plazo de pago por cliente, con un plazo general por defecto para
-- la empresa. La app debe permitir declarar un plazo general, por ejemplo 30 días, y sobrescribirlo por cliente
-- cuando aplique. Si un cliente no tiene plazo propio, usa el general. Esto es política del negocio, no dato
-- del período, así que vive en la app/versión del pack, no como columna obligatoria de la planilla.»
--
-- ⚠️ NO SE CREA NINGUNA TABLA, Y ES DELIBERADO. La tentación era una `politicas` por empresa. Pero el pack ya
-- es la unidad que el producto sirve y que tiene que ser AUTOSUFICIENTE PARA SIEMPRE (decisión del owner en la
-- vía 3): si la política viviera aparte, un pack leído dentro de un año no sabría con qué plazos se calculó su
-- vencido, y el número que ADI dijo en su momento no se podría reconstruir. Vive dentro del pack, en
-- `perfil.cobro`, al lado de la moneda y por la misma razón.
--
-- ⚠️ Y SE ARRASTRA A LA VERSIÓN SIGUIENTE en `persistirCarga`: sin eso, el usuario declara sus plazos una vez,
-- sube el archivo del mes siguiente y el vencido vuelve a una raya sin que nadie haya cambiado nada. Escribirlo
-- solo acá habría dejado un producto que «se olvida» todos los meses.
--
-- ⚠️ ESCRIBE SOBRE LA VERSIÓN ACTIVA, y eso NO rompe el append-only. Lo inmutable es el HECHO —las ventas, los
-- abonos, el archivo original—, no la política con la que se lee. Es exactamente lo que ya hace
-- `adi_activar_version` con la moneda desde la 004. Cambiar un plazo no reescribe ninguna venta.
--
-- CÓMO SE APLICA: SQL Editor, después de la 005. Es idempotente.

-- ── DECLARAR LA POLÍTICA DE COBRO ────────────────────────────────────────────────────────────────────
-- Escribe `perfil.cobro` en la versión ACTIVA de la empresa del pase. Devuelve lo que quedó guardado, para que
-- el servidor no tenga que adivinar qué se escribió.
--
-- `p_dias_general` nulo significa SIN PLAZO GENERAL, y es distinto de cero: cero es «paga contra entrega», una
-- política real. Por eso no se usa `coalesce` para taparlo.

create or replace function public.adi_declarar_cobro(
  p_dias_general int   default null,
  p_por_cliente  jsonb default '{}'::jsonb,
  p_actor_id     uuid  default null,
  p_actor_label  text  default null,
  p_actor_rol    text  default null
)
returns table (version integer, cobro jsonb)
language plpgsql
security invoker
as $$
declare
  v_id      uuid;
  v_tenant  text;
  v_cobro   jsonb;
  v_limpio  jsonb := '{}'::jsonb;
  v_clave   text;
  v_valor   jsonb;
  v_dias    int;
begin
  -- la versión activa de la empresa que trae el pase; RLS ya acota a esa empresa
  select fpv.id, fpv.tenant_id into v_id, v_tenant
    from public.fact_pack_versions fpv
   where fpv.activa
   limit 1;

  if v_id is null then
    raise exception 'esta empresa no tiene datos activos: primero hay que cargar una planilla';
  end if;

  -- ⚠️ EL TECHO SE VALIDA ACÁ TAMBIÉN, no solo en el servidor. Un plazo de cuatro dígitos es un error de tipeo
  -- y dejarlo pasar convertiría toda la deuda en «por vencer» para siempre. Lo que no se entiende se DESCARTA,
  -- nunca se aproxima: un plazo ilegible no puede convertirse en 30.
  if p_dias_general is not null and (p_dias_general < 0 or p_dias_general > 365) then
    raise exception 'el plazo general tiene que estar entre 0 y 365 días';
  end if;

  for v_clave, v_valor in select * from jsonb_each(coalesce(p_por_cliente, '{}'::jsonb)) loop
    if jsonb_typeof(v_valor) = 'number' then
      v_dias := (v_valor #>> '{}')::numeric::int;
      if v_dias >= 0 and v_dias <= 365 and length(trim(v_clave)) > 0 then
        v_limpio := jsonb_set(v_limpio, array[trim(v_clave)], to_jsonb(v_dias), true);
      end if;
    end if;
  end loop;

  v_cobro := jsonb_build_object(
    'diasGeneral', case when p_dias_general is null then 'null'::jsonb else to_jsonb(p_dias_general) end,
    'porCliente',  v_limpio,
    'declaradoEn', to_jsonb(now()),
    'declaradoPor',    to_jsonb(nullif(trim(coalesce(p_actor_label, '')), '')),
    'declaradoPorRol', to_jsonb(nullif(trim(coalesce(p_actor_rol, '')), ''))
  );

  update public.fact_pack_versions
     set pack = jsonb_set(
                  case when fact_pack_versions.pack ? 'perfil'
                       then fact_pack_versions.pack
                       else jsonb_set(fact_pack_versions.pack, '{perfil}', '{}'::jsonb, true)
                  end,
                  '{perfil,cobro}', v_cobro, true)
   where fact_pack_versions.id = v_id;

  return query
    select fpv.version, fpv.pack #> '{perfil,cobro}'
      from public.fact_pack_versions fpv
     where fpv.id = v_id;
end;
$$;

grant execute on function public.adi_declarar_cobro(int, jsonb, uuid, text, text) to adi_tenant;

comment on function public.adi_declarar_cobro is
  'Declara el plazo de pago de la empresa (general y por cliente) dentro del pack de su versión activa. Política del negocio, no dato del período.';
