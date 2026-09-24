-- === db/migraciones/014_piso_materialidad_cobranza.sql · EL AJUSTE DE LA EMPRESA AL PISO DE MATERIALIDAD ====
-- (owner 2026-09-23, diseño sellado de la pieza PRI-04 — capa de conocimiento, `_conocimiento_gate.mjs`)
--
-- QUÉ RESUELVE. La pieza PRI-04 («¿alguna cuenta pesa más en el vencido que en la venta, con una diferencia
-- que supere el piso de materialidad?») usa k = 1% del saldo pendiente como CRITERIO GENERAL DE ADI —
-- `src/config/contract/pisoMaterialidadCobranza.js:PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI`. El owner lo selló
-- así, textual: «El 1% queda explícitamente como criterio general de ADI, ajustable por la empresa, no como
-- verdad sectorial». Esta migración agrega la columna que permite a UNA empresa declarar SU propio criterio,
-- el mismo camino B que ya abrieron 012/013 para el perfil (`tenants`, fuera de la plantilla congelada, fila
-- POR EMPRESA — un criterio de materialidad no cambia cada vez que sube un Excel).
--
-- ⚠️ ESTO ES UN ARCHIVO, NO UN HECHO EN LA BASE — igual que 012/013, sin aplicar contra ningún proyecto de
-- Supabase: aplicar una migración es un paso de despliegue y esta tarea no tiene esa autorización.
--
-- ⚠️ OPCIONAL, NULO POR DEFECTO. Sin una fila nueva, `pisoMaterialidadCobranzaDe(tenant)` (el módulo de arriba)
-- sigue devolviendo el criterio de ADI, exactamente como hoy — cero diferencia de comportamiento.
--
-- EL RANGO — 0,1% a 10% (los mismos dos números que `PISO_MATERIALIDAD_COBRANZA_MIN`/`_MAX` del módulo de
-- arriba; un `.sql` no puede importar un `.js`, así que el candado `_piso_materialidad_gate.mjs` compara los
-- dos textos para que no diverjan en silencio — el mismo mecanismo que `_entrega_gate.mjs` ya usa entre la
-- migración 013 y `taxonomiaPerfil.js`). Fuera de ese rango no es un criterio de materialidad razonable: un
-- piso de 0,01% dispararía "señal" en cualquier redondeo, y uno de 40% no dispararía nunca — ninguno de los dos
-- es una política de cobranza, son errores de tipeo.
--
-- PROCEDENCIA — el mismo par que ya usan 012/013 para lo que la EMPRESA declaró o el motor derivó
-- ('medido'/'derivado'); nunca 'estimacion_referencia'/'supuesto_usuario'/'propuesta' EN LA BASE — esas
-- categorías son del libro de hechos del turno (`notario/hechos.js:PROCEDENCIAS`), que traduce 'medido' de acá
-- en 'supuesto_usuario' AL SERVIR (`pisoMaterialidadCobranzaDe`, textual en su cabecera): la base guarda de
-- dónde salió el número, el libro de hechos guarda qué tan firme es para el turno — dos preguntas distintas.
--
-- CÓMO SE APLICARÍA (cuando el owner lo autorice): SQL Editor, después de la 013. Es idempotente.


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · LAS COLUMNAS · opcionales, nulas por defecto
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.tenants add column if not exists piso_materialidad_cobranza_pct         numeric;
alter table public.tenants add column if not exists piso_materialidad_cobranza_procedencia text;

comment on column public.tenants.piso_materialidad_cobranza_pct is
  'El criterio de materialidad de cobranza de ESTA empresa, en fracción (0.01 = 1%) — nunca en puntos porcentuales enteros. Nulo = no declarado, la pieza PRI-04 usa el criterio general de ADI (config/contract/pisoMaterialidadCobranza.js). Rango: 0.001 a 0.10 (el check de abajo).';
comment on column public.tenants.piso_materialidad_cobranza_procedencia is
  'SOLO ''medido'' o ''derivado'' — el mismo par que sector_procedencia/tipo_producto_procedencia (012/013). "Lo declaró la empresa" o "lo derivó el motor"; nunca una categoría del libro de hechos del turno.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · LOS CHECKS · rango razonable, vocabulario cerrado para la procedencia
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.tenants drop constraint if exists tenants_piso_materialidad_cobranza_pct_check;
alter table public.tenants add constraint tenants_piso_materialidad_cobranza_pct_check
  check (piso_materialidad_cobranza_pct is null
    or piso_materialidad_cobranza_pct between 0.001 and 0.10);

alter table public.tenants drop constraint if exists tenants_piso_materialidad_cobranza_procedencia_check;
alter table public.tenants add constraint tenants_piso_materialidad_cobranza_procedencia_check
  check (piso_materialidad_cobranza_procedencia is null
    or piso_materialidad_cobranza_procedencia in ('medido', 'derivado'));

-- un valor sin procedencia (o viceversa) es una fila a medio declarar: la misma disciplina que 012 aplica a
-- cada par código+procedencia del perfil.
alter table public.tenants drop constraint if exists tenants_piso_materialidad_cobranza_par_check;
alter table public.tenants add constraint tenants_piso_materialidad_cobranza_par_check
  check ((piso_materialidad_cobranza_pct is null) = (piso_materialidad_cobranza_procedencia is null));


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · CÓMO SE ESCRIBE · misma receta que `adi_declarar_perfil_empresa` (012) — función acotada por columna,
--     nunca una política de UPDATE nueva en `tenants` (001: «es de solo lectura para el producto»)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
create or replace function public.adi_declarar_piso_materialidad_cobranza(
  p_pct         numeric,
  p_procedencia text default 'medido'
)
returns table (
  id                                   text,
  piso_materialidad_cobranza_pct       numeric,
  piso_materialidad_cobranza_procedencia text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text;
begin
  v_tenant := adi.tenant_actual();
  if v_tenant is null then
    raise exception 'sin pase: no se declara nada sin saber de qué empresa es';
  end if;
  if p_pct is null or p_pct < 0.001 or p_pct > 0.10 then
    raise exception 'el piso de materialidad de cobranza tiene que estar entre 0.001 y 0.10 (llegó %)', p_pct;
  end if;
  if p_procedencia not in ('medido', 'derivado') then
    raise exception 'procedencia «%» no válida (medido | derivado)', p_procedencia;
  end if;

  update public.tenants set
    piso_materialidad_cobranza_pct         = p_pct,
    piso_materialidad_cobranza_procedencia = p_procedencia
  where id = v_tenant;

  return query
    select t.id, t.piso_materialidad_cobranza_pct, t.piso_materialidad_cobranza_procedencia
      from public.tenants t
     where t.id = v_tenant;
end;
$$;

grant execute on function public.adi_declarar_piso_materialidad_cobranza(numeric, text) to adi_tenant;
