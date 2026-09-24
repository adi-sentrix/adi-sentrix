/* === _cau01_carga_resto_gate.mjs · CAU-01 — LA CARGA COMERCIAL DE LA CUENTA CONTRA EL RESTO DE LA CARTERA
 * (owner 2026-09-23, diseño aprobado) ═══════════════════════════════════════════════════════════════════════════
 * Prueba las reglas aprobadas (ver el encargo textual y `medir.js:cargaCuentaVsResto`):
 *   1 · «el resto de la cartera» = TASA REAL PONDERADA (carga $ del resto ÷ venta $ del resto) sobre las OTRAS
 *       cuentas de la cartera COMPLETA — nunca el promedio simple de porcentajes, nunca solo las bajo benchmark.
 *   2 · piso = pisoFocosUSD() — el MISMO piso del detector del Core (nunca recalculado aparte).
 *   3 · señal ⟺ exceso = (carga_propia − tasa_resto) × venta_propia ≥ piso; "bajo_piso" nunca "no_ocurre";
 *       "no hay exceso que comparar" cuando la cuenta carga menos o igual (nunca "queda bajo el piso… a favor").
 *   4 · si el resto no verifica completo (venta o carga de alguna cuenta), la pieza mide "indeterminable" —
 *       nunca un resto parcial vendido como completo.
 *   5 · el nivel de comparación (el piso) nunca es un hecho publicado con nombre propio; su procedencia nunca
 *       es "medido".
 *
 * Carteras de prueba INLINE (nunca fixtures de archivo, nunca TENANT_DEMO) — cada una es una tabla de señales
 * sintética, con figs mínimas y directas, sobre `notario/hechos.js`/`notario/evidencia.js` reales: el MISMO
 * motor de verificación que ya certifican `_hechos_gate.mjs`/`_conocimiento_gate.mjs`/`_piso_materialidad_gate.mjs`.
 * Sin red: cifras y comparaciones puramente locales. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _cau01_carga_resto_gate.mjs`). */
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";
import { medirPieza, coberturaCargaVsResto, resultadosCargaVsResto, resultadosPisoDeCobranza, coberturaPisoDeCobranza } from "./src/adi/conocimiento/medir.js";
import { servirPieza, servirBloqueCargaVsResto, servirBloquePisoDeCobranza } from "./src/adi/conocimiento/servir.js";
import { piezaPorId, PIEZAS_CONOCIMIENTO } from "./src/adi/conocimiento/piezas.js";
import { validarPieza, ID_PIEZA_RE } from "./src/adi/conocimiento/validarPieza.js";
import { pisoFocosUSD } from "./src/adi/specRetrieval.js";
import { POLICY, materialidadFocoEsDelNegocio } from "./src/config/businessPolicy.js";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const PIEZA = piezaPorId("CAU-01");

/* ── LA CARTERA SINTÉTICA — figs "<cuenta> · Venta" / "<cuenta> · Carga comercial", formato exacto al que usa
 * `descomposicionDeBrecha` de verdad, para que `notario/evidencia.js` case cada fig por el mismo camino que ya
 * certifica el resto de la suite. `clientes: [{nombre, venta, carga}]` — `carga: null/undefined` omite la fig
 * (cuenta "sin carga declarada", para la carnada de verificación incompleta del resto). Todas nacen
 * `bajoBenchmark:true` (la pertinencia de CAU-01 no es lo que este gate prueba — ya la prueba
 * `_conocimiento_gate.mjs` §3 — acá se mide directo con `medirPieza`, sin pasar por pertinencia). */
let _fid = 0;
function _fig(entidad, concepto, raw, unit) {
  _fid += 1;
  return { id: `cr${_fid}`, label: `${entidad} · ${concepto}`, raw, unit, value: unit === "pct" ? `${raw}%` : formatoDeLaCasa(raw, "money"), tipo: { verificabilidad: "literal" } };
}
function tablaDeCartera(clientes) {
  const figs = [];
  const cuentas = {};
  for (const c of clientes) {
    figs.push(_fig(c.nombre, "Venta", c.venta, "money"));
    if (c.carga != null) figs.push(_fig(c.nombre, "Carga comercial", c.carga, "pct"));
    cuentas[c.nombre] = {
      bajoBenchmark: true, cargaAlta: null, cargaPct: c.carga != null ? c.carga : null, venta: c.venta,
      vencidoPositivo: null, alDia: null, vencido: null, variacionVenta: "sin_serie",
      enRespuesta: false, prioridadPrimera: false,
    };
  }
  const ejesDelTenant = { cliente: clientes.map((c) => c.nombre) };
  const indice = indiceDeEvidencia({ figs, datoProyectado: null, ejesDelTenant });
  return { cuentas, skus: {}, periodo: { abierto: false }, pregunta: { temas: [], metricas: [] }, _indice: indice, _figs: { comercial: figs, cobranza: [], inventarioFrenado: [], inventarioTop: [], union: figs } };
}
function medir(tabla, entidad) { return medirPieza(PIEZA, entidad, tabla); }

/* ═══ 0 · LA PIEZA — esquema válido, sigue en borrador, apunta al cálculo nuevo ═══ */
H("0 · piezas.js — CAU-01 pasa el validador, sigue \"borrador\", apunta al cálculo cargaCuentaVsResto");
{
  const r = validarPieza(PIEZA);
  ok(r.ok, "CAU-01 pasa el validador de esquema", r.errores.join(" | "));
  ok(PIEZA.estado === "firmada" && !!PIEZA.firma && /owner/.test(PIEZA.firma.por), "CAU-01 está firmada por el owner (2026-09-24, «Firmo la pieza 2»)");
  ok(PIEZA.medicion.calculo === "cargaCuentaVsResto", "CAU-01 apunta al cálculo de la carga contra el resto de la cartera");
  ok(PIEZAS_CONOCIMIENTO.length === 4, "siguen sembradas exactamente 4 piezas");
}

/* ═══ 1 · CARTERA CONCENTRADA — 80% de la venta con la MISMA carga que el resto → bajo el piso ═══ */
H("1 · cuenta que es 80% de la venta, misma carga que el resto → bajo el piso (el tamaño solo no fabrica exceso)");
{
  const clientes = [
    { nombre: "Grande", venta: 800, carga: 5 },
    ...Array.from({ length: 4 }, (_, i) => ({ nombre: `Chico${i + 1}`, venta: 50, carga: 5 })),
  ];
  const tabla = tablaDeCartera(clientes);
  const veredictos = clientes.map((c) => medir(tabla, c.nombre).estado);
  ok(veredictos.every((v) => v === "bajo_piso"), `★ cartera concentrada (80% venta, misma carga) · todas las cuentas quedan "bajo_piso" (dio: ${veredictos.join(",")})`, JSON.stringify(veredictos));
  const mGrande = medir(tabla, "Grande");
  ok(/No hay exceso que comparar/.test(mGrande.referencia.texto), "★ Grande (80% de la venta, misma carga) · \"no hay exceso que comparar\", nunca un exceso fabricado por el tamaño", mGrande.referencia.texto);
}

