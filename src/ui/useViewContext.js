/* === src/ui/useViewContext.js · EL HOOK DE EMISIÓN · SENTRIX → ADI ============================================
 * (owner 2026-08-09 · frente EMISIÓN del Contrato de Concordancia ADI ↔ Sentrix)
 *
 * QUÉ RESUELVE. Que un componente nuevo quede conectado al chat SIN QUE NADIE SE ACUERDE de conectarlo. Tres
 * candados, en capas:
 *
 *   1. EL ÚNICO CAMINO AL "ask" PASA POR ACÁ. `AskRow`, los botones "Que ADI lo explique" y el flotante de vista
 *      reciben el `ask` que devuelve este hook, no un `onAsk` pelado. Un componente que se olvide del hook NO
 *      TIENE BOTÓN — una falla visible, no una respuesta silenciosamente descontextualizada.
 *   2. FALLA EN EL PRIMER RENDER, EN DEV. Si el componentId no está declarado en `viewManifest.js`, el hook TIRA
 *      bajo `import.meta.env.DEV`. En producción degrada honesto: `ctx:null` y el `ask` sigue funcionando como
 *      antes (prefill de la pregunta, sin contexto) — un contrato a medio cablear jamás puede romperle la Mesa
 *      al usuario.
 *   3. EL GATE LO HACE OBLIGATORIO EN CI. `_view_contract_gate.mjs` exige biyección entre los literales
 *      `useViewContext("…")` de SentrixPanel.jsx y las llaves de VIEW_MANIFEST.
 *
 * QUÉ EMITE Y CUÁNDO:
 *   · `ask(pregunta)` publica el contexto de ESA pieza (`setUISignal({viewContext})`) y llama al `onAsk` del panel
 *     con `(pregunta, ctx)`. El click INFORMA y PRECARGA — nunca dispara la respuesta (regla dura del owner).
 *   · `ambient:true` publica el contexto de la VISTA mientras esa vista está montada. Es lo que hace que ADI
 *     reciba el contexto AUNQUE EL USUARIO NO HAYA PULSADO NINGÚN CTA (requisito 2 del owner): escribir en el
 *     chat con la Mesa abierta ya trae la vista, la sección, el escenario y el universo que hay delante.
 *
 * LO QUE NO HACE: no lee el DOM, no calcula, no llama al LLM, no manda tablas. Deriva del builder y sella.
 */
import { useEffect, useMemo, useRef } from "react";
import { VIEW_MANIFEST } from "../adi/sentrix/viewManifest.js";
import { deriveViewContext } from "../adi/sentrix/viewContextFrom.js";
import { addressFromViewContext, formatAddress } from "../adi/sentrix/address.js";
import { setUISignal } from "../adi/uiSignals.js";
import { getTenantId } from "../data/tenantStore.js";

const _DEV = (() => { try { return !!(import.meta && import.meta.env && import.meta.env.DEV); } catch { return false; } })();

// Clave estable y CHICA para las deps del memo. Nunca serializa la lista de entidades completa: solo su forma y su
// tamaño — el mismo criterio O(1) del contexto (una selección de 300 no puede convertirse en una dep de 300 nombres).
function _depKey(controles, seleccion) {
  const c = controles && typeof controles === "object"
    ? Object.keys(controles).sort().map((k) => `${k}=${controles[k]}`).join(",") : "";
  if (!seleccion || typeof seleccion !== "object") return `${c}|todas`;
  const ents = Array.isArray(seleccion.entidades) ? seleccion.entidades : [];
  const forma = seleccion.modo || (ents.length ? "explicita" : "todas");
  const nombres = ents.length && ents.length <= 8 ? ents.slice().sort().join(",") : "";
  const filtro = seleccion.filtro && typeof seleccion.filtro === "object"
    ? Object.keys(seleccion.filtro).sort().map((k) => `${k}=${seleccion.filtro[k]}`).join(",") : "";
  // `seleccion.filtros` (plural) es un campo DISTINTO de `seleccion.filtro`: el primero son los filtros de la VISTA
  // (deriveViewContext lo pasa a `vc.filtros`, y `viewContextKey` lo hashea), el segundo es el criterio de una
  // selección-por-filtro. Faltaba acá (corrección 2026-08-09, revisión del frente): sin él, cambiar un filtro de la
  // vista no invalidaba el memo y el contexto emitido quedaba con el filtro ANTERIOR — justo la desincronización que
  // este contrato existe para impedir. Hoy ninguna cara los pasa (Comercial perdió sus filtros), así que el arreglo
  // es inerte; deja de serlo el día que vuelvan.
  const filtrosVista = seleccion.filtros && typeof seleccion.filtros === "object"
    ? Object.keys(seleccion.filtros).sort().map((k) => `${k}=${seleccion.filtros[k]}`).join(",") : "";
  return `${c}|${forma}|${seleccion.n != null ? seleccion.n : ents.length}|${nombres}|${filtro}|${filtrosVista}`;
}

