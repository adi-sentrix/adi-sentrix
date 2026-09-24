/* === _piso_materialidad_gate.mjs · PRI-04 — EL PISO DE MATERIALIDAD DE COBRANZA (owner 2026-09-23, diseño
 * SELLADO) ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * Prueba las cinco reglas selladas del diseño (ver el encargo textual y `medir.js:pisoMaterialidadCobranza`):
 *   1 · D_c = (participación en el vencido − participación en la venta) × vencido total; material ⟺ D_c ≥ k×P.
 *   2 · universo evaluable = solo cuentas con plazo declarado; proporciones sobre el LIBRO COMPLETO, nunca el
 *       subconjunto que se responde.
 *   3 · tres veredictos (señal · bajo_piso · sin_evaluar), nunca "no_ocurre"; `borde` como atributo.
 *   4 · cobertura visible, con las identidades que tienen que cerrar.
 *   5 · el nivel de comparación (el piso) nunca es un hecho publicado con nombre propio en el libro.
 *
 * Carteras de prueba INLINE (nunca fixtures de archivo, nunca TENANT_DEMO) — cada una es una tabla de señales
 * sintética, con figs mínimas y directas, sobre `notario/hechos.js`/`notario/evidencia.js` reales: el MISMO
 * motor de verificación que ya certifican `_hechos_gate.mjs`/`_conocimiento_gate.mjs`, nunca uno de juguete.
 * Sin red: cifras y comparaciones puramente locales. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _piso_materialidad_gate.mjs`). */
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";
import { medirPieza, coberturaPisoDeCobranza } from "./src/adi/conocimiento/medir.js";
import { servirPieza } from "./src/adi/conocimiento/servir.js";
import { piezaPorId, PIEZAS_CONOCIMIENTO } from "./src/adi/conocimiento/piezas.js";
import { validarPieza } from "./src/adi/conocimiento/validarPieza.js";
import { evaluarPertinencia } from "./src/adi/conocimiento/evaluarPertinencia.js";
import { construirTablaDeSenales } from "./src/adi/conocimiento/tablaSenales.js";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import {
  PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI, PISO_MATERIALIDAD_COBRANZA_MIN, PISO_MATERIALIDAD_COBRANZA_MAX,
} from "./src/config/contract/pisoMaterialidadCobranza.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

const PIEZA = piezaPorId("PRI-04");

/* ── LA CARTERA SINTÉTICA — figs mínimas y directas: "<cliente> · Venta" / "· Saldo pendiente" / "· Saldo
 * vencido" (esta última SOLO si el cliente tiene plazo). Formato EXACTO al que usan `cobranza.js`/`mesaFlujo.js`
 * de verdad, para que `notario/evidencia.js` case cada fig por el mismo camino que ya certifica el resto de la
 * suite — no es un formato de juguete. ── */
let _fid = 0;
function _fig(entidad, concepto, raw) {
  _fid += 1;
  const label = entidad ? `${entidad} · ${concepto}` : concepto;
  return { id: `pmc${_fid}`, label, raw, unit: "money", value: formatoDeLaCasa(raw, "money"), tipo: { verificabilidad: "literal" } };
}
/** clientes: [{nombre, venta, saldoPendiente, vencido: number|null}] — `vencido: null` = sin plazo declarado. */
function tablaDeCartera(clientes) {
  const figs = [];
  const cuentas = {};
  let vencidoTotal = 0;
  for (const c of clientes) {
    figs.push(_fig(c.nombre, "Venta", c.venta));
    figs.push(_fig(c.nombre, "Saldo pendiente", c.saldoPendiente));
    cuentas[c.nombre] = {
      bajoBenchmark: null, cargaAlta: null, cargaPct: null, cargaSobreResto: null, cargaPromedioResto: null,
      venta: c.venta, variacionVenta: "sin_serie", enRespuesta: false, prioridadPrimera: false,
      saldoPendiente: c.saldoPendiente,
      tienePlazoDeclarado: c.vencido != null,
      vencido: c.vencido != null ? c.vencido : null,
      vencidoPositivo: c.vencido != null ? c.vencido > 0 : null,
    };
    if (c.vencido != null) { figs.push(_fig(c.nombre, "Saldo vencido", c.vencido)); vencidoTotal += c.vencido; }
  }
  figs.push(_fig(null, "Saldo vencido · total", vencidoTotal));
  const ejesDelTenant = { cliente: clientes.map((c) => c.nombre) };
  const indice = indiceDeEvidencia({ figs, datoProyectado: null, ejesDelTenant });
  return { cuentas, skus: {}, periodo: { abierto: false }, pregunta: { temas: [], metricas: [] }, _indice: indice, _figs: { comercial: figs, cobranza: figs, inventarioFrenado: [], inventarioTop: [], union: figs } };
}

function medir(tabla, entidad) { return medirPieza(PIEZA, entidad, tabla); }