/* ═══ 2 · CUENTA CHICA CON CARGA ALTA — separa la tasa PONDERADA del promedio SIMPLE ═══
 * Una cuenta de 1% de la venta con carga 20% (10x el resto) casi no mueve la tasa ponderada de las cuentas
 * grandes: ponderada ≈ 2.2%, simple ≈ 4.0% — números elegidos para que la diferencia sobreviva el redondeo de
 * `formatoDeLaCasa` (1 decimal) y la carnada muerda si alguien vuelve a un promedio simple. */
H("2 · cuenta chica (1% de la venta) con carga alta · casi no mueve a las grandes (ponderada, no promedio simple)");
{
  // escala ×3000 sobre la venta (la carga % no escala — ya probado en §6): sin escala, el exceso en $ de
  // cualquier cartera de juguete queda muy por debajo del piso absoluto de ADI (fijado sobre la venta REAL del
  // negocio, ~$100M en el demo) — con la escala, la Chica sí cruza el piso y el control de abajo es real.
  const clientes = [
    ...Array.from({ length: 9 }, (_, i) => ({ nombre: `G${i + 1}`, venta: 1100 * 3000, carga: 2 })),
    { nombre: "Chica", venta: 100 * 3000, carga: 20 },
  ];
  const tabla = tablaDeCartera(clientes);
  const mG1 = medir(tabla, "G1");
  const tasaRestoTxt = mG1.cifra.texto.match(/propio y ([\d.]+)% del resto/);
  ok(!!tasaRestoTxt, "el texto de G1 nombra la tasa del resto de la cartera", mG1.cifra.texto);
  if (tasaRestoTxt) {
    const tasaResto = parseFloat(tasaRestoTxt[1]);
    console.log(`      tasa del resto (ponderada, para G1): ${tasaResto}% — promedio simple habría sido 4.0%`);
    ok(Math.abs(tasaResto - 2.2) < 0.15, `★ CARNADA · la tasa del resto es ponderada (≈2.2%, dio ${tasaResto}%), NO el promedio simple de porcentajes (que habría dado 4.0%)`, mG1.cifra.texto);
    ok(Math.abs(tasaResto - 4.0) > 1, "★ CARNADA · la tasa del resto está lejos del promedio simple (4.0%) — separación clara", String(tasaResto));
  }
  // control · la chica, comparada contra las 9 grandes (2% cada una), sí mide una carga muy por encima del resto
  const mChica = medir(tabla, "Chica");
  ok(mChica.estado === "senal", `control · la Chica (20% de carga contra ~2% del resto) sí es señal (dio "${mChica.estado}")`, JSON.stringify(mChica));
}

/* ═══ 3 · TODAS IGUALES → todas bajo el piso ═══ */
H("3 · cartera con la misma carga en todas las cuentas → todas bajo el piso");
{
  const clientes = Array.from({ length: 6 }, (_, i) => ({ nombre: `T${i + 1}`, venta: 100 + i * 7, carga: 4 }));
  const tabla = tablaDeCartera(clientes);
  const veredictos = clientes.map((c) => medir(tabla, c.nombre).estado);
  ok(veredictos.every((v) => v === "bajo_piso"), `★ todas iguales · todas las cuentas quedan "bajo_piso" (dio: ${veredictos.join(",")})`, JSON.stringify(veredictos));
}

/* ═══ 4 · CUENTA SIN CARGA DECLARADA EN EL RESTO — el resto no verifica completo, se dice explícito ═══ */
H("4 · una cuenta del resto sin carga declarada → \"sin_evaluar\" (indeterminable), y el resto lo dice");
{
  const clientes = [
    { nombre: "Sujeto", venta: 100, carga: 6 },
    { nombre: "SinCarga", venta: 50, carga: null },   // venta declarada, SIN carga — el resto no verifica completo
    { nombre: "Otra", venta: 80, carga: 3 },
  ];
  const tabla = tablaDeCartera(clientes);
  const m = medir(tabla, "Sujeto");
  ok(m.estado === "indeterminable", `★ CARNADA · con una cuenta del resto sin carga declarada, la pieza mide "indeterminable" (dio "${m.estado}")`, JSON.stringify(m));
  ok(/resto de la cartera no se pudo verificar completo/.test(m.motivo || ""), "★ CARNADA · el motivo dice explícito que el resto no se pudo verificar completo", m.motivo);
  ok(/SinCarga/.test(m.motivo || ""), "★ CARNADA · el motivo NOMBRA la cuenta sin verificar (SinCarga), nunca un resto parcial vendido como completo", m.motivo);
  // control negativo: la cuenta AFECTADA sin carga, medida sobre sí misma, también indeterminable (no tiene su propia carga)
  const mSinCarga = medir(tabla, "SinCarga");
  ok(mSinCarga.estado === "indeterminable", "control · la cuenta sin carga declarada, medida sobre sí misma, también es \"indeterminable\"", mSinCarga.estado);
}

/* ═══ 5 · CARTERA DE UNA SOLA CUENTA → sin_evaluar (no hay resto con qué comparar) ═══ */
H("5 · cartera de una sola cuenta → indeterminable (no hay resto de la cartera)");
{
  const tabla = tablaDeCartera([{ nombre: "Sola", venta: 100, carga: 5 }]);
  const m = medir(tabla, "Sola");
  ok(m.estado === "indeterminable", `★ una sola cuenta en la cartera · indeterminable (dio "${m.estado}")`, JSON.stringify(m));
  ok(/no hay otras cuentas/.test(m.motivo || ""), "el motivo nombra la falta de resto de la cartera", m.motivo);
}

/* ═══ 6 · INVARIANCIA DE ESCALA ×1000 → mismos veredictos ═══ */
H("6 · cartera ×1000 en venta (la carga % no escala) → mismos veredictos");
{
  const base = [
    { nombre: "A", venta: 200, carga: 6 },
    { nombre: "B", venta: 100, carga: 3 },
    { nombre: "C", venta: 150, carga: 4 },
  ];
  const x1000 = base.map((c) => ({ nombre: c.nombre, venta: c.venta * 1000, carga: c.carga }));
  const tBase = tablaDeCartera(base), tX1000 = tablaDeCartera(x1000);
  const vBase = base.map((c) => medir(tBase, c.nombre).estado);
  const vX1000 = x1000.map((c) => medir(tX1000, c.nombre).estado);
  ok(JSON.stringify(vBase) === JSON.stringify(vX1000), `★ invariancia de escala ×1000 · mismos veredictos (base=${vBase.join(",")} · ×1000=${vX1000.join(",")})`);
}

