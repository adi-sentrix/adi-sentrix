/* === _entrega_gate.mjs · EL COMPOSITOR DE LA ENTREGA — CORTE VERTICAL (owner 2026-09-22, offline) ═══════════════
 * Primer corte vertical del plan `_ADI_LLMBUSINESS_PLAN.md`: una sola ruta («¿dónde estoy perdiendo plata?», el
 * ejemplo del §7) de punta a punta — boleta real (marginRead + diagnose, TENANT_DEMO) → libro de hechos verificado
 * (`notario/hechos.js`) → Entrega (`src/adi/entrega/componer.js`) → autoverificación de composición
 * (`src/adi/entrega/verificar.js`). Bandera `ADI_ENTREGA` APAGADA en todos los perfiles: nada de esto se importa
 * hoy desde ningún camino de producción.
 *
 * LO QUE ESTE GATE EXIGE:
 *   1 · sobre el tenant demo real, la Entrega se compone, cada hecho declarado verifica, y `verificarEntrega`
 *       encuentra CERO violaciones de las ocho reglas de composición del plan §1.
 *   2 · la forma de la Entrega está completa (`esquema.js` · `camposFaltantes`).
 *   3 · DOS CARNADAS: una Entrega con una cifra inventada pegada al texto (regla 1, cero cifras desnudas) y una
 *       con un adjetivo evaluativo de la casa (regla 7) tienen que ponerse ROJAS bajo `verificarEntrega`.
 *   4 · la bandera `ADI_ENTREGA` da `false` bajo Node (piso) — el camino de producción no cambia.
 *
 * CERO llamadas a un LLM: la boleta sale de tools locales (marginRead/diagnose) sobre datos del tenant demo.
 * Solo por `npm run gates:offline` (o `node --import ./scripts/offline-guard.mjs _entrega_gate.mjs`). */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import {
  componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL,
  componerEntregaCobranza, PREGUNTA_COBRANZA,
  componerEntregaInventario, PREGUNTA_INVENTARIO,
  componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO,
} from "./src/adi/entrega/componer.js";
import { verificarEntrega } from "./src/adi/entrega/verificar.js";
import { crearEntrega, camposFaltantes, PARTES_DE_LA_ENTREGA } from "./src/adi/entrega/esquema.js";
import { ADI_ENTREGA } from "./src/config/voiceFlags.js";
import { reconcilian, UNIVERSOS } from "./src/config/contract/figureType.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* ═══ 0 · LA FORMA ═══ */
H("0 · esquema.js — la forma de la Entrega, sin lógica de negocio");
{
  const vacia = crearEntrega();
  ok(camposFaltantes(vacia).length === 0, "una Entrega vacía tiene las siete partes completas", camposFaltantes(vacia).join(", "));
  ok(PARTES_DE_LA_ENTREGA.length === 7, `siete partes declaradas (${PARTES_DE_LA_ENTREGA.join(" · ")})`);
}

/* ═══ 1 · EL COMPOSITOR SOBRE EL TENANT DEMO REAL ═══ */
H("1 · componer.js — la Entrega real, sobre marginRead + diagnose (TENANT_DEMO, escenario " + ESCENARIO_INICIAL + ")");
const R = componerEntregaBrechaComercial({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_BRECHA_COMERCIAL });
ok(R.ok, "la Entrega se compuso (ningún hecho declarado quedó sin verificar)", R.motivo);
ok(!!R.texto && R.texto.length > 200, `el texto tiene contenido (${R.texto ? R.texto.length : 0} caracteres)`);
ok(!!R.libro && R.libro.hechos.length > 0, `el libro de hechos trae ${R.libro ? R.libro.hechos.length : 0} hechos`);
ok(!!R.libro && R.libro.hechos.every((h) => h.ok), "TODOS los hechos del libro verifican (ok === true)", R.libro ? R.libro.hechos.filter((h) => !h.ok).map((h) => h.id).join(",") : "");
ok(camposFaltantes(R.entrega).length === 0, "la Entrega compuesta tiene la forma completa", camposFaltantes(R.entrega).join(", "));
ok(R.entrega.respuesta.length >= 3, `Respuesta trae ${R.entrega.respuesta.length} oraciones-hecho (≥ 3)`);
ok(R.entrega.cifras.filas.length >= 2, `Cifras trae ${R.entrega.cifras.filas.length} filas (≥ 2, incluye el subtotal)`);
ok(R.entrega.limites.length >= 3, `Lo que no se puede concluir trae ${R.entrega.limites.length} hallazgos (≥ 3)`);
ok(Array.isArray(R.entrega.referenciaDelOficio) && R.entrega.referenciaDelOficio.length === 0, "Referencia del oficio viaja vacía (Etapa 3 del plan, no construida) — declarado, no inventado");
ok(R.entrega.paraSuJuicio.length >= 1, `Para su juicio trae ${R.entrega.paraSuJuicio.length} punto(s)`);