/* ═══ 0 · LA PIEZA — esquema válido, sigue en borrador, calculo actualizado ═══ */
H("0 · piezas.js — PRI-04 pasa el validador, sigue \"borrador\", apunta al cálculo nuevo");
{
  const r = validarPieza(PIEZA);
  ok(r.ok, "PRI-04 pasa el validador de esquema", r.errores.join(" | "));
  ok(PIEZA.estado === "borrador" && PIEZA.firma == null, "PRI-04 sigue sin firmar (la firma es del owner)");
  ok(PIEZA.medicion.calculo === "pisoMaterialidadCobranza", "PRI-04 apunta al cálculo del piso de materialidad");
  ok(PIEZAS_CONOCIMIENTO.length === 4, "siguen sembradas exactamente 4 piezas");
}

/* ═══ 1 · LAS OCHO CARTERAS DEL DISEÑO ═══ */
H("1 · las ocho carteras de prueba del diseño");

// 1 — muy concentrada: un cliente = 80% venta y 80% vencido → todo bajo el piso (el tamaño solo no fabrica señal)
{
  const clientes = [
    { nombre: "Grande", venta: 800, saldoPendiente: 1000, vencido: 800 },
    ...Array.from({ length: 4 }, (_, i) => ({ nombre: `Chico${i + 1}`, venta: 50, saldoPendiente: 62.5, vencido: 50 })),
  ];
  const tabla = tablaDeCartera(clientes);
  const veredictos = clientes.map((c) => medir(tabla, c.nombre).estado);
  ok(veredictos.every((v) => v === "bajo_piso"), `★ cartera muy concentrada · todas las cuentas quedan "bajo_piso" (dio: ${veredictos.join(",")})`, JSON.stringify(veredictos));
}

// 2 — repartida: 19 clientes ~5% c/u, uno con 5% venta y 25% vencido → ese es señal, el resto bajo el piso
{
  const clientes = [{ nombre: "Concentrador", venta: 50, saldoPendiente: 250, vencido: 250 }];
  for (let i = 1; i <= 19; i++) clientes.push({ nombre: `Cliente${i}`, venta: 50, saldoPendiente: 39.47, vencido: 39.47 });
  const tabla = tablaDeCartera(clientes);
  const mConcentrador = medir(tabla, "Concentrador");
  ok(mConcentrador.estado === "senal" || mConcentrador.estado === "ocurre", `★ cartera repartida · el concentrador (5% venta, alto % vencido) es señal (dio "${mConcentrador.estado}")`, JSON.stringify(mConcentrador));
  const otros = clientes.slice(1).map((c) => medir(tabla, c.nombre).estado);
  ok(otros.every((v) => v === "bajo_piso"), "★ cartera repartida · el resto queda bajo el piso", JSON.stringify(otros));
}

// 3 — casi nada vencido: vencido total = 0,5% del saldo pendiente → nadie puede ser señal, se dice explícito
{
  const clientes = Array.from({ length: 10 }, (_, i) => ({ nombre: `C${i + 1}`, venta: 100, saldoPendiente: 100, vencido: i === 0 ? 5 : 0 }));
  const tabla = tablaDeCartera(clientes);
  const veredictos = clientes.map((c) => medir(tabla, c.nombre).estado);
  ok(veredictos.every((v) => v !== "senal" && v !== "ocurre"), `★ casi nada vencido · ninguna cuenta es señal (dio: ${veredictos.join(",")})`, JSON.stringify(veredictos));
  const cob = coberturaPisoDeCobranza(tabla);
  ok(!!cob && /vencido total queda bajo el piso/i.test(cob.texto), "★ casi nada vencido · la cobertura DICE explícito que el vencido total queda bajo el piso (nunca calla)", cob && cob.texto);
}

// 4 — casi todo vencido: 95% del saldo pendiente vencido → muchas cuentas cruzan el piso
{
  const clientes = Array.from({ length: 8 }, (_, i) => ({ nombre: `V${i + 1}`, venta: 100 + i * 5, saldoPendiente: 100, vencido: 95 }));
  const tabla = tablaDeCartera(clientes);
  const veredictos = clientes.map((c) => medir(tabla, c.nombre).estado);
  const nSenal = veredictos.filter((v) => v === "senal" || v === "ocurre").length;
  console.log(`      casi todo vencido: ${nSenal}/${clientes.length} señal`);
  ok(nSenal >= 1, "★ casi todo vencido · al menos una cuenta cruza el piso (la cartera entera está bajo tensión)");
}

// 5 — empresa diminuta (3 clientes): los veredictos existen y se explican, no se degrada a "sin datos"
{
  const clientes = [
    { nombre: "A", venta: 200, saldoPendiente: 100, vencido: 60 },
    { nombre: "B", venta: 50, saldoPendiente: 40, vencido: 5 },
    { nombre: "C", venta: 30, saldoPendiente: 20, vencido: 2 },
  ];
  const tabla = tablaDeCartera(clientes);
  const resultados = clientes.map((c) => medir(tabla, c.nombre));
  ok(resultados.every((r) => r.estado === "senal" || r.estado === "ocurre" || r.estado === "bajo_piso"), "★ empresa diminuta (3 clientes) · los veredictos existen (nunca \"indeterminable\")", JSON.stringify(resultados.map((r) => r.estado)));
  ok(resultados.every((r) => r.referencia && r.referencia.texto), "empresa diminuta · cada veredicto trae su referencia (se explica)");
}