/* ═══ 7 · MONOTONÍA EN CARGA PROPIA — subir la carga de una cuenta nunca la hace retroceder de señal a ruido ═══ */
H("7 · monotonía · subir la carga propia nunca hace retroceder una señal a bajo el piso");
{
  // escala ×3000 sobre la venta (misma razón que §2: el piso absoluto de ADI está sobre ~$100M reales)
  const resto = [
    { nombre: "R1", venta: 200 * 3000, carga: 3 },
    { nombre: "R2", venta: 200 * 3000, carga: 3 },
    { nombre: "R3", venta: 200 * 3000, carga: 3 },
  ];
  let vistaSenal = false;
  let estadoAnterior = null;
  for (const cargaSube of [3, 4, 5, 6, 8, 12, 20]) {
    const clientes = [{ nombre: "Sube", venta: 300 * 3000, carga: cargaSube }, ...resto];
    const tabla = tablaDeCartera(clientes);
    const est = medir(tabla, "Sube").estado;
    if (estadoAnterior === "senal") vistaSenal = true;
    if (vistaSenal) ok(est === "senal", `★ monotonía · con carga ${cargaSube}% sigue señal, nunca retrocede a bajo el piso (dio "${est}")`);
    estadoAnterior = est;
  }
  ok(vistaSenal, "★ monotonía · la cartera de prueba SÍ alcanzó señal en algún punto de la subida (control de que la carnada corrió)");
}

/* ═══ 8 · EL PISO SALE DE LA FUNCIÓN DEL CORE — nunca recalculado aparte (carnada: cambia con POLICY, en vivo) ═══ */
H("8 · el piso es pisoFocosUSD() del Core — cambia con POLICY.materialidadFocoPctVenta, nunca hardcodeado aparte");
{
  const clientes = [
    { nombre: "Foco", venta: 20000, carga: 5 },
    { nombre: "R1", venta: 40000, carga: 3.9 },
    { nombre: "R2", venta: 40000, carga: 3.9 },
  ];
  const tabla = tablaDeCartera(clientes);

  initTenant(TENANT_DEMO);
  const pisoADI = pisoFocosUSD();
  const mADI = medir(tabla, "Foco");
  ok(mADI.estado === "senal" || mADI.estado === "bajo_piso", "control · con el piso de ADI, Foco mide un veredicto decisivo", mADI.estado);
  ok(new RegExp(formatoDeLaCasa(pisoADI, "money").replace(/[.$]/g, "\\$&")).test(mADI.referencia.texto), "★ el texto servido nombra EXACTAMENTE el piso de pisoFocosUSD() (el mismo número, sin recalcular aparte)", `${mADI.referencia.texto} vs ${formatoDeLaCasa(pisoADI, "money")}`);

  // ★ CARNADA · ajustar el piso de materialidad por perfil de la empresa (camino B, mismo patrón que targetCarga/
  // benchmark) y confirmar que el veredicto y el texto siguen al Core, en vivo — si `medir.js` tuviera su propio
  // 0.05% copiado a mano, este candado no se movería con el ajuste.
  initTenant({ ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, materialidadFocoPctVenta: 5 } });
  const pisoEmpresa = pisoFocosUSD();
  ok(pisoEmpresa > pisoADI * 20, `★ CARNADA · con el perfil ajustado (5% en vez de 0.05%), pisoFocosUSD() del Core sube de verdad (ADI=${pisoADI}, empresa=${pisoEmpresa})`);
  const mEmpresa = medir(tabla, "Foco");
  ok(mEmpresa.estado === "bajo_piso", `★ CARNADA · con el piso de la empresa (mucho más alto), Foco pasa a "bajo_piso" (dio "${mEmpresa.estado}") — el MISMO caso que con el piso de ADI podía ser señal`, JSON.stringify({ adi: mADI.estado, empresa: mEmpresa.estado }));
  ok(materialidadFocoEsDelNegocio() === true, "★ materialidadFocoEsDelNegocio() reconoce el ajuste del perfil (camino B)");
  ok(/declarado por tu empresa/.test(mEmpresa.referencia.texto), "★ con el ajuste de la empresa, el texto dice \"declarado por tu empresa\", nunca \"de ADI\"", mEmpresa.referencia.texto);
  ok(!/piso de ADI/.test(mEmpresa.referencia.texto), "★ …y NO dice \"piso de ADI\" cuando el piso es de la empresa", mEmpresa.referencia.texto);

  initTenant(TENANT_DEMO);   // restaurar
  ok(materialidadFocoEsDelNegocio() === false, "control · restaurado TENANT_DEMO, el piso vuelve a ser el de ADI");
  ok(/piso de ADI/.test(medir(tabla, "Foco").referencia.texto), "control · …y el texto vuelve a decir \"piso de ADI\"");

  // ★ CARNADA estructural · medir.js no escribe el 0,05% como FRACCIÓN DECIMAL en código (0.0005, la forma que
  // usaría una cuenta propia) — el rótulo "0,05%" SÍ puede aparecer en comentarios de prosa (documentación del
  // piso), así que la carnada mira solo la forma que importaría a una cuenta: la fracción decimal.
  const fuente = readFileSync(new URL("./src/adi/conocimiento/medir.js", import.meta.url), "utf8");
  ok(!/0\.0005\b/.test(fuente), "★ CARNADA · medir.js no escribe \"0.0005\" (la fracción decimal de 0,05%) a mano — el piso siempre sale de pisoFocosUSD()/POLICY (importados)");
  ok(fuente.includes("pisoFocosUSD()"), "control · medir.js sí llama a pisoFocosUSD() del Core (specRetrieval.js)");
}

/* ═══ 9 · PROCEDENCIA — el piso nunca sale "medido" ═══ */
H("9 · procedencia — el veredicto de CAU-01 nunca es \"medido\" (el piso es un criterio, no una lectura)");
{
  initTenant(TENANT_DEMO);
  const clientes = [
    { nombre: "A", venta: 200, carga: 6 },
    { nombre: "B", venta: 100, carga: 3 },
    { nombre: "C", venta: 150, carga: 4 },
  ];
  const tabla = tablaDeCartera(clientes);
  for (const c of clientes) {
    const m = medir(tabla, c.nombre);
    ok(m.procedencia !== "medido", `★ ${c.nombre} · la procedencia NUNCA es "medido" (dio "${m.procedencia}")`, JSON.stringify(m));
    ok(["derivado", "estimacion_referencia", "supuesto_usuario"].includes(m.procedencia), `${c.nombre} · la procedencia es una categoría esperada (dio "${m.procedencia}")`);
  }
}