/* ── TAREA 1 (owner 2026-09-22): el período en el Core — HECHO verificable, no texto suelto ── */
H("1b · el período — HECHO verificable en el Marco (figureType.UNIVERSOS · periodoDeFiguras), declarado UNA vez");
{
  const p = R.entrega.marco.periodo;
  ok(!!p && p.tipo === "cerrado" && p.texto === "año cerrado — los 12 meses ya ocurrieron", "el Marco declara tipo «cerrado» con el texto canónico del contrato (no inventado)", JSON.stringify(p));
  ok(Array.isArray(p && p.familias) && p.familias.length === 1 && p.familias[0] === "anual", "una sola familia (\"anual\") — las figs de inventario que trae `diagnose` NO contaminan el marco de esta Entrega", JSON.stringify(p && p.familias));
  ok(p && p.rango === null, "el rango calendario NO se inventa: el pack no declara una fecha de cierre para el universo comercial");
  ok(R.entrega.limites.some((l) => /rango de fechas calendario/i.test(l.titulo)), "el hueco de INGESTA (sin fecha de cierre comercial) queda declarado como límite, no escondido");
  ok((R.texto.match(/año cerrado — los 12 meses ya ocurrieron/g) || []).length === 1, "el sello de período se dice UNA vez (owner: no estampado en cada frase)");
}

console.log("\n── la Entrega compuesta (texto completo) ──\n");
console.log(R.texto);
console.log("");

/* ═══ 2 · LA AUTOVERIFICACIÓN — cero violaciones de las ocho reglas de composición ═══ */
H("2 · verificar.js — las ocho reglas de composición del plan §1, sobre la Entrega real");
const V = verificarEntrega(R);
ok(V.ok, `verificarEntrega: 0 violaciones (${V.violaciones.length})`, V.violaciones.map((x) => `${x.regla}: ${x.detalle}`).join("\n      "));
for (const regla of ["cifras-desnudas", "oracion-hecho", "doble-colocacion", "comparables-juntas", "limite-sin-titulo", "limite-como-prohibicion", "tentacion-no-precalculada", "adjetivo-evaluativo", "tope-de-tamano", "autoverificacion", "registro-informal"]) {
  ok(!V.violaciones.some((x) => x.regla === regla), `sin violación de «${regla}»`);
}
{
  const n = R.texto.trim().split(/\s+/).filter(Boolean).length;
  ok(n <= 900, `la Entrega corta: ${n} palabras (tope 900)`);
}