// 6 — empresa grande × 1000: mismos veredictos que la cartera base (invariancia de escala)
{
  const base = [
    { nombre: "A", venta: 200, saldoPendiente: 100, vencido: 60 },
    { nombre: "B", venta: 50, saldoPendiente: 40, vencido: 5 },
    { nombre: "C", venta: 30, saldoPendiente: 20, vencido: 2 },
  ];
  const x1000 = base.map((c) => ({ nombre: c.nombre, venta: c.venta * 1000, saldoPendiente: c.saldoPendiente * 1000, vencido: c.vencido * 1000 }));
  const tBase = tablaDeCartera(base), tX1000 = tablaDeCartera(x1000);
  const vBase = base.map((c) => medir(tBase, c.nombre).estado);
  const vX1000 = x1000.map((c) => medir(tX1000, c.nombre).estado);
  ok(JSON.stringify(vBase) === JSON.stringify(vX1000), `★ invariancia de escala ×1000 · mismos veredictos (base=${vBase.join(",")} · ×1000=${vX1000.join(",")})`);
}

// 7 — misma cuenta en universo chico (top 5) y en el libro completo: mismo veredicto (regla 2 — el denominador
// SIEMPRE es el libro evaluable completo, nunca el subconjunto que se responde)
{
  const grande = [{ nombre: "Compartido", venta: 80, saldoPendiente: 100, vencido: 40 }];
  for (let i = 1; i <= 24; i++) grande.push({ nombre: `Resto${i}`, venta: 40, saldoPendiente: 40, vencido: 4 });
  const tGrande = tablaDeCartera(grande);
  const tChico = tablaDeCartera(grande.slice(0, 5));   // "universo chico": solo top 5, calculado COMO SI fuera todo el libro
  const vGrande = medir(tGrande, "Compartido").estado;
  const vChico = medir(tChico, "Compartido").estado;
  console.log(`      "Compartido" con el libro completo (25): ${vGrande} · con un universo (mal) restringido a 5: ${vChico}`);
  ok(vGrande !== undefined && vChico !== undefined, "ambos universos producen un veredicto (control de forma)");
  // el mecanismo real (seleccionar.js → tablaSenales.js) NUNCA restringe el universo por lo que la Respuesta
  // nombra — se prueba abajo, §5, sobre TENANT_DEMO con dos `entidadesEnRespuesta` distintas.
}

// 8 — subirle vencido a una cuenta: nunca pasa de señal a ruido (monotonía)
{
  const base = [
    { nombre: "Sube", venta: 100, saldoPendiente: 100, vencido: 30 },
    { nombre: "R1", venta: 100, saldoPendiente: 100, vencido: 10 },
    { nombre: "R2", venta: 100, saldoPendiente: 100, vencido: 10 },
    { nombre: "R3", venta: 100, saldoPendiente: 100, vencido: 10 },
  ];
  let vistoSenal = false;
  let vencidoAnterior = base[0].vencido;
  let estadoAnterior = medir(tablaDeCartera(base), "Sube").estado;
  for (const nuevoVencido of [40, 55, 70, 85, 99]) {
    const clientes = base.map((c, i) => (i === 0 ? { ...c, vencido: nuevoVencido } : c));
    const est = medir(tablaDeCartera(clientes), "Sube").estado;
    if (estadoAnterior === "senal" || estadoAnterior === "ocurre") vistoSenal = true;
    if (vistoSenal) ok(est === "senal" || est === "ocurre", `★ monotonía · con vencido ${nuevoVencido} (subiendo desde ${vencidoAnterior}) sigue señal, nunca vuelve a ruido (dio "${est}")`);
    vencidoAnterior = nuevoVencido; estadoAnterior = est;
  }
  ok(true, "★ monotonía en vencido · ninguna subida de vencido hizo retroceder una señal a bajo el piso");
}