/* ═══ 10 · TEXTO POR CUENTA — TRES PARTES FIJAS; SIN MONTOS NEGATIVOS; "A FAVOR" SIN CONTRADICCIÓN ═══ */
H("10 · texto por cuenta — regla C, y \"a favor\" sin contradicción (owner, cierre de CAU-01)");
{
  const clientes = [
    { nombre: "CargaMas", venta: 20000, carga: 5 },     // dif > 0 → puede ser señal
    { nombre: "CargaMenos", venta: 20000, carga: 1 },    // dif < 0 → bajo el piso, a favor
    { nombre: "Resto1", venta: 30000, carga: 3.9 },
    { nombre: "Resto2", venta: 30000, carga: 3.9 },
  ];
  const tabla = tablaDeCartera(clientes);
  const mMas = medir(tabla, "CargaMas"), mMenos = medir(tabla, "CargaMenos");
  const sMas = servirPieza(PIEZA, "CargaMas", mMas), sMenos = servirPieza(PIEZA, "CargaMenos", mMenos);
  ok(mMenos.estado === "bajo_piso", "control · CargaMenos mide bajo el piso", mMenos.estado);

  for (const [nombre, s] of [["CargaMas", sMas], ["CargaMenos", sMenos]]) {
    ok(/Veredicto: (señal|bajo el piso)\./.test(s.texto), `★ ${nombre} · el texto dice "Veredicto: …" explícito`, s.texto);
    ok(/puntos/.test(s.texto) && /\$/.test(s.texto), `★ ${nombre} · la diferencia se muestra en PUNTOS y en MONTO`, s.texto);
    ok(!/-\$/.test(s.texto), `★ ${nombre} · CARNADA · ningún monto negativo ("-$") en el texto servido`, s.texto);
    ok(!/estimaci[oó]n contra referencia/i.test(s.texto), `★ ${nombre} · CARNADA · sin la jerga "estimación contra referencia" en el texto del usuario`, s.texto);
    ok(/el resto de la cartera/.test(s.texto), `★ ${nombre} · el texto nombra siempre "el resto de la cartera" como su referencia`, s.texto);
  }
  ok(/a su favor/.test(sMenos.texto), "★ CargaMenos · dice \"a su favor\" en vez de un signo negativo", sMenos.texto);
  // ★ LA CARNADA CENTRAL DE ESTA REGLA · nunca "Queda bajo el piso de ADI" al lado de "a su favor" (contradictorio)
  ok(/No hay exceso que comparar con el piso de ADI/.test(sMenos.texto), "★ CARNADA · CargaMenos dice \"No hay exceso que comparar…\", nunca \"Queda bajo el piso… a su favor\" (se leería contradictorio)", sMenos.texto);
  ok(!/Queda bajo el piso de ADI/.test(sMenos.texto), "★ CARNADA · …y NO dice \"Queda bajo el piso de ADI\" en la rama a favor", sMenos.texto);
  ok(!/^El oficio mira:.{0,400}En CargaMas /.test(sMas.texto), "★ CARNADA · el texto de señal NO antepone \"En {entidad}\" (la entidad ya está en el hecho, con su dirección)", sMas.texto);
  console.log(`      CargaMas: "${sMas.texto}"`);
  console.log(`      CargaMenos (a favor): "${sMenos.texto}"`);
}

/* ═══ 11 · LA MISMA CLARIDAD, EN PRI-04 (owner: «aplicá la misma claridad a PRI-04 si su rama a favor tiene el
 * mismo problema… cero cambio de veredictos») — control cruzado, no reabre el diseño sellado de PRI-04 ═══ */
H("11 · control cruzado · PRI-04 con diferencia a favor también dice \"no hay exceso\", nunca \"queda bajo…a favor\"");
{
  const { pisoMaterialidadCobranzaDe } = await import("./src/config/contract/pisoMaterialidadCobranza.js");
  void pisoMaterialidadCobranzaDe;
  const { indiceDeEvidencia: idx2 } = await import("./src/adi/notario/evidencia.js");
  const PRI04 = piezaPorId("PRI-04");
  const _f2 = (entidad, concepto, raw) => ({ id: `pmc2_${++_fid}`, label: `${entidad} · ${concepto}`, raw, unit: "money", value: formatoDeLaCasa(raw, "money"), tipo: { verificabilidad: "literal" } });
  const clientes = [
    { nombre: "PesaMenos", venta: 500, saldoPendiente: 500, vencido: 10 },
    { nombre: "Resto", venta: 400, saldoPendiente: 400, vencido: 40 },
  ];
  const figs = [];
  const cuentas = {};
  let vencidoTotal = 0;
  for (const c of clientes) {
    figs.push(_f2(c.nombre, "Venta", c.venta));
    figs.push(_f2(c.nombre, "Saldo pendiente", c.saldoPendiente));
    figs.push(_f2(c.nombre, "Saldo vencido", c.vencido));
    vencidoTotal += c.vencido;
    cuentas[c.nombre] = { venta: c.venta, saldoPendiente: c.saldoPendiente, tienePlazoDeclarado: true, vencido: c.vencido, vencidoPositivo: c.vencido > 0 };
  }
  figs.push(_f2(null, "Saldo vencido · total", vencidoTotal));
  const indice = idx2({ figs, datoProyectado: null, ejesDelTenant: { cliente: clientes.map((c) => c.nombre) } });
  const tabla = { cuentas, skus: {}, periodo: { abierto: false }, pregunta: { temas: [], metricas: [] }, _indice: indice, _figs: { comercial: figs, cobranza: figs, inventarioFrenado: [], inventarioTop: [], union: figs } };
  const m = medirPieza(PRI04, "PesaMenos", tabla);
  ok(m.estado === "bajo_piso", "control · PesaMenos (menos vencido que venta relativa) mide bajo el piso", m.estado);
  const s = servirPieza(PRI04, "PesaMenos", m);
  ok(/a su favor/.test(s.texto), "PesaMenos · dice \"a su favor\"", s.texto);
  ok(/No hay exceso que comparar con el piso de ADI/.test(s.texto), "★ PRI-04 · la misma corrección de claridad: \"No hay exceso que comparar…\", nunca \"Queda bajo…a su favor\"", s.texto);
  ok(!/Queda bajo el piso de ADI/.test(s.texto), "★ …y NO \"Queda bajo el piso de ADI\" en la rama a favor de PRI-04", s.texto);
  console.log(`      PRI-04 a favor: "${s.texto}"`);
}