/* ═══ 3 · LAS DOS CARNADAS — mutar el texto servido y ver el candado morder ═══ */
H("3 · carnadas — una Entrega rota tiene que ponerse ROJA");
{
  // carnada A · regla 1, cero cifras desnudas: se pega una cifra inventada al final del texto servido
  const rotaA = { ...R, texto: R.texto + "\n\nEsto en realidad son $9.999M de pérdida oculta." };
  const vA = verificarEntrega(rotaA);
  ok(!vA.ok && vA.violaciones.some((x) => x.regla === "cifras-desnudas"), "carnada A (cifra inventada pegada al texto) → verificarEntrega la caza (cifras-desnudas)", JSON.stringify(vA.violaciones));
}
{
  // carnada B · regla 7, sin adjetivos evaluativos de la casa: se inserta un juicio de valor sobre una cifra
  const rotaB = { ...R, texto: R.texto.replace("Prioridad del procedimiento", "Esto es una situación preocupante. Prioridad del procedimiento") };
  const vB = verificarEntrega(rotaB);
  ok(!vB.ok && vB.violaciones.some((x) => x.regla === "adjetivo-evaluativo"), "carnada B (adjetivo evaluativo «preocupante») → verificarEntrega la caza (adjetivo-evaluativo)", JSON.stringify(vB.violaciones));
}
{
  // carnada C · «carga comercial alta» —el NOMBRE del detector— no debe dispararla (control negativo: la regla 7 no debe tener falsos positivos sobre el vocabulario propio de la casa)
  const okC = { ...R, texto: R.texto };
  const vC = verificarEntrega(okC);
  ok(!vC.violaciones.some((x) => x.regla === "adjetivo-evaluativo"), "control · «carga comercial alta» (nombre del detector) NO dispara «adjetivo-evaluativo»");
}
{
  // carnada D · regla 9 / autoverificación: un hecho marcado roto en el libro tiene que voltear verificarEntrega
  const libroRoto = { ...R.libro, hechos: [...R.libro.hechos.slice(0, -1), { ...R.libro.hechos[R.libro.hechos.length - 1], ok: false, id: "e_roto" }] };
  const rotaD = { ...R, entrega: { ...R.entrega, procedencia: { ...R.entrega.procedencia, libro: libroRoto } } };
  const vD = verificarEntrega(rotaD);
  ok(!vD.ok && vD.violaciones.some((x) => x.regla === "autoverificacion"), "carnada D (un hecho del libro marcado roto) → verificarEntrega la caza (autoverificacion)", JSON.stringify(vD.violaciones));
}
{
  // TAREA 2 (owner 2026-09-22) · carnada E — regla 10, «ningún texto de la Entrega usa voseo ni coloquialismos».
  // CORREGIDA el mismo día (owner): la versión original de la carnada probaba TUTEO puro («tu margen…») — eso
  // dejó de ser un defecto (el registro del proyecto ES tuteo neutro, CLAUDE.md). La carnada real de la regla 10
  // es el VOSEO (chilenismo/argentinismo verbal), no el pronombre de 2ª persona.
  const rotaE = { ...R, texto: R.texto.replace("Prioridad del procedimiento", "Te dejo esto porque vos sabés que el margen está en juego. Prioridad del procedimiento") };
  const vE = verificarEntrega(rotaE);
  ok(!vE.ok && vE.violaciones.some((x) => x.regla === "registro-informal"), "carnada E (voseo «sabés») → verificarEntrega la caza (registro-informal)", JSON.stringify(vE.violaciones));
}
{
  // carnada F · la misma regla 10, del lado del COLOQUIALISMO/vocabulario vetado (reusa stripLanguageLeaks,
  // voiceGuard.js — la fuente única del owner) en vez de una lista nueva.
  const rotaF = { ...R, texto: R.texto.replace("Prioridad del procedimiento", "Ojo que esa plata está dormida. Prioridad del procedimiento") };
  const vF = verificarEntrega(rotaF);
  ok(!vF.ok && vF.violaciones.some((x) => x.regla === "registro-informal"), "carnada F (coloquialismo «plata … dormida») → verificarEntrega la caza (registro-informal, vía stripLanguageLeaks)", JSON.stringify(vF.violaciones));
}
{
  // control negativo · la Entrega real (tuteo neutro, sin voseo ni coloquialismos) NO dispara la regla 10 —
  // sin esto, la carnada podría estar cazando cualquier cosa y no lo que se le pidió.
  ok(!V.violaciones.some((x) => x.regla === "registro-informal"), "control · la Entrega real (tuteo neutro) NO dispara «registro-informal»", JSON.stringify(V.violaciones));
}

/* ═══ 5 · TAREA 3 (owner 2026-09-22) — SEGUNDA RUTA, «¿quién me debe más?» (cobranza), para probar que el
 * patrón GENERALIZA: mismas reglas de composición (verificar.js), mismo candado, mismas carnadas. Lo que NO
 * generalizó tal cual queda documentado en la cabecera de `componerEntregaCobranza` (componer.js): sin
 * `lecturaDeCobranza` reusable en cobranza.js, sin universo «cobranza» en el contrato (el período se declara
 * desde `facts.fechaCorte`, no desde `periodoDeFiguras`), y la regla 4 de verificar.js se generalizó a activarse
 * por CONTENIDO (menciona benchmark/brecha) en vez de exigirlo siempre. ═══ */