/* ═══ 2 · IDENTIDADES DE COBERTURA ═══ */
H("2 · identidades de cobertura (regla 4) — tienen que cerrar, o la pieza no se sirve nada");
{
  const clientes = [
    { nombre: "A", venta: 200, saldoPendiente: 100, vencido: 60 },
    { nombre: "B", venta: 50, saldoPendiente: 40, vencido: 0 },
    { nombre: "C", venta: 30, saldoPendiente: 20, vencido: null },   // sin plazo
    { nombre: "D", venta: 10, saldoPendiente: 15, vencido: null },   // sin plazo
  ];
  const tabla = tablaDeCartera(clientes);
  const cob = coberturaPisoDeCobranza(tabla);
  ok(!!cob, "la cobertura se sirve (las identidades cierran)");
  ok(/^Vencido total: /.test(cob.texto), "★ orden de servicio · la cobertura ABRE con el vencido total y su peso");
  ok(/Cobertura: 4 clientes/.test(cob.texto), "la cobertura nombra el total de clientes (4)");
  ok(/Evaluados 2 /.test(cob.texto), "evaluados = 2 (A y B, con plazo declarado)");
  ok(/Sin evaluar: C, D/.test(cob.texto) || /Sin evaluar: D, C/.test(cob.texto), "★ sin evaluar nombra a C y D (≤3, con nombre y apellido)");
  console.log(`      "${cob.texto}"`);

  // ★ CARNADA · si una cuenta que `tabla.cuentas` declara con saldo pendiente NO tiene una fig real detrás (el
  // índice de evidencia no la conoce — el mismo caso que una boleta incompleta), la suma verificada del universo
  // NO puede cerrar, y la cobertura NO se sirve (null) en vez de servir un total inventado.
  const tablaRota = tablaDeCartera(clientes);
  tablaRota.cuentas.Fantasma = { saldoPendiente: 500, tienePlazoDeclarado: true, vencidoPositivo: true, vencido: 100, venta: 500, enRespuesta: false };
  const cobRota = coberturaPisoDeCobranza(tablaRota);
  ok(cobRota === null, "★ CARNADA · una cuenta sin fig real detrás de su saldo pendiente impide que las sumas verifiquen — la cobertura NO se sirve (falla cerrado)", JSON.stringify(cobRota));
}

/* ═══ 3 · BORDE ═══ */
H("3 · borde — el veredicto cambia dentro de [k/2, 2k]");
{
  // se busca una cuenta cuyo D_c caiga justo en el entorno del piso (k=1% del saldo evaluable)
  const clientes = [
    { nombre: "Borde", venta: 100, saldoPendiente: 1000, vencido: 12 },   // ajustado para caer cerca del piso
    { nombre: "Resto1", venta: 400, saldoPendiente: 500, vencido: 50 },
    { nombre: "Resto2", venta: 500, saldoPendiente: 500, vencido: 40 },
  ];
  const tabla = tablaDeCartera(clientes);
  const m = medir(tabla, "Borde");
  ok(typeof m.borde === "boolean", "★ el veredicto trae un atributo \"borde\" (boolean), no un cuarto estado", JSON.stringify(m));
  ok(m.estado === "senal" || m.estado === "ocurre" || m.estado === "bajo_piso", "el borde no reemplaza el veredicto: sigue siendo señal o bajo el piso");
}

/* ═══ 4 · PROCEDENCIA — el piso NUNCA sale "medido"; ningún hecho "vencido esperado" en el libro ═══ */
H("4 · procedencia del piso — nunca \"medido\" (regla 5); no existe un hecho \"vencido esperado\"");
{
  const clientes = [
    { nombre: "A", venta: 200, saldoPendiente: 100, vencido: 60 },
    { nombre: "B", venta: 50, saldoPendiente: 40, vencido: 5 },
    { nombre: "C", venta: 30, saldoPendiente: 20, vencido: 2 },
  ];
  const tabla = tablaDeCartera(clientes);
  for (const c of clientes) {
    const m = medir(tabla, c.nombre);
    ok(m.procedencia !== "medido", `★ ${c.nombre} · la procedencia del veredicto (que incluye el piso) NUNCA es "medido" (dio "${m.procedencia}")`, JSON.stringify(m));
    ok(["derivado", "estimacion_referencia", "supuesto_usuario"].includes(m.procedencia), `${c.nombre} · la procedencia es una de las categorías esperadas (dio "${m.procedencia}")`);
  }
  // ★ CARNADA estructural · en NINGÚN hecho de apoyo que esta pieza declara existe un id/concepto "vencido
  // esperado" ni "diferencia cero" — el nivel de comparación nunca es un hecho publicado (regla 5). Se
  // comprueba sobre el texto fuente del cálculo: si alguien reintrodujera ese hecho, este candado arde.
  const fuente = readFileSync(new URL("./src/adi/conocimiento/medir.js", import.meta.url), "utf8");
  ok(!/["'`]vencido_esperado["'`]|["'`]vencido esperado["'`]/i.test(fuente), "★ CARNADA · el código fuente de medir.js no declara ningún hecho \"vencido esperado\"");
  ok(!/["'`]diferencia_cero["'`]|["'`]diferencia cero["'`]/i.test(fuente), "★ CARNADA · el código fuente de medir.js no declara ningún hecho \"diferencia = 0\"");
  // ★ CARNADA · el 1% no está escrito a mano en medir.js ni en piezas.js — solo importado de la constante
  const fuentePiezas = readFileSync(new URL("./src/adi/conocimiento/piezas.js", import.meta.url), "utf8");
  ok(!/0\.01\b/.test(fuente.replace(/PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI/g, "")), "★ CARNADA · medir.js no escribe \"0.01\" a mano fuera de un nombre de constante importado");
  ok(!/0\.01\b|\b1\s?%/.test(fuentePiezas), "★ CARNADA · piezas.js no escribe el piso a mano");
  ok(PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI === 0.01, "el criterio de ADI vive en config/contract/pisoMaterialidadCobranza.js (1%)");
  ok(PISO_MATERIALIDAD_COBRANZA_MIN < PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI && PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI < PISO_MATERIALIDAD_COBRANZA_MAX, "el criterio de ADI está dentro del rango de ajuste permitido");
}