/* ── useViewContext(componentId, builderOut, opts) → { ctx, ask, address, componentId } ────────────────────────
 * opts:
 *   scenario    el escenario que el panel usó DE VERDAD (nunca uno supuesto)
 *   controles   el estado local del componente (se filtra a lo que el manifiesto declara)
 *   seleccion   { modo, entidades[], filtro, n, filtros } — lo que el usuario tiene efectivamente seleccionado
 *   onAsk       el transporte hacia el chat (lo pasa el panel; si falta, el componente no ofrece botón)
 *   ambient     publica este contexto como el de la pantalla mientras el componente está montado
 */
export function useViewContext(componentId, builderOut, {
  scenario = null, controles = null, seleccion = null, onAsk = null, ambient = false,
} = {}) {
  const declarado = !!VIEW_MANIFEST[componentId];
  if (_DEV && !declarado) {
    throw new Error(
      `useViewContext: componentId no declarado en viewManifest.js: "${componentId}". ` +
      "Toda pieza que ofrezca «Que ADI lo explique» tiene que estar declarada (métrica, eje, universo, sello y evidencia)."
    );
  }

  const depKey = _depKey(controles, seleccion);
  const ctx = useMemo(() => {
    if (!declarado || !builderOut) return null;
    try {
      return deriveViewContext(componentId, builderOut, {
        scenario, controles: controles || {}, seleccion, tenantId: _tenant(),
      });
    } catch { return null; }   // un builder que cambió de forma degrada a "sin contexto", nunca rompe la Mesa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId, declarado, builderOut, scenario, depKey]);

  // el contexto AMBIENTE de la pantalla: se publica mientras la vista está montada y se limpia al desmontarla —
  // un contexto de una vista cerrada contaminaría el turno siguiente, que es exactamente lo que la invalidación
  // del contrato viene a impedir.
  const ambientRef = useRef(false);
  useEffect(() => {
    if (!ambient) return undefined;
    if (!ctx) return undefined;
    setUISignal({ viewContext: ctx });
    ambientRef.current = true;
    return () => { if (ambientRef.current) { setUISignal({ viewContext: null }); ambientRef.current = false; } };
  }, [ambient, ctx]);

  // `ask` es el reemplazo EXACTO de un `onAsk(q)` a nivel de firma (un string), así que las visuales no cambian:
  // lo que cambia es que ahora, además de precargar la pregunta, viaja el contexto ESTRUCTURADO de la pieza.
  const ask = useMemo(() => {
    if (typeof onAsk !== "function") return null;
    return (pregunta) => {
      if (ctx) setUISignal({ viewContext: ctx });   // el click INFORMA el contexto…
      onAsk(String(pregunta == null ? "" : pregunta), ctx || null);   // …y precarga la pregunta. Nunca dispara.
    };
  }, [onAsk, ctx]);

  const address = useMemo(() => (ctx ? formatAddress(addressFromViewContext(ctx)) : null), [ctx]);

  return { ctx, ask, address, componentId };
}

/* ── useVistaContext(vista, builderOut, opts) ──────────────────────────────────────────────────────────────────
 * El contexto de LA VISTA ENTERA (`<vista>/otro/vista`), publicado como ambiente. Es lo que hace verdadero el
 * requisito 2 del owner: con la Mesa abierta, ADI recibe qué vista estás mirando aunque escribas directo en el
 * chat sin tocar ningún botón. */
export function useVistaContext(vista, builderOut, opts = {}) {
  return useViewContext(`${vista}/otro/vista`, builderOut, { ...opts, ambient: true });
}

function _tenant() { try { return getTenantId(); } catch { return null; } }

// Re-export para que la Mesa no tenga que importar de dos lados el mismo concepto.
export { VIEW_MANIFEST };
export default useViewContext;