H("5 · componerEntregaCobranza — la segunda ruta, sobre el mismo candado y las mismas reglas");
const RC = componerEntregaCobranza({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_COBRANZA });
ok(RC.ok, "la Entrega de cobranza se compuso (ningún hecho declarado quedó sin verificar)", RC.motivo);
ok(!!RC.texto && RC.texto.length > 200, `el texto tiene contenido (${RC.texto ? RC.texto.length : 0} caracteres)`);
ok(!!RC.libro && RC.libro.hechos.every((h) => h.ok), "TODOS los hechos del libro verifican (ok === true)", RC.libro ? RC.libro.hechos.filter((h) => !h.ok).map((h) => h.id).join(",") : "");
ok(camposFaltantes(RC.entrega).length === 0, "la Entrega compuesta tiene la forma completa", camposFaltantes(RC.entrega).join(", "));
ok(RC.entrega.respuesta.length >= 3, `Respuesta trae ${RC.entrega.respuesta.length} oraciones-hecho (≥ 3)`);
ok(RC.entrega.cifras.filas.length >= 2, `Cifras trae ${RC.entrega.cifras.filas.length} filas (≥ 2, incluye el subtotal)`);
ok(RC.entrega.limites.length >= 3, `Lo que no se puede concluir trae ${RC.entrega.limites.length} hallazgos (≥ 3)`);

console.log("\n── la Entrega de cobranza (texto completo) ──\n");
console.log(RC.texto);
console.log("");

const VC = verificarEntrega(RC);
ok(VC.ok, `verificarEntrega sobre la ruta de cobranza: 0 violaciones (${VC.violaciones.length})`, VC.violaciones.map((x) => `${x.regla}: ${x.detalle}`).join("\n      "));
{
  // el período — declarado desde `facts.fechaCorte` (nota 2 de componer.js), NO desde `periodoDeFiguras`
  const p = RC.entrega.marco.periodo;
  ok(!!p && p.tipo === "foto" && /^foto de cobranza al /.test(p.texto), "el Marco declara tipo «foto» con la fecha de corte que el propio tool publica (no el default equivocado del contrato)", JSON.stringify(p));
}
{
  // carnada G · la MISMA regla 10 (registro), sobre la SEGUNDA ruta — si el candado fuera específico de la
  // primera, esta carnada no cazaría nada. Voseo, no tuteo (ver la corrección de la carnada E arriba).
  const rotaG = { ...RC, texto: RC.texto.replace("Quien más le debe", "Che, vos sabés quién le debe más") };
  const vG = verificarEntrega(rotaG);
  ok(!vG.ok && vG.violaciones.some((x) => x.regla === "registro-informal"), "carnada G (voseo «sabés» en la ruta de cobranza) → verificarEntrega la caza (registro-informal) — la regla generaliza", JSON.stringify(vG.violaciones));
}
{
  // carnada H · regla 1 (cifras-desnudas) sobre la segunda ruta — mismo candado, misma carnada que A.
  const rotaH = { ...RC, texto: RC.texto + "\n\nEn total le deben $7.777.777." };
  const vH = verificarEntrega(rotaH);
  ok(!vH.ok && vH.violaciones.some((x) => x.regla === "cifras-desnudas"), "carnada H (cifra inventada pegada, ruta de cobranza) → verificarEntrega la caza (cifras-desnudas)", JSON.stringify(vH.violaciones));
}
{
  // control · cobranza NO tiene benchmark y NO dispara «comparables-juntas» (la regla 4 generalizada del owner)
  ok(!VC.violaciones.some((x) => x.regla === "comparables-juntas"), "control · cobranza (sin benchmark) NO dispara «comparables-juntas» — la regla 4 se generalizó por contenido, no por forma");
}