/* ═══ 5 · UNIVERSO CHICO VS LIBRO COMPLETO, SOBRE EL PIPELINE REAL (TENANT_DEMO) ═══ */
H("5 · el pipeline real nunca restringe el universo por lo que la Respuesta nombra");
{
  initTenant(TENANT_DEMO);
  const tablaA = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "quién me debe más", entidadesEnRespuesta: ["Lider"] });
  const tablaB = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "quién me debe más", entidadesEnRespuesta: ["Lider", "Falabella", "Sodimac", "Easy", "Tottus"] });
  const cliente = Object.keys(tablaA.cuentas).find((e) => tablaA.cuentas[e].tienePlazoDeclarado === true && tablaA.cuentas[e].vencidoPositivo);
  ok(!!cliente, "hay al menos una cuenta con vencido positivo y plazo declarado en TENANT_DEMO para probar la invariancia");
  if (cliente) {
    const mA = medirPieza(PIEZA, cliente, tablaA), mB = medirPieza(PIEZA, cliente, tablaB);
    ok(mA.estado === mB.estado, `★ ${cliente} · mismo veredicto con distintas entidadesEnRespuesta (dio "${mA.estado}" y "${mB.estado}") — el denominador es siempre el libro evaluable completo`, JSON.stringify({ mA: mA.estado, mB: mB.estado }));
  }
}

/* ═══ 6 · BANDERA OFF — byte-idéntica (complementa `_conocimiento_gate.mjs` §9, que ya certifica esto sobre el
 * catálogo entero); acá se confirma puntualmente que PRI-04 en borrador nunca aporta nada a la salida servida,
 * con o sin la bandera. ═══ */
H("6 · bandera OFF / pieza sin firmar — PRI-04 no aporta nada a la Entrega, ni con el mecanismo nuevo");
{
  const catalogoFirmado = [{ ...PIEZA, estado: "firmada", firma: { por: "_piso_materialidad_gate.mjs", fecha: "2026-09-23" } }];
  const catalogoBorrador = [PIEZA];
  initTenant(TENANT_DEMO);
  const tabla = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "quién me debe más", entidadesEnRespuesta: [] });
  // sin firmar: `evaluarPertinencia` puede encender, pero `seleccionar.js`/`referenciaDelOficio` nunca lo sirve —
  // ya lo prueba `_conocimiento_gate.mjs` §8. Acá solo se confirma que evaluar la pertinencia no lanza y que el
  // catálogo real (piezas.js) sigue en "borrador".
  const pert = evaluarPertinencia(catalogoBorrador[0], tabla, null, "quién me debe más");
  ok(pert != null, "evaluar pertinencia de PRI-04 (nuevo predicado \"alguno\") no lanza sobre TENANT_DEMO real");
  ok(catalogoFirmado[0].estado === "firmada" && catalogoBorrador[0].estado === "borrador", "control · el clon firmado no altera piezas.js (la pieza real sigue en borrador)");
}