/* ═══ 12 · COBERTURA — señal + bajo_piso + sin_evaluar = bajo el benchmark ═══ */
H("12 · coberturaCargaVsResto — identidades que tienen que cerrar (señal + bajo_piso + sin_evaluar = bajo benchmark)");
{
  const clientes = [
    { nombre: "A", venta: 200, carga: 6 },
    { nombre: "B", venta: 100, carga: 3 },
    { nombre: "C", venta: 150, carga: 4 },
    { nombre: "D", venta: 120, carga: 2 },
  ];
  const tabla = tablaDeCartera(clientes);
  const cob = coberturaCargaVsResto(tabla);
  ok(!!cob, "la cobertura se sirve (las identidades cierran)");
  ok(/Cartera de 4 cuentas; 4 bajo el benchmark: /.test(cob.texto), "★ la cobertura nombra la cartera completa y el universo bajo benchmark", cob.texto);
  ok(/^Piso: /.test(cob.texto), "★ owner 2026-09-24 · el cierre abre con el piso (no con \"Cartera:\")", cob.texto);
  ok(!/\(\$[\dKM.]+\s*\(/.test(cob.texto), "★ CARNADA · el piso nunca anida paréntesis (\"($50K (…\") — el defecto 4 original", cob.texto);
  const nSenal = clientes.filter((c) => medir(tabla, c.nombre).estado === "senal").length;
  const nBajo = clientes.length - nSenal;
  ok(new RegExp(`${nSenal} señal · ${nBajo} bajo el piso`).test(cob.texto), `★ la cobertura cuenta exactamente lo que mide cada cuenta (${nSenal} señal, ${nBajo} bajo el piso)`, cob.texto);
  console.log(`      "${cob.texto}"`);

  // control · sin ninguna cuenta bajo benchmark, no hay nada que cubrir (null, no una cobertura vacía)
  const tablaVacia = tablaDeCartera([]);
  ok(coberturaCargaVsResto(tablaVacia) === null, "control · sin cuentas bajo benchmark, coberturaCargaVsResto devuelve null (nada que cubrir)");
}

/* ═══ 13 · CANÓNICO — TENANT_DEMO, escenario bonanza (el que pide el informe) ═══ */
H("13 · el canónico — TENANT_DEMO/bonanza: veredictos cuenta por cuenta + cobertura, sobre el pipeline real");
{
  const { construirTablaDeSenales } = await import("./src/adi/conocimiento/tablaSenales.js");
  const { ESCENARIO_INICIAL } = await import("./src/config/scenarios.js");
  initTenant(TENANT_DEMO);
  const tabla = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "dónde estoy perdiendo plata", entidadesEnRespuesta: [] });
  const bajoBenchmark = Object.keys(tabla.cuentas).filter((e) => tabla.cuentas[e].bajoBenchmark === true);
  ok(bajoBenchmark.length > 0, `TENANT_DEMO/bonanza tiene ${bajoBenchmark.length} cuentas bajo benchmark`);
  for (const e of bajoBenchmark) {
    const m = medirPieza(PIEZA, e, tabla);
    console.log(`      ${e}: ${m.estado}${m.cifra ? " · " + m.cifra.texto : ""}${m.borde ? " · AL BORDE" : ""}`);
  }
  const cob = coberturaCargaVsResto(tabla);
  ok(!!cob, "la cobertura se sirve sobre TENANT_DEMO real");
  console.log(`\n      COBERTURA: "${cob && cob.texto}"`);
}

/* ═══ 14 · BANDERA OFF / PIEZA SIN FIRMAR — CAU-01 no aporta nada a la Entrega ═══ */
H("14 · bandera OFF / pieza sin firmar — CAU-01 no aporta nada a la Entrega servida");
{
  const { referenciaDelOficio } = await import("./src/adi/conocimiento/seleccionar.js");
  const { ESCENARIO_INICIAL } = await import("./src/config/scenarios.js");
  initTenant(TENANT_DEMO);
  const salida = referenciaDelOficio({ perfil: null, /* sin perfil: la puerta 2 apaga todo, firmada o no */ pregunta: "dónde estoy perdiendo plata", entidadesEnRespuesta: [], scenario: ESCENARIO_INICIAL, activo: true, catalogo: PIEZAS_CONOCIMIENTO });
  ok(Array.isArray(salida) && salida.length === 0, "con el catálogo real (CAU-01 firmada) pero sin perfil, referenciaDelOficio no sirve nada");
}

/* ═══ 15 · PRESENTACIÓN EN BLOQUE (owner 2026-09-24) — una señal NUNCA se omite por espacio, ningún id interno
 * llega al usuario, y el encabezado/no-implica aparecen exactamente una vez por pieza ═══
 * ★ ACTUALIZACIÓN 2026-09-24 (pertinencia por encargo) — la pregunta de esta sección se cambió de "quién me debe
 * más y dónde pierdo plata" a "por qué el margen está bajo y quién me debe más": con el rediseño de pertinencia
 * por encargo (ver `_pertinencia_por_encargo_gate.mjs`), una pieza solo se sirve en BLOQUE si su dominio ES el
 * del encargo (antes: todo pertinente se bloqueaba, sin importar el dominio) — la pregunta vieja no traía léxico
 * comercial (ni "margen" ni "carga"), así que CAU-01 pasaba a mención/oferta y el bloque quedaba fuera de
 * `referenciaDelOficio` (esta sección prueba el TOPE de caracteres del BLOQUE, no la clasificación de dominio:
 * necesita que CAU-01 y PRI-04 sean AMBAS principales). El veredicto de cada cuenta (señal/bajo_piso, cifras) no
 * cambia con la pregunta — solo el léxico de dominio. */