/* ═══ 6 · TAREA 1 (owner 2026-09-23, incremento 3) — «Recuperado %»: el universo `tasa_cobranza` ═══
 * La medición completa vive en `_sonda_recuperado_universo.mjs` (antes/después) y `_sonda_reconcilian_matriz.mjs`
 * (los 55 pares preexistentes, byte-idénticos). Acá se deja el candado permanente: la fig auto-enriquecida
 * "<Cliente> · Recuperado" (ledger.js `enrichFromFacts`, sobre `cobranza().facts.clientes[].recuperado`) tiene
 * que resolver a `tasa_cobranza` con período "hoy" — nunca más al default `tasa_comercial`/"anual". */
H("6 · figureType.js — «Recuperado %» resuelve a tasa_cobranza (periodo «hoy»), no al default anual");
{
  const { deriveFigureType } = await import("./src/config/contract/figureType.js");
  const t = deriveFigureType({ label: "Lider · Recuperado", unit: "pct" });
  ok(t.universo === "tasa_cobranza", `"Lider · Recuperado" (pct) → universo tasa_cobranza (hoy: ${t.universo})`);
  ok(t.periodo === "hoy", `período «hoy» — una foto al corte, nunca año cerrado (hoy: ${t.periodo})`);
  ok(UNIVERSOS.tasa_cobranza && UNIVERSOS.tasa_cobranza.periodo === "hoy", "UNIVERSOS.tasa_cobranza declarado con periodo «hoy»");
  const tDias = deriveFigureType({ label: "Lider · Dias Vencido", unit: "days" });
  ok(tDias.periodo === "hoy", "«Días vencido» (cobranza) sigue con período «hoy» — NO se tocó (su universo se llama distinto, pero su período ya era correcto)");
  ok(!/recuperad/i.test("recuperable"), "control · «recuperable» (adjetivo de la brecha comercial) no casa con la ruta de tasa_cobranza (sufijos distintos)");
  const tRecuperable = deriveFigureType({ label: "Falabella · Contribución no capturada", unit: "pct" });
  ok(tRecuperable.universo !== "tasa_cobranza", "control · una fig comercial no cae en tasa_cobranza por casualidad léxica");
}

/* ═══ 7 · TAREA 2 (owner 2026-09-23, incremento 3) — la ruta de inventario, «¿tengo demasiado inventario?» ═══ */
H("7 · componerEntregaInventario — sobre inventoryStatus{focus:\"frenado\"} (el playbook inventario-inmovilizado)");
const RI = componerEntregaInventario({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_INVENTARIO });
ok(RI.ok, "la Entrega de inventario se compuso (ningún hecho declarado quedó sin verificar)", RI.motivo);
ok(!!RI.texto && RI.texto.length > 200, `el texto tiene contenido (${RI.texto ? RI.texto.length : 0} caracteres)`);
ok(!!RI.libro && RI.libro.hechos.every((h) => h.ok), "TODOS los hechos del libro verifican (ok === true)", RI.libro ? RI.libro.hechos.filter((h) => !h.ok).map((h) => h.id).join(",") : "");
ok(camposFaltantes(RI.entrega).length === 0, "la Entrega compuesta tiene la forma completa", camposFaltantes(RI.entrega).join(", "));
ok(RI.entrega.respuesta.length >= 3, `Respuesta trae ${RI.entrega.respuesta.length} oraciones-hecho (≥ 3)`);
ok(RI.entrega.cifras.filas.length >= 2, `Cifras trae ${RI.entrega.cifras.filas.length} filas (≥ 2, incluye el subtotal)`);
ok(RI.entrega.limites.length >= 3, `Lo que no se puede concluir trae ${RI.entrega.limites.length} hallazgos (≥ 3)`);

console.log("\n── la Entrega de inventario (texto completo) ──\n");
console.log(RI.texto);
console.log("");