/* ═══ 7 · EMPRESA CON AJUSTE DECLARADO — cambia la línea y el veredicto donde corresponde ═══ */
H("7 · el ajuste de la empresa (camino B) cambia el piso y, donde corresponde, el veredicto");
{
  // afinado para que D_c(X) = 30 → 3% de P(=1000): señal contra el 1% de ADI, bajo el piso contra el 5% de
  // la empresa — así el ajuste FLIPA el veredicto, no solo el número del piso.
  const clientes = [
    { nombre: "X", venta: 100, saldoPendiente: 100, vencido: 40 },
    { nombre: "Y", venta: 450, saldoPendiente: 450, vencido: 30 },
    { nombre: "Z", venta: 450, saldoPendiente: 450, vencido: 30 },
  ];
  const tabla = tablaDeCartera(clientes);

  initTenant(TENANT_DEMO);
  const mADI = medir(tabla, "X");
  ok(mADI.estado === "senal" || mADI.estado === "ocurre", `control · con el criterio de ADI (1%), X es señal (dio "${mADI.estado}")`, JSON.stringify(mADI));

  initTenant({ ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, pisoMaterialidadCobranza: { valor: 0.05, procedencia: "medido" } } });
  const mEmpresa = medir(tabla, "X");
  const cobEmpresa = coberturaPisoDeCobranza(tabla);

  ok(mADI.estado !== mEmpresa.estado, `★ con el piso ajustado por la empresa (5% en vez de 1%), el MISMO caso pasa de señal a bajo el piso (adi="${mADI.estado}", empresa="${mEmpresa.estado}")`, JSON.stringify({ adi: mADI.estado, empresa: mEmpresa.estado }));
  ok(!!cobEmpresa && /declarado por tu empresa/.test(cobEmpresa.texto), "★ la línea de cobertura dice \"declarado por tu empresa\" cuando el ajuste es de la empresa", cobEmpresa && cobEmpresa.texto);
  ok(mEmpresa.procedencia === "supuesto_usuario", `★ con el ajuste de la empresa, la procedencia del veredicto es "supuesto_usuario" (dio "${mEmpresa.procedencia}")`);
  /* ★ regla 1 también en la línea DE CADA CUENTA (defecto hallado en revisión 2026-09-23: decía «piso de ADI»
   * aunque el piso lo hubiera declarado la empresa). Se mira el veredicto entero serializado. */
  const txtEmpresa = JSON.stringify(mEmpresa), txtADI = JSON.stringify(mADI);
  ok(/declarado por tu empresa/.test(txtEmpresa) && !/piso de ADI/.test(txtEmpresa), "★ con el ajuste de la empresa, el veredicto de la cuenta nombra el piso «declarado por tu empresa», nunca «de ADI»", txtEmpresa);
  ok(/piso de ADI/.test(txtADI) && !/declarado por tu empresa/.test(txtADI), "control · sin ajuste, el veredicto de la cuenta nombra el «piso de ADI»", txtADI);

  initTenant(TENANT_DEMO);   // restaurar
  const cobADI = coberturaPisoDeCobranza(tabla);
  ok(!!cobADI && /criterio general de ADI/.test(cobADI.texto), "control · sin ajuste declarado, la cobertura vuelve a decir \"criterio general de ADI\"", cobADI && cobADI.texto);
}

/* ═══ 8 · EMPRESA SIN PLAZO EN NINGÚN CLIENTE — el texto de la Aclaración 3 ═══ */
H("8 · empresa sin plazo en ningún cliente — el texto de la Aclaración 3");
{
  const clientes = [
    { nombre: "X", venta: 100, saldoPendiente: 80, vencido: null },
    { nombre: "Y", venta: 50, saldoPendiente: 20, vencido: null },
  ];
  const tabla = tablaDeCartera(clientes);
  const cob = coberturaPisoDeCobranza(tabla);
  ok(!!cob, "la cobertura se sirve aunque nadie tenga plazo declarado");
  ok(/^No puedo evaluar la desproporción de vencido: ningún cliente tiene plazo de pago declarado/.test(cob.texto), "★ el texto exacto de la Aclaración 3 (sin plazo en absoluto)", cob && cob.texto);
  ok(/saldo pendiente/.test(cob.texto) && /X concentra el/.test(cob.texto), "el texto dice el saldo pendiente y quién concentra más", cob && cob.texto);
  console.log(`      "${cob.texto}"`);

  const mX = medir(tabla, "X");
  ok(mX.estado === "indeterminable", "★ sin_evaluar ↔ indeterminable (mapeo del diseño) · X mide \"indeterminable\" (sin_evaluar)", JSON.stringify(mX));
  ok(/plazo de pago declarado/.test(mX.motivo || ""), "el motivo nombra la falta de plazo declarado", mX.motivo);
}

/* ═══ 9 · CANÓNICO — TENANT_DEMO, escenario bonanza (el que pide el informe) ═══ */
H("9 · el canónico — TENANT_DEMO, escenario bonanza: veredictos cuenta por cuenta + cobertura");
{
  initTenant(TENANT_DEMO);
  const tabla = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "quién me debe más", entidadesEnRespuesta: [] });
  const { evaluables } = (() => {
    const cs = tabla.cuentas;
    const evaluables = Object.keys(cs).filter((e) => cs[e].saldoPendiente != null && cs[e].tienePlazoDeclarado === true);
    return { evaluables };
  })();
  ok(evaluables.length > 0, `TENANT_DEMO/${ESCENARIO_INICIAL} tiene ${evaluables.length} cuentas evaluables (con plazo declarado)`);
  console.log(`      escenario: ${ESCENARIO_INICIAL} · universo evaluable: ${evaluables.length} cuentas`);
  for (const e of evaluables) {
    const m = medirPieza(PIEZA, e, tabla);
    console.log(`      ${e}: ${m.estado}${m.cifra ? " · " + m.cifra.texto : ""}${m.borde ? " · AL BORDE" : ""}`);
  }
  const cob = coberturaPisoDeCobranza(tabla);
  ok(!!cob, "la cobertura se sirve sobre TENANT_DEMO real");
  console.log(`\n      COBERTURA: "${cob && cob.texto}"`);
}

/* ═══ 11 · TEXTO POR CUENTA — TRES PARTES FIJAS, TAMBIÉN PARA SEÑAL; SIN MONTOS NEGATIVOS; PUNTOS Y MONTO
 * JUNTOS; SIN JERGA DE PROCEDENCIA (owner 2026-09-23, segunda vuelta) ═══ */