H("15 · el bloque — señal nunca se omite por espacio, sin id interno, encabezado/no-implica una vez");
{
  const { referenciaDelOficio } = await import("./src/adi/conocimiento/seleccionar.js");
  const { construirPerfilCliente } = await import("./src/config/contract/perfilCliente.js");
  const { ESCENARIO_INICIAL } = await import("./src/config/scenarios.js");
  const TENANT_PERFIL_COMPLETO = {
    ...TENANT_DEMO,
    perfil: {
      ...TENANT_DEMO.perfil,
      sector: { valor: "distribucion", procedencia: "medido" },
      tipoProducto: { valor: "durable", procedencia: "medido" },
      pais: { valor: "CL", procedencia: "medido" },
      modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" },
    },
  };
  const PERFIL_COMPLETO = construirPerfilCliente(TENANT_PERFIL_COMPLETO);
  const CAU01_FIRMADA = { ...PIEZA, estado: "firmada", firma: { por: "_cau01_carga_resto_gate.mjs §15 — CLON DE PRUEBA", fecha: "2026-09-24" } };
  const PRI04_FIRMADA = piezaPorId("PRI-04");   // ya está firmada de verdad
  const CATALOGO = [CAU01_FIRMADA, PRI04_FIRMADA];
  initTenant(TENANT_DEMO);

  // las señales reales de este turno (control independiente, sin pasar por referenciaDelOficio) — para saber
  // QUÉ nombres tiene que sobrevivir cualquier tope.
  const { construirTablaDeSenales } = await import("./src/adi/conocimiento/tablaSenales.js");
  const tablaControl = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: "por qué el margen está bajo y quién me debe más", entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"] });
  const bajoBenchmarkControl = Object.keys(tablaControl.cuentas).filter((e) => tablaControl.cuentas[e].bajoBenchmark === true);
  const senalesCAU01 = bajoBenchmarkControl.filter((e) => medirPieza(CAU01_FIRMADA, e, tablaControl).estado === "senal");
  ok(senalesCAU01.length > 0, `hay ${senalesCAU01.length} señal(es) de CAU-01 este turno (control, para saber qué nombres no se pueden perder): ${senalesCAU01.join(", ")}`);

  // ★ CARNADA 1 · con un tope de caracteres RIDÍCULAMENTE chico (10 — ni una palabra entera cabría en el
  // pipeline por ítem viejo), las señales de CAU-01 y PRI-04 siguen nombradas — el bloque nunca pasa por el
  // tope de tamaño (bypassa `acotadores.js` entero, ver `seleccionar.js:_BLOQUE_POR_CALCULO`).
  const salidaTopeChico = referenciaDelOficio({ perfil: PERFIL_COMPLETO, pregunta: "por qué el margen está bajo y quién me debe más", entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO, maxCaracteres: 10 });
  const textoCompleto = salidaTopeChico.map((s) => s.texto).join("\n");
  for (const e of senalesCAU01) ok(textoCompleto.includes(`${e}:`), `★ CARNADA · con maxCaracteres:10, la señal "${e}" (CAU-01) SIGUE nombrada en el texto servido`, textoCompleto.slice(0, 300));
  ok(!/mediciones más no entraron por espacio/.test(textoCompleto) || senalesCAU01.every((e) => textoCompleto.includes(`${e}:`)), "★ CARNADA · aunque hubiera una línea de sobrantes (del pipeline viejo de CAU-06/CAU-03), ninguna señal de CAU-01/PRI-04 cayó ahí", textoCompleto);
  console.log(`      con maxCaracteres:10, el bloque de CAU-01 solo (${salidaTopeChico[0] ? salidaTopeChico[0].texto.length : 0} chars) igual se sirvió completo`);

  // ★ CARNADA 2 · ningún id interno del catálogo aparece en el texto servido — comparado contra los ids REALES
  // de PIEZAS_CONOCIMIENTO (nunca una lista de palabras a mano: si el catálogo cambia, esta carnada lo sigue).
  const salidaNormal = referenciaDelOficio({ perfil: PERFIL_COMPLETO, pregunta: "por qué el margen está bajo y quién me debe más", entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  const textoNormal = salidaNormal.map((s) => s.texto).join("\n");
  ok(textoNormal.length > 0, "la sección sirvió contenido real para esta carnada");
  for (const id of PIEZAS_CONOCIMIENTO.map((p) => p.id)) {
    ok(!textoNormal.includes(id), `★ CARNADA · el id de catálogo "${id}" NO aparece en el texto servido al usuario`, textoNormal.includes(id) ? textoNormal : "");
  }

  // ★ CARNADA 3 · el encabezado ("En {sector}, …"/"En {sector}: …") y el "no implica"/"no excluye" aparecen
  // EXACTAMENTE una vez por pieza — nunca cero (owner: "el no implica va una vez"), nunca dos o más.
  const bloqueCAU01 = salidaNormal.find((s) => /^En distribución, cuando una cuenta cadena/.test(s.texto));
  ok(!!bloqueCAU01, "el bloque de CAU-01 se sirvió (para contar encabezado/no-implica)");
  if (bloqueCAU01) {
    const nEncabezados = (bloqueCAU01.texto.match(/En distribución, cuando una cuenta cadena/g) || []).length;
    ok(nEncabezados === 1, `★ CARNADA · el encabezado de CAU-01 aparece EXACTAMENTE una vez (dio ${nEncabezados})`, bloqueCAU01.texto);
    const nNoImplica = (bloqueCAU01.texto.match(/No implica que la carga sea la causa del margen bajo/g) || []).length;
    ok(nNoImplica === 1, `★ CARNADA · el "no implica" de CAU-01 aparece EXACTAMENTE una vez (dio ${nNoImplica})`, bloqueCAU01.texto);
  }
  const bloquePRI04 = salidaNormal.find((s) => /^En distribución, el oficio compara la participación/.test(s.texto));
  ok(!!bloquePRI04, "el bloque de PRI-04 se sirvió (para contar encabezado/no-implica)");
  if (bloquePRI04) {
    const nEncabezados = (bloquePRI04.texto.match(/el oficio compara la participación de cada cuenta en el vencido/g) || []).length;
    ok(nEncabezados === 1, `★ CARNADA · el encabezado de PRI-04 aparece EXACTAMENTE una vez (dio ${nEncabezados})`, bloquePRI04.texto);
    const nNoImplica = (bloquePRI04.texto.match(/No implica que la cuenta sea mala pagadora/g) || []).length;
    ok(nNoImplica === 1, `★ CARNADA · el "no implica" de PRI-04 aparece EXACTAMENTE una vez (dio ${nNoImplica})`, bloquePRI04.texto);
  }

  // control negativo: CADA cuenta bajo el piso (varias, en un solo texto) NO repite el encabezado entre ellas
  if (bloqueCAU01) {
    const partesEntreCuentas = bloqueCAU01.texto.split(/(?=[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*: \d)/);
    ok(partesEntreCuentas.length >= 2, `control · el bloque de CAU-01 trae varias cuentas en un solo texto (dio ${partesEntreCuentas.length} tramos)`, bloqueCAU01.texto);
  }
}

/* ═══ 16 · NINGÚN TOKEN CON FORMA DE ID DE PIEZA — estructural (validarPieza.js), no una lista de ids conocidos
 * (owner 2026-09-24, defecto 1: «CAU-04» se filtraba en medicion.no_excluye de CAU-01, y CAU-04 ni siquiera
 * está sembrada). Todas las mutaciones son COPIAS en memoria (spread), nunca git ni el archivo real. ═══ */
H("16 · ningún id de pieza (de cualquiera, esté o no en el catálogo) en un campo que se sirve al usuario");
{
  // control · las 4 piezas reales pasan el validador (sus campos de texto están limpios)
  for (const p of PIEZAS_CONOCIMIENTO) ok(validarPieza(p).ok, `control · ${p.id} pasa el validador (sin ids de pieza en sus campos de texto)`);

  // ★ CARNADA · una COPIA de CAU-01 con un id de una pieza que NO existe en el catálogo (CAU-04, el caso real)
  // metido en medicion.no_excluye — el validador la rechaza por FORMA, no por lista.
  const mutanteNoExcluye = { ...PIEZA, medicion: { ...PIEZA.medicion, no_excluye: "descuentos aplicados (hipótesis de CAU-04, no sembrada todavía)" } };
  const rMut1 = validarPieza(mutanteNoExcluye);
  ok(!rMut1.ok, "★ CARNADA · CAU-01 con \"CAU-04\" en medicion.no_excluye NO pasa el validador (aunque CAU-04 no esté en el catálogo)", JSON.stringify(rMut1.errores));
  ok(rMut1.errores.some((e) => /no_excluye/.test(e) && /forma de id/.test(e)), "★ CARNADA · el error nombra el campo y la razón exacta", JSON.stringify(rMut1.errores));

  // ★ CARNADA · lo mismo con un id de una pieza que SÍ está en el catálogo (PRI-04), en el enunciado
  const mutanteEnunciado = { ...PIEZA, enunciado: `${PIEZA.enunciado} (ver también PRI-04)` };
  const rMut2 = validarPieza(mutanteEnunciado);
  ok(!rMut2.ok, "★ CARNADA · CAU-01 con \"PRI-04\" en el enunciado NO pasa el validador", JSON.stringify(rMut2.errores));

  // ★ CARNADA · lo mismo en no_implica
  const mutanteNoImplica = { ...PIEZA, no_implica: `${PIEZA.no_implica} (RSG-06)` };
  const rMut3 = validarPieza(mutanteNoImplica);
  ok(!rMut3.ok, "★ CARNADA · CAU-01 con un id de pieza en no_implica NO pasa el validador", JSON.stringify(rMut3.errores));

  // control negativo · un texto con un guion que NO tiene forma de id (ej. "año-fiscal", "más-alto") sigue pasando
  const controlNegativo = { ...PIEZA, no_implica: `${PIEZA.no_implica} (dato del año-fiscal)` };
  ok(validarPieza(controlNegativo).ok, "control negativo · un guion sin forma de id (\"año-fiscal\") no dispara la carnada — no es un siempre-rojo", JSON.stringify(validarPieza(controlNegativo).errores));

  // control · el texto REAL servido hoy (las dos preguntas del informe) no contiene ningún token con esa forma
  const { construirPerfilCliente } = await import("./src/config/contract/perfilCliente.js");
  const { referenciaDelOficio } = await import("./src/adi/conocimiento/seleccionar.js");
  const { ESCENARIO_INICIAL } = await import("./src/config/scenarios.js");
  const TENANT_PERFIL_COMPLETO16 = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, sector: { valor: "distribucion", procedencia: "medido" }, tipoProducto: { valor: "durable", procedencia: "medido" }, pais: { valor: "CL", procedencia: "medido" }, modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" } } };
  const PERFIL16 = construirPerfilCliente(TENANT_PERFIL_COMPLETO16);
  initTenant(TENANT_DEMO);
  const CATALOGO16 = [{ ...PIEZA, estado: "firmada", firma: { por: "gate §16", fecha: "2026-09-24" } }, piezaPorId("PRI-04")];
  const salida16 = referenciaDelOficio({ perfil: PERFIL16, pregunta: "¿Por qué Falabella, Lider y Jumbo están bajo el benchmark de margen?", entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO16 });
  const texto16 = salida16.map((s) => s.texto).join("\n");
  ok(!ID_PIEZA_RE.test(texto16), "control · el texto real servido (las dos piezas) no contiene ningún token con forma de id de pieza", texto16);
}

/* ═══ 17 · EXACTAMENTE UNA ORACIÓN DE LÍMITE POR BLOQUE (owner 2026-09-24, defecto 2) ═══
 * El bloque imprime `pieza.no_implica` UNA vez y NUNCA vuelve a agregar `medicion.no_excluye` aparte — se prueba
 * con un marcador DISTINGUIBLE en `no_excluye` que, si el bloque lo concatenara (el bug viejo), aparecería en
 * el texto; con el arreglo, no aparece. Copia en memoria, nunca el archivo real. ═══ */
H("17 · una sola oración de límite por bloque — nunca se concatena medicion.no_excluye aparte");
{
  const tabla17 = tablaDeCartera([
    { nombre: "M1", venta: 20000, carga: 6 },
    { nombre: "M2", venta: 20000, carga: 1 },
    { nombre: "R1", venta: 30000, carga: 3.9 },
    { nombre: "R2", venta: 30000, carga: 3.9 },
  ]);
  const MARCADOR = "MARCADOR-NO-EXCLUYE-e7c2";
  const piezaMarcada = { ...PIEZA, medicion: { ...PIEZA.medicion, no_excluye: MARCADOR } };
  const { porEntidad } = resultadosCargaVsResto(piezaMarcada, tabla17);
  const cierre17 = coberturaCargaVsResto(tabla17);
  const bloque17 = servirBloqueCargaVsResto(piezaMarcada, porEntidad, cierre17.texto);
  ok(!!bloque17, "el bloque se sirvió (para esta carnada)");
  if (bloque17) {
    ok(!bloque17.texto.includes(MARCADOR), "★ CARNADA · el bloque NUNCA concatena medicion.no_excluye aparte (el marcador no aparece)", bloque17.texto);
    const nNoImplica = (bloque17.texto.match(/No implica que la carga sea la causa del margen bajo/g) || []).length;
    ok(nNoImplica === 1, `★ el "no implica" aparece EXACTAMENTE una vez (dio ${nNoImplica})`, bloque17.texto);
    ok(!/Esto no excluye/.test(bloque17.texto), "★ CARNADA · el bloque no trae la forma vieja \"Esto no excluye: …\" (esa era la tercera oración)", bloque17.texto);
  }
}

/* ═══ 18 · MENCIÓN + OFERTA CUANDO LA PIEZA ES DE OTRO DOMINIO (owner 2026-09-24, actualizado por la pertinencia
 * por encargo — ver `_pertinencia_por_encargo_gate.mjs`) ═══
 * REDISEÑO 2026-09-24: con la pregunta de margen (dominio "comercial"), PRI-04 (dominio "cobranza") YA NO se
 * sirve como bloque completo (el defecto 4 original — "5 señales completas aunque el usuario no las nombró y el
 * tema es carga/margen, no cobranza" — se cerraba antes compactando esas señales DENTRO del mismo bloque; ahora
 * el diseño sellado (owner 2026-09-24) va más allá: una pieza de otro dominio pasa a MENCIÓN (una oración, solo
 * sobre cuentas que el USUARIO nombró en la pregunta — Lider, aquí) + EXACTAMENTE una OFERTA para «Qué más puedo
 * calcular» con el resto de sus señales. Se prueba sobre el pipeline real (`referenciaDelOficioConOfertas`) y,
 * de control, llamando al bloque directo con `abierta`/`sujeto` en vez del viejo `respondeLaPregunta`/`nombradas`
 * — prueba que la opción sigue siendo lo que decide el despliegue completo, no una casualidad de los datos. */
H("18 · mención + oferta cuando la pieza es de otro dominio (antes: bloque con señales compactadas)");
{
  const { construirPerfilCliente } = await import("./src/config/contract/perfilCliente.js");
  const { referenciaDelOficioConOfertas } = await import("./src/adi/conocimiento/seleccionar.js");
  const { ESCENARIO_INICIAL } = await import("./src/config/scenarios.js");
  const TENANT_PERFIL_COMPLETO18 = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, sector: { valor: "distribucion", procedencia: "medido" }, tipoProducto: { valor: "durable", procedencia: "medido" }, pais: { valor: "CL", procedencia: "medido" }, modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" } } };
  const PERFIL18 = construirPerfilCliente(TENANT_PERFIL_COMPLETO18);
  initTenant(TENANT_DEMO);
  const CATALOGO18 = [{ ...PIEZA, estado: "firmada", firma: { por: "gate §18", fecha: "2026-09-24" } }, piezaPorId("PRI-04")];
  const pregMargen = "¿Por qué Falabella, Lider y Jumbo están bajo el benchmark de margen?";
  // `entidadesDeLaPregunta` — las cuentas que el USUARIO nombró (las tres, literal en el texto de la pregunta):
  // sin esto, "sujeto abierto" sería `true` y la mención/oferta perdería su distinción (ver el candado nuevo).
  const { salida: salida18, ofertas: ofertas18 } = referenciaDelOficioConOfertas({ perfil: PERFIL18, pregunta: pregMargen, entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"], entidadesDeLaPregunta: ["Falabella", "Lider", "Jumbo"], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO18 });
  const mencionPRI04_18 = salida18.find((s) => /Lider pesa más en el vencido/.test(s.texto));
  ok(!!mencionPRI04_18, "la mención de PRI-04 (Lider) se sirvió en la pregunta de margen");
  ok(!salida18.some((s) => /el oficio compara la participación/.test(s.texto)), "★ CARNADA · PRI-04 ya NO se sirve como bloque completo (encabezado ausente) en la pregunta de margen");
  if (mencionPRI04_18) {
    const t = mencionPRI04_18.texto;
    ok(/Lider pesa más en el vencido que en la venta — [\d.]+% del vencido contra/.test(t), "★ Lider (nombrada por el usuario, señal) trae la mención con su cifra", t);
    for (const noNombrada of ["Sodimac", "Tottus", "Paris", "Easy"]) {
      ok(!t.includes(noNombrada), `★ CARNADA · ${noNombrada} (señal, no nombrada por el usuario) NO aparece en la mención`, t);
    }
  }
  const ofertaPRI04_18 = (ofertas18 || []).find((o) => o.dominio === "cobranza");
  ok(!!ofertaPRI04_18, "hay EXACTAMENTE una oferta de cobranza (PRI-04) para «Qué más puedo calcular»");
  if (ofertaPRI04_18) {
    ok(/5 cuentas superan/.test(ofertaPRI04_18.texto), `★ CARNADA · la oferta cuenta las 5 señales de PRI-04 este turno (Lider incluida: el conteo es un resumen de la pieza, no una repetición del detalle)`, ofertaPRI04_18.texto);
    ok(!!ofertaPRI04_18.gancho && !!ofertaPRI04_18.gancho.hechoId, "★ CARNADA · la oferta trae un gancho con hechoId (cifra verificada por el libro de hechos, no inventada)", JSON.stringify(ofertaPRI04_18.gancho));
  }

  // ★ CARNADA de control — llamando al bloque DIRECTO con `abierta`/`sujeto` (copia de argumentos, no del
  // archivo): con `abierta:true` TODAS las señales se despliegan completas; con `abierta:false` y un `sujeto`
  // chico, las que quedan fuera se compactan — prueba que la opción sigue siendo lo que decide, no los datos.
  const { construirTablaDeSenales } = await import("./src/adi/conocimiento/tablaSenales.js");
  const tabla18 = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: pregMargen, entidadesEnRespuesta: ["Falabella", "Lider", "Jumbo"] });
  const { porEntidad: porEntidad18 } = resultadosPisoDeCobranza(piezaPorId("PRI-04"), tabla18);
  const cierre18 = coberturaPisoDeCobranza(tabla18);
  const bloqueForzado = servirBloquePisoDeCobranza(piezaPorId("PRI-04"), porEntidad18, cierre18.texto, { sujeto: new Set(["Falabella", "Lider", "Jumbo"]), abierta: true });
  ok(!!bloqueForzado, "el bloque forzado (abierta:true) se sirvió");
  if (bloqueForzado) {
    ok(!/También superan|Fuera de/.test(bloqueForzado.texto), "★ CARNADA control · con abierta:true, NO hay línea compacta (todo se despliega completo)", bloqueForzado.texto);
    for (const nombre of ["Sodimac", "Tottus", "Paris", "Easy"]) ok(new RegExp(`${nombre}: [\\d.]+% del vencido contra`).test(bloqueForzado.texto), `★ CARNADA control · con abierta:true, ${nombre} SÍ trae línea completa`, bloqueForzado.texto);
  }
  const bloqueCerrado = servirBloquePisoDeCobranza(piezaPorId("PRI-04"), porEntidad18, cierre18.texto, { sujeto: new Set(["Lider"]), abierta: false });
  ok(!!bloqueCerrado, "el bloque cerrado (abierta:false, sujeto:{Lider}) se sirvió");
  if (bloqueCerrado) {
    ok(/Fuera de la nombrada, también superan/.test(bloqueCerrado.texto), "★ CARNADA control · con abierta:false, las señales fuera del sujeto se compactan", bloqueCerrado.texto);
    for (const nombre of ["Sodimac", "Tottus", "Paris", "Easy"]) ok(!new RegExp(`${nombre}: [\\d.]+% del vencido contra`).test(bloqueCerrado.texto), `★ CARNADA control · con abierta:false, ${nombre} NO trae línea completa`, bloqueCerrado.texto);
  }
}

console.log(`\n── _cau01_carga_resto_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