const VI = verificarEntrega(RI);
ok(VI.ok, `verificarEntrega sobre la ruta de inventario: 0 violaciones (${VI.violaciones.length})`, VI.violaciones.map((x) => `${x.regla}: ${x.detalle}`).join("\n      "));
{
  // la LEY DURA: venta comercial e inventario NUNCA se suman — declarado como límite, leyendo reconcilian()
  ok(RI.entrega.limites.some((l) => /universos distintos/i.test(l.titulo)), "el límite «venta comercial e inventario son universos distintos» está declarado");
  const cruce = reconcilian("inventario", "venta_comercial");
  ok(cruce.estado !== "reconciled", `reconcilian(inventario, venta_comercial) sigue sin reconciliar (hoy: ${cruce.estado}) — la Entrega lo respeta`);
}
{
  // carnada I · regla 10 (registro), sobre la TERCERA ruta
  const rotaI = { ...RI, texto: RI.texto.replace("El mayor es", "Che, mirá vos, el mayor es") };
  const vI = verificarEntrega(rotaI);
  ok(!vI.ok && vI.violaciones.some((x) => x.regla === "registro-informal"), "carnada I (coloquialismo, ruta de inventario) → verificarEntrega la caza (registro-informal)", JSON.stringify(vI.violaciones));
}
{
  // carnada J · regla 1 (cifras-desnudas) sobre la tercera ruta
  const rotaJ = { ...RI, texto: RI.texto + "\n\nEn total hay $9.999K frenados." };
  const vJ = verificarEntrega(rotaJ);
  ok(!vJ.ok && vJ.violaciones.some((x) => x.regla === "cifras-desnudas"), "carnada J (cifra inventada pegada, ruta de inventario) → verificarEntrega la caza (cifras-desnudas)", JSON.stringify(vJ.violaciones));
}

/* ═══ 8 · TAREA 3 (owner 2026-09-23, incremento 3) — LA IMPORTANTE: el encargo multidominio ═══
 * «¿qué debería preocuparme primero?» sobre una lectura ejecutiva de los tres dominios (comercial + inventario +
 * cobranza). Reusa `partesDelEncargo.js`/`contratoDeDominios.js`/`prioridadIntegrada.js` — no se escribe otra
 * prioridad. Dos candados NUEVOS y permanentes (instrucción del owner):
 *   1 · una Entrega multidominio que OMITE un dominio pedido se pone roja (`verificarEntrega` regla 11,
 *       «cobertura-de-dominios», sobre `coberturaDelEncargo` — partesDelEncargo.js).
 *   2 · ninguna cifra de dos universos/dominios distintos aparece SUMADA — no por una regla nueva del
 *       verificador, sino porque `notario/hechos.js` (`_derivada`, op «suma») ya rechaza como no-verificable
 *       cualquier hecho que sume figs de dominios distintos (misma verificación que corre para CADA hecho de
 *       CUALQUIER ruta, regla 9). Acá se prueba con una carnada directa sobre `libroDeHechos`. */
H("8 · componerEntregaMultidominio — el cruce de los tres dominios, cerrado con la prioridad integrada");
const RM = componerEntregaMultidominio({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_MULTIDOMINIO });
ok(RM.ok, "la Entrega multidominio se compuso (ningún hecho declarado quedó sin verificar)", RM.motivo);
ok(!!RM.texto && RM.texto.length > 200, `el texto tiene contenido (${RM.texto ? RM.texto.length : 0} caracteres)`);
ok(!!RM.libro && RM.libro.hechos.every((h) => h.ok), "TODOS los hechos del libro verifican (ok === true)", RM.libro ? RM.libro.hechos.filter((h) => !h.ok).map((h) => h.id).join(",") : "");
ok(camposFaltantes(RM.entrega).length === 0, "la Entrega compuesta tiene la forma completa", camposFaltantes(RM.entrega).join(", "));
ok(Array.isArray(RM.dominios) && RM.dominios.length === 3, `los tres dominios participan: ${RM.dominios ? RM.dominios.join(", ") : "(ninguno)"}`);
ok(Array.isArray(RM.partes) && RM.partes.length >= 2, `partesDelEncargo() reconoció ${RM.partes ? RM.partes.length : 0} partes pedidas`);

console.log("\n── la Entrega multidominio (texto completo) ──\n");
console.log(RM.texto);
console.log("");