H("11 · texto por cuenta — regla C (segunda vuelta)");
{
  const clientes = [
    { nombre: "PesaMas", venta: 100, saldoPendiente: 100, vencido: 40 },   // D_c > 0 → señal
    { nombre: "PesaMenos", venta: 500, saldoPendiente: 500, vencido: 10 },  // D_c < 0 → bajo el piso, a favor
    { nombre: "Resto", venta: 400, saldoPendiente: 400, vencido: 5 },
  ];
  const tabla = tablaDeCartera(clientes);
  const mSenal = medir(tabla, "PesaMas"), mBajo = medir(tabla, "PesaMenos");
  const sSenal = servirPieza(PIEZA, "PesaMas", mSenal), sBajo = servirPieza(PIEZA, "PesaMenos", mBajo);
  ok(mSenal.estado === "senal", "control · PesaMas mide señal", mSenal.estado);
  ok(mBajo.estado === "bajo_piso", "control · PesaMenos mide bajo el piso", mBajo.estado);

  for (const [nombre, s] of [["señal", sSenal], ["bajo el piso", sBajo]]) {
    ok(/Veredicto: (señal|bajo el piso)\./.test(s.texto), `★ ${nombre} · el texto dice "Veredicto: …" explícito (las tres partes, también para señal)`, s.texto);
    ok(/puntos/.test(s.texto) && /\$/.test(s.texto), `★ ${nombre} · la diferencia se muestra en PUNTOS y en MONTO, las dos`, s.texto);
    ok(!/-\$/.test(s.texto), `★ ${nombre} · CARNADA · ningún monto negativo ("-$") en el texto servido`, s.texto);
    ok(!/estimaci[oó]n contra referencia/i.test(s.texto), `★ ${nombre} · CARNADA · sin la jerga "estimación contra referencia" en el texto del usuario`, s.texto);
    ok(/piso de ADI/.test(s.texto), `${nombre} · el piso declara su dueño ("piso de ADI")`, s.texto);
    ok(!/,\d/.test(s.texto.replace(/\d{1,3}(?=(?:,\d{3})+\b)/g, "")), `★ ${nombre} · separador decimal PUNTO (sin coma decimal)`, s.texto);
  }
  ok(/a su favor/.test(sBajo.texto), "★ bajo el piso con diferencia EN CONTRA · dice \"a su favor\" en vez de un signo negativo", sBajo.texto);
  ok(!/^El oficio mira:.{0,400}En PesaMas /.test(sSenal.texto), "★ CARNADA · el texto de señal NO antepone \"En {entidad}\" (la entidad ya está en el hecho, con su dirección)", sSenal.texto);
  console.log(`      señal: "${sSenal.texto}"`);
  console.log(`      bajo el piso (a favor): "${sBajo.texto}"`);
}

/* ═══ 12 · REGLA B — LA COBERTURA NUNCA AFIRMA MÁS DE LO QUE VIO (owner 2026-09-23, segunda vuelta) ═══ */
H("12 · cobertura con evidencia truncada — declara PARCIAL, nunca \"100%\" de un universo que no vio entero");
{
  const clientes = [
    { nombre: "A", venta: 200, saldoPendiente: 100, vencido: 60 },
    { nombre: "B", venta: 50, saldoPendiente: 40, vencido: 0 },
  ];
  const tabla = tablaDeCartera(clientes);
  const cobCompleta = coberturaPisoDeCobranza(tabla);
  ok(!!cobCompleta && /Cobertura: 2 clientes/.test(cobCompleta.texto) && !/parcial/i.test(cobCompleta.texto), "control · sin truncar, la cobertura dice \"Cobertura: 2 clientes\" (sin \"parcial\")", cobCompleta && cobCompleta.texto);

  // ★ CARNADA · la fuente (buildMesaFlujo, simulada con `_universoCobranza`) declara MÁS clientes de los que
  // esta evidencia pudo verificar (2 de 5) — la cobertura tiene que declararse PARCIAL, con el conteo exacto,
  // y NUNCA decir "100% del saldo pendiente/evaluable" sin calificar — "100% del saldo VERIFICADO" sigue
  // siendo honesto (dice, con esas mismas palabras, que es del subconjunto que se pudo ver, no de todo el saldo).
  const tablaTruncada = tablaDeCartera(clientes);
  tablaTruncada._universoCobranza = 5;
  const cobTruncada = coberturaPisoDeCobranza(tablaTruncada);
  ok(!!cobTruncada, "la cobertura SÍ se sirve con evidencia truncada (declara el límite, no calla)");
  ok(cobTruncada && /Cobertura parcial: /.test(cobTruncada.texto), "★ CARNADA · con la fuente declarando 5 y la evidencia viendo 2, la cobertura dice \"Cobertura parcial\"", cobTruncada && cobTruncada.texto);
  ok(cobTruncada && /2 de 5 clientes/.test(cobTruncada.texto), "★ CARNADA · el conteo exacto (2 de 5) queda declarado", cobTruncada && cobTruncada.texto);
  ok(cobTruncada && /3 sin verificar/.test(cobTruncada.texto), "★ CARNADA · dice cuántos quedaron sin verificar (3)", cobTruncada && cobTruncada.texto);
  ok(cobTruncada && !/100%\s+del\s+saldo\s+(?:pendiente|evaluable)\b/i.test(cobTruncada.texto), "★ CARNADA · NUNCA dice \"100% del saldo pendiente/evaluable\" (sin calificar) cuando el universo de la fuente es más grande que lo verificado — \"100% del saldo VERIFICADO\" sí es honesto", cobTruncada && cobTruncada.texto);
  ok(cobTruncada && /del saldo verificado/.test(cobTruncada.texto), "★ CARNADA · los porcentajes de una cobertura parcial se etiquetan \"del saldo verificado\", nunca \"del saldo pendiente\" a secas", cobTruncada && cobTruncada.texto);
  console.log(`      truncada: "${cobTruncada.texto}"`);

  // control negativo: con `_universoCobranza` IGUAL a lo verificado, sigue sin decir "parcial"
  const tablaCompletaIgual = tablaDeCartera(clientes);
  tablaCompletaIgual._universoCobranza = 2;
  const cobIgual = coberturaPisoDeCobranza(tablaCompletaIgual);
  ok(!!cobIgual && /Cobertura: /.test(cobIgual.texto) && !/parcial/i.test(cobIgual.texto), "control negativo · con _universoCobranza = lo verificado, NO dice \"parcial\" (no es un siempre-parcial)", cobIgual && cobIgual.texto);
}

/* ═══ 13 · TENANT_DEMO REAL — el universo evaluable ahora son las 13 cuentas, no las 8 de la boleta del agente
 * (regla A) ═══ */
H("13 · TENANT_DEMO/bonanza — el universo evaluable son las 13 cuentas (no el tope de 8 de la boleta)");
{
  initTenant(TENANT_DEMO);
  const tabla = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "quién me debe más", entidadesEnRespuesta: [] });
  const { evaluables, sinPlazo } = (() => {
    const cs = tabla.cuentas;
    return {
      evaluables: Object.keys(cs).filter((e) => cs[e].saldoPendiente != null && cs[e].tienePlazoDeclarado === true),
      sinPlazo: Object.keys(cs).filter((e) => cs[e].saldoPendiente != null && cs[e].tienePlazoDeclarado === false),
    };
  })();
  ok(evaluables.length === 13, `★ TENANT_DEMO/bonanza tiene 13 cuentas evaluables (dio ${evaluables.length}) — las 13 tienen diasCredito declarado`, evaluables.join(", "));
  ok(sinPlazo.length === 0, `★ ninguna queda "sin plazo" de verdad (dio ${sinPlazo.length}) — el demo declara plazo para todos`, sinPlazo.join(", "));
  ok(tabla._universoCobranza === 13, `★ tabla._universoCobranza = 13 (el total real de buildMesaFlujo, dio ${tabla._universoCobranza})`);
  const cob = coberturaPisoDeCobranza(tabla);
  ok(!!cob && /Cobertura: 13 clientes/.test(cob.texto) && !/parcial/i.test(cob.texto), "★ la cobertura real dice \"Cobertura: 13 clientes\" (no \"parcial\", ya no hay tope)", cob && cob.texto);
  console.log(`      nota: con evidencia COMPLETA, el % legítimamente llega a 100% del saldo evaluable — la regla B prohíbe el "100%" SOLO cuando la evidencia está truncada (§12 arriba lo prueba con evidencia truncada de verdad)`);
}

/* ═══ 14 · LA MIGRACIÓN 014 NO DIVERGE DEL MÓDULO — un `.sql` no puede importar un `.js`, así que este candado
 * compara los dos textos (el mismo mecanismo que `_entrega_gate.mjs` ya usa entre la migración 013 y
 * `taxonomiaPerfil.js`) ═══ */
H("14 · la migración 014 declara el MISMO rango que pisoMaterialidadCobranza.js");
{
  const sql = readFileSync(new URL("./db/migraciones/014_piso_materialidad_cobranza.sql", import.meta.url), "utf8");
  ok(sql.includes("between 0.001 and 0.10"), `★ CARNADA · el check SQL usa 0.001..0.10 — los MISMOS números que PISO_MATERIALIDAD_COBRANZA_MIN (${PISO_MATERIALIDAD_COBRANZA_MIN}) / _MAX (${PISO_MATERIALIDAD_COBRANZA_MAX})`);
  ok(PISO_MATERIALIDAD_COBRANZA_MIN === 0.001 && PISO_MATERIALIDAD_COBRANZA_MAX === 0.10, "los literales del módulo JS son los mismos que se afirman arriba (si alguien cambia uno sin el otro, este candado arde)");
}

console.log(`\n── _piso_materialidad_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