const VM = verificarEntrega({ ...RM, partes: RM.partes });
ok(VM.ok, `verificarEntrega sobre la ruta multidominio: 0 violaciones (${VM.violaciones.length})`, VM.violaciones.map((x) => `${x.regla}: ${x.detalle}`).join("\n      "));
{
  // EL CASO PERMANENTE (CLAUDE.md, «la prioridad integrada por señales»): Lider antes que Falabella — mismo
  // prompt de producción, misma boleta real del tenant demo
  ok(/Lider/.test(RM.texto) && /Falabella/.test(RM.texto), "las dos cuentas del caso permanente aparecen (Lider · Falabella)");
  const parrafoPrioridad = RM.entrega.respuesta.find((r) => /Prioridad del procedimiento/i.test(r.texto));
  ok(!!parrafoPrioridad && /Lider/.test(parrafoPrioridad.texto), "el párrafo de «Prioridad del procedimiento» nombra primero a Lider (el caso permanente)");
}
{
  // CANDADO 1 · cobertura de dominios — una Entrega que omite un dominio pedido se pone roja
  const sinInventario = RM.texto.split("\n").filter((l) => !/inventario|frenad|d[ií]as de inventario|d[ií]as sin venta/i.test(l)).join("\n");
  const vSinInventario = verificarEntrega({ texto: sinInventario, entrega: RM.entrega, partes: RM.partes });
  ok(!vSinInventario.ok && vSinInventario.violaciones.some((x) => x.regla === "cobertura-de-dominios"), "carnada K · quitar toda mención a inventario → «cobertura-de-dominios» se enciende (rojo)", JSON.stringify(vSinInventario.violaciones));
  ok(!VM.violaciones.some((x) => x.regla === "cobertura-de-dominios"), "control · el texto real (los tres dominios presentes) NO dispara «cobertura-de-dominios»");
}
{
  // control · una Entrega de UN SOLO dominio (brecha comercial) no paga la regla 11 — `partes` no se pasa
  ok(!V.violaciones.some((x) => x.regla === "cobertura-de-dominios"), "control · la ruta de brecha comercial (sin `partes`) no paga la regla de cobertura de dominios");
}
{
  // CANDADO 2 · ninguna cifra de dos universos distintos aparece sumada — carnada directa sobre libroDeHechos
  // (la MISMA verificación de `_derivada` que ya corre para cada hecho declarado por CUALQUIER ruta)
  const figsCarnada = asignarIds([
    { label: "LG-DRYER8KG · Capital frenado", value: "$14K", raw: 13600, unit: "money" },
    { label: "Lider · Saldo vencido", value: "$4.6M", raw: 4600000, unit: "money" },
  ]);
  const Ic = indiceDeEvidencia({ figs: figsCarnada, datoProyectado: null, ejesDelTenant: {} });
  const hechosCarnada = [
    { id: "e1", tipo: "ref", de: figsCarnada[0].id },
    { id: "e2", tipo: "ref", de: figsCarnada[1].id },
    { id: "e3", tipo: "derivada", op: "suma", de: ["e1", "e2"] },
  ];
  const libroCarnada = libroDeHechos(hechosCarnada, { indice: Ic });
  const h3 = libroCarnada.porId.get("e3");
  ok(!!h3 && h3.ok === false && /dominios-distintos/.test(h3.motivo || ""), "carnada L · un hecho «derivada» que suma inventario + cobranza sale no-verificable (dominios-distintos)", h3 ? h3.motivo : "(sin hecho e3)");
}
{
  // carnada M · regla 10 (registro), sobre la CUARTA ruta — mismo voseo que ya certifican las carnadas E/G
  const rotaM = { ...RM, texto: RM.texto.replace("Prioridad del procedimiento", "Che, vos fijate. Prioridad del procedimiento") };
  const vM = verificarEntrega({ ...rotaM, partes: RM.partes });
  ok(!vM.ok && vM.violaciones.some((x) => x.regla === "registro-informal"), "carnada M (coloquialismo, ruta multidominio) → verificarEntrega la caza (registro-informal)", JSON.stringify(vM.violaciones));
}

/* ═══ 9 · LA BANDERA — apagada bajo Node, el camino de producción no cambia ═══ */
H("9 · ADI_ENTREGA — apagada en el piso (Node/gates), byte-exacto");
ok(ADI_ENTREGA === false, `ADI_ENTREGA === false bajo Node (piso) — hoy: ${ADI_ENTREGA}`);

console.log(`\n── _entrega_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
