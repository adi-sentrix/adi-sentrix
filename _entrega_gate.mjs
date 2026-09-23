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
import { libroDeHechos, asignarIds, peorProcedencia, procedenciaDe, PROCEDENCIAS, NOMBRE_DE_PROCEDENCIA, validarUniverso } from "./src/adi/notario/hechos.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { AUSENCIAS_DEL_DATO, TIPOS_DE_AUSENCIA, ausenciasDe, limitesDeAusencias, ausenciaPorId } from "./src/config/contract/ausencias.js";
import { fig } from "./src/adi/boleta.js";   // SOLO se llama (nunca se edita — boleta.js está en la lista de "no tocar"): carnadas N/P/Q necesitan figs con `.tipo` real
import { construirPerfilCliente, perfilAutorizaConocimiento, seleccionarConocimientoDelOficio, CAMPOS_DEL_PERFIL, CATALOGO_CONOCIMIENTO_DEL_OFICIO, perfilEmpresaDesdeFilaTenant } from "./src/config/contract/perfilCliente.js";
import { persistirCarga, activarVersion, monedaTenant, declararPerfilEmpresa } from "./src/ingesta/persistirCarga.server.js";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";
import { packActivo } from "./src/data/tenantService.server.js";
// TAREA 1+2 (owner 2026-09-23) — bandas de tamaño y siembra de la taxonomía
import { calcularBandaTamano, bandaPorUF, UMBRALES_UF, periodoDeclaradoDe, mesesInformadosDe, TAMANO_BANDAS as TAMANO_BANDAS_DE_BANDATAMANO } from "./src/config/contract/bandaTamano.js";
import { ufDelPeriodo, TABLA_UF } from "./src/config/contract/tablaUF.js";
import { TAXONOMIA_PERFIL, SECTORES, TIPOS_PRODUCTO, SECTORES_CON_TIPO_PRODUCTO, MODELOS_COMERCIALES, PAISES, TAMANO_BANDAS, codigoValido, validarTipoProductoDeSector } from "./src/config/contract/taxonomiaPerfil.js";
import fs from "node:fs";

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

/* ═══ 10 · ETAPA 2 §1 (owner 2026-09-23) — LA PROCEDENCIA, como campo del hecho ═══════════════════════════════
 * `notario/hechos.js` declara PROCEDENCIAS (medido·derivado·estimacion_referencia·supuesto_usuario·propuesta) y
 * calcula `H.procedencia` para cada hecho; `entrega/componer.js` la sube a la columna "Tipo" de Cifras
 * (`_textoDeTipo`), leyendo el campo — nunca al revés. Acá se verifica el campo Y dos carnadas reales sobre
 * `peorProcedencia` (la regla del owner: «una derivada hereda la peor procedencia de sus insumos»). */
H("10 · la procedencia — campo del hecho, no texto a mano (Etapa 2 §1)");
{
  ok(JSON.stringify(PROCEDENCIAS) === JSON.stringify(["medido", "derivado", "estimacion_referencia", "supuesto_usuario", "propuesta"]), "PROCEDENCIAS trae las cinco categorías del owner, en el orden declarado", JSON.stringify(PROCEDENCIAS));
  for (const p of PROCEDENCIAS) ok(!!NOMBRE_DE_PROCEDENCIA[p], `NOMBRE_DE_PROCEDENCIA trae texto para «${p}»`);
  // brecha comercial: cifras medidas (venta, margen) vs. una brecha contra el benchmark declarado (estimación)
  const filaTop = R.entrega.cifras.filas[0];
  ok(filaTop.procedencia === "estimacion_referencia", `la fila del cliente prioritario (brecha comercial) es «estimacion_referencia» (hoy: ${filaTop.procedencia}) — la contribución no capturada es una brecha contra el benchmark, la peor de venta+margen+brecha`, JSON.stringify(filaTop));
  const filaTotalBrecha = R.entrega.cifras.filas.find((f) => /^Total/.test(f.valores.Cliente || ""));
  ok(filaTotalBrecha && filaTotalBrecha.procedencia === "estimacion_referencia", "el subtotal de la brecha comercial también es «estimacion_referencia» (hereda de la fig que cita)", filaTotalBrecha ? filaTotalBrecha.procedencia : "(sin fila)");
  // cobranza: saldo/vencido por cliente son LECTURA DIRECTA (medido); el total es una SUMA del motor (derivado)
  const filaTopCobranza = RC.entrega.cifras.filas[0];
  ok(filaTopCobranza.procedencia === "medido", `la fila del deudor prioritario es «medido» (hoy: ${filaTopCobranza.procedencia}) — saldo y vencido son lectura directa de la mesa de cobranza`, JSON.stringify(filaTopCobranza));
  const filaTotalCobranza = RC.entrega.cifras.filas.find((f) => /^Total/.test(f.valores.Cliente || ""));
  ok(filaTotalCobranza && filaTotalCobranza.procedencia === "derivado", "el subtotal de cobranza («Total cartera») es «derivado» (es una suma del motor, no un campo de la fuente)", filaTotalCobranza ? filaTotalCobranza.procedencia : "(sin fila)");
  // inventario: capital/días/rotación por SKU son campos de la fuente (medido); el total frenado es una suma
  const filaTopInv = RI.entrega.cifras.filas[0];
  ok(filaTopInv.procedencia === "medido", `la fila del SKU prioritario es «medido» (hoy: ${filaTopInv.procedencia})`, JSON.stringify(filaTopInv));
  const filaTotalInv = RI.entrega.cifras.filas.find((f) => /^Total/.test(f.valores.SKU || ""));
  ok(filaTotalInv && filaTotalInv.procedencia === "derivado", "el subtotal de inventario es «derivado»", filaTotalInv ? filaTotalInv.procedencia : "(sin fila)");
}
{
  // CARNADA N · «una derivada hereda la PEOR procedencia de sus insumos» — una razón entre un hecho «medido» y
  // uno «estimacion_referencia» tiene que salir «estimacion_referencia», sin importar el orden de los operandos.
  // Las figs se arman con `fig()` (boleta.js — SOLO se llama, nunca se edita) para que traigan `.tipo` real: una
  // fig de {label,value,raw,unit} a mano, sin pasar por `fig()`, no tiene `.tipo` y la procedencia cae al default
  // conservador ("derivado"), que no es lo que esta carnada necesita probar.
  const figsCarnada = asignarIds([
    fig("Demo · Venta", "$10K", { unit: "money", raw: 10000 }),
    fig("Demo · Contribución no capturada", "$2K", { unit: "money", raw: 2000 }),
  ]);
  const Ip = indiceDeEvidencia({ figs: figsCarnada, datoProyectado: null, ejesDelTenant: {} });
  const hechosCarnada = [
    { id: "e1", tipo: "ref", de: figsCarnada[0].id },
    { id: "e2", tipo: "ref", de: figsCarnada[1].id },
    { id: "e3", tipo: "razon", num: { id: "e1" }, den: { id: "e2" }, forma: "veces" },
  ];
  const libroCarnada = libroDeHechos(hechosCarnada, { indice: Ip });
  const h1 = libroCarnada.porId.get("e1"), h2 = libroCarnada.porId.get("e2"), h3 = libroCarnada.porId.get("e3");
  ok(h1 && h1.procedencia === "medido", `carnada N · «Venta» (lectura directa) es «medido» (hoy: ${h1 && h1.procedencia})`);
  ok(h2 && h2.procedencia === "estimacion_referencia", `carnada N · «Contribución no capturada» (brecha) es «estimacion_referencia» (hoy: ${h2 && h2.procedencia})`);
  ok(h3 && h3.ok && h3.procedencia === "estimacion_referencia", `carnada N · la razón entre ambos hereda la PEOR (estimacion_referencia), no la mejor (hoy: ${h3 && h3.procedencia})`, JSON.stringify(h3 && h3.procedencia));
  // orden inverso: mismo resultado — «peor» no depende de quién es el numerador
  ok(peorProcedencia("medido", "estimacion_referencia") === "estimacion_referencia" && peorProcedencia("estimacion_referencia", "medido") === "estimacion_referencia", "carnada N · peorProcedencia es conmutativa (no depende del orden de los argumentos)");
  ok(peorProcedencia("medido", "derivado", "propuesta", "estimacion_referencia") === "propuesta", "carnada N · peorProcedencia con varios insumos elige la más débil de todas (propuesta)");
  ok(peorProcedencia() === null && peorProcedencia(null, undefined) === null, "carnada N · sin insumos válidos, null (nunca inventa una procedencia)");
}

/* ═══ 11 · ETAPA 2 §2 (owner 2026-09-23) — LAS AUSENCIAS, declaradas como dato ═══════════════════════════════ */
H("11 · las ausencias del dato — catálogo declarado (Etapa 2 §2)");
{
  ok(Array.isArray(AUSENCIAS_DEL_DATO) && AUSENCIAS_DEL_DATO.length >= 15, `AUSENCIAS_DEL_DATO trae ${AUSENCIAS_DEL_DATO.length} entradas (≥ 15: las 11 de siempre + 4 «conocimiento del sector»)`);
  const ids = AUSENCIAS_DEL_DATO.map((a) => a.id);
  ok(new Set(ids).size === ids.length, "cada ausencia tiene un id único");
  ok(AUSENCIAS_DEL_DATO.every((a) => TIPOS_DE_AUSENCIA.includes(a.tipo)), "cada ausencia declara un tipo de TIPOS_DE_AUSENCIA", AUSENCIAS_DEL_DATO.filter((a) => !TIPOS_DE_AUSENCIA.includes(a.tipo)).map((a) => a.id).join(","));
  ok(AUSENCIAS_DEL_DATO.every((a) => ["comercial", "inventario", "cobranza", "general"].includes(a.dominio)), "cada ausencia declara un dominio del vocabulario del negocio");
  // BYTE-IDÉNTICO al `_HUECOS` que traía `datoProyectado.js` ANTES de esta tarea (medido con `_sonda_huecos_byte_identico.mjs`) — el prompt del narrador, que corre en producción, no cambia un byte.
  const _HUECOS_ORIGINAL = [
    "historial de compra cliente×SKU: NO existe. La relación cliente×SKU disponible es una AFINIDAD ESTIMADA (sellada `indicado`), nunca una venta registrada — «quiénes dejaron de comprar» no es respondible.",
    "entradas y recepciones de inventario: NO existen — «entradas y salidas» no es dibujable ni narrable.",
    "lead time de proveedor: NO existe — no se puede decir qué se quiebra antes de que llegue reposición.",
    "estado de órdenes de compra: NO existe.",
    "causa de la detención de un SKU: NO está en el dato — se localiza dónde, no por qué.",
    "meta de rotación por familia: NO existe.",
    "ningún SKU está en más de una bodega — transferir stock entre bodegas NO es evaluable con este dato.",
    "serie a futuro / pronóstico: NO existe — solo la evolución hasta hoy.",
    "resultado (después de gastos) POR MES: NO existe — los gastos son % sobre la venta anual.",
    "la META no existe en este dato: el benchmark lo declara el cliente y benchmark ≠ promedio ≠ meta.",
    "fuente sectorial autorizada: NO hay — la única referencia es la del propio negocio (su benchmark declarado).",
  ];
  const huecosNuevo = AUSENCIAS_DEL_DATO.filter((a) => a.enPrompt).map((a) => a.texto);
  ok(JSON.stringify(huecosNuevo) === JSON.stringify(_HUECOS_ORIGINAL), "datoProyectado._HUECOS (reconstruido por `enPrompt`) es BYTE-IDÉNTICO al que corría en producción antes de esta tarea", huecosNuevo.length !== _HUECOS_ORIGINAL.length ? `${huecosNuevo.length} vs ${_HUECOS_ORIGINAL.length}` : huecosNuevo.map((h, i) => h === _HUECOS_ORIGINAL[i] ? null : `[${i}] ${h}`).filter(Boolean).join(" | "));
  // la MISMA ausencia, declarada UNA vez, usada en las cuatro rutas — cada Entrega trae el límite que corresponde a SU dominio, sacado del catálogo
  const lb = R.entrega.limites.find((l) => l.titulo === "Sin conocimiento del sector cargado todavía");
  ok(!!lb && lb.motivo === ausenciaPorId("conocimiento_sector_comercial").entrega.motivo, "brecha comercial sirve el límite del catálogo (conocimiento_sector_comercial), no un string aparte");
  const lbC = RC.entrega.limites.find((l) => l.titulo === "Sin conocimiento del sector cargado todavía");
  ok(!!lbC && lbC.motivo === ausenciaPorId("conocimiento_sector_cobranza").entrega.motivo, "cobranza sirve el límite del catálogo (conocimiento_sector_cobranza)");
  const lbI = RI.entrega.limites.find((l) => l.titulo === "Sin conocimiento del sector cargado todavía");
  ok(!!lbI && lbI.motivo === ausenciaPorId("conocimiento_sector_inventario").entrega.motivo, "inventario sirve el límite del catálogo (conocimiento_sector_inventario)");
  const lbM = RM.entrega.limites.find((l) => l.titulo === "Sin conocimiento del sector cargado todavía");
  ok(!!lbM && lbM.motivo === ausenciaPorId("conocimiento_sector_general").entrega.motivo, "multidominio sirve el límite del catálogo (conocimiento_sector_general)");
  // los CUATRO motivos son DISTINTOS entre sí — la centralización no aplanó la especificidad por dominio
  const motivos = new Set([lb.motivo, lbC.motivo, lbI.motivo, lbM.motivo]);
  ok(motivos.size === 4, "los cuatro motivos siguen siendo específicos por dominio (no se fusionaron en uno genérico)");
}
{
  // CARNADA O · un id que no existe en el catálogo no revienta — declara ausencia de ausencia, no inventa una
  ok(ausenciaPorId("esto-no-existe") === null, "carnada O · ausenciaPorId(id-inexistente) → null, nunca inventa una entrada");
  ok(Array.isArray(ausenciasDe("dominio-inexistente")) && ausenciasDe("dominio-inexistente").every((a) => a.dominio === "general"), "carnada O · ausenciasDe(dominio-inexistente) solo devuelve las «general» (nunca revienta, nunca inventa dominio)");
  ok(limitesDeAusencias([]).every((a) => a.dominio !== "comercial" && a.dominio !== "inventario" && a.dominio !== "cobranza"), "carnada O · limitesDeAusencias([]) — sin dominios, solo las ausencias «general»");
}

/* ═══ 12 · ETAPA 2 §3 (owner 2026-09-23) — EL UNIVERSO, como objeto con identidad ═══════════════════════════════ */
H("12 · el universo — objeto con identidad (eje·entidades·filtros·período), Etapa 2 §3");
{
  for (const [nombre, RR] of [["brecha comercial", R], ["cobranza", RC], ["inventario", RI], ["multidominio", RM]]) {
    ok(Array.isArray(RR.entrega.universos) && RR.entrega.universos.length >= 1, `${nombre}: entrega.universos trae ${RR.entrega.universos ? RR.entrega.universos.length : 0} objeto(s) (≥ 1)`);
    ok(RR.entrega.universos.every((u) => u.valido === true), `${nombre}: todos los universos declarados VALIDAN contra el índice del turno (validarUniverso)`, JSON.stringify(RR.entrega.universos.filter((u) => !u.valido)));
    ok(RR.entrega.universos.every((u) => u.eje && Array.isArray(u.entidades) && typeof u.texto === "string" && u.texto), `${nombre}: cada universo trae eje, entidades y texto (identidad completa)`);
  }
  ok(R.entrega.universos[0].eje === "cliente" && R.entrega.universos[0].top && R.entrega.universos[0].top.metrica === "no_capturada", "brecha comercial: el universo es «cliente», rankeado por contribución no capturada");
  ok(RC.entrega.universos[0].eje === "cliente" && RC.entrega.universos[0].top && RC.entrega.universos[0].top.metrica === "saldo_vencido", "cobranza: el universo es «cliente», rankeado por saldo vencido");
  ok(RI.entrega.universos[0].eje === "sku" && RI.entrega.universos[0].top && RI.entrega.universos[0].top.metrica === "capital_frenado", "inventario: el universo es «sku», rankeado por capital frenado");
  ok(RM.entrega.universos.some((u) => u.eje === "sku") && RM.entrega.universos.some((u) => u.eje === "cliente"), "multidominio: hay universos de DOS ejes distintos (cliente para comercial/cobranza, sku para inventario) — no todos los dominios comparten identidad");
}
{
  // CARNADA P · un eje DESCONOCIDO (que no es del vocabulario EJES_VALIDOS) tiene que fallar la validación —
  // `validarUniverso` no es un rubber-stamp: de verdad rechaza un universo mal formado.
  const Ireal = R.libro.indice;
  const err = validarUniverso({ eje: "planeta" }, Ireal);
  ok(typeof err === "string" && err.length > 0, "carnada P · un universo con un eje inventado («planeta») NO valida (validarUniverso devuelve el error)", String(err));
  // CARNADA Q · un eje del vocabulario pero SIN entidades en la evidencia de este turno (índice vacío) también falla
  const Ivacio = indiceDeEvidencia({ figs: [], datoProyectado: null, ejesDelTenant: {} });
  const err2 = validarUniverso({ eje: "canal" }, Ivacio);
  ok(typeof err2 === "string" && err2.length > 0, "carnada Q · un universo de un eje sin entidades en la evidencia del turno NO valida", String(err2));
  // control negativo · el universo REAL que declaró la ruta 1 sigue validando limpio (las carnadas de arriba cazan lo roto, no todo)
  const okReal = validarUniverso({ eje: "cliente", top: { metrica: "no_capturada", k: 2, direccion: "mayor" } }, Ireal);
  ok(okReal === null, "control · el universo real de la brecha comercial sigue validando limpio (null = sin error)", String(okReal));
  // ⚠️ HALLAZGO (no corregido acá — fuera del alcance de esta tarea, ver el informe): `validarUniverso` valida
  // `top.k`/`top.direccion`/`top.metrica` (que exista y no sea vacía) pero NO valida que `top.metrica` sea una
  // CLAVE de la casa (sí lo hace para `filtros[].metrica` y `excluir.top[].metrica`) — un universo con
  // `top:{metrica:"esto-no-existe",k:2,direccion:"mayor"}` valida limpio hoy. Medido con esta misma carnada
  // (antes de corregirla para probar lo que sí está cubierto): no es un defecto de esta tarea, es un hueco
  // preexistente del validador general de Notario v3 que esta tarea encontró al usarlo para universos de Entrega.
  const errTopMetricaInventada = validarUniverso({ eje: "cliente", top: { metrica: "esto-no-es-una-metrica-de-la-casa", k: 2, direccion: "mayor" } }, Ireal);
  ok(errTopMetricaInventada === null, "hallazgo declarado · validarUniverso NO valida top.metrica contra el catálogo (a diferencia de filtros[].metrica) — documentado en el informe, no corregido en esta tarea", "ver _ADI_LLMBUSINESS_PLAN.md / el informe de esta etapa");
}

/* ═══ 13 · ETAPA 2 §4 (owner 2026-09-23) — EL PERFIL DEL CLIENTE, plan §3 «cómo se pega al cliente» ══════════════ */
H("13 · perfilCliente.js — el perfil, falla cerrado, sobre TENANT_DEMO real (no un tenant inventado)");
{
  const perfil = construirPerfilCliente(TENANT_DEMO);
  ok(!!perfil && perfil.empresa && perfil.empresa.nombre === "ADI Demo" && perfil.empresa.id === "demo", "el perfil trae la identidad real del tenant (id/nombre), no inventada", JSON.stringify(perfil && perfil.empresa));
  ok(Array.isArray(CAMPOS_DEL_PERFIL) && CAMPOS_DEL_PERFIL.length === 6, "los seis campos del plan §3: sector · tipoProducto · tamaño · país · moneda · modelo comercial", CAMPOS_DEL_PERFIL.join(","));

  // LO QUE SÍ ESTÁ DECLARADO HOY, medido: la moneda (TENANT_DEMO.perfil.moneda = "CLP", demo.js línea 449)
  ok(perfil.campos.moneda.valor === "CLP" && perfil.campos.moneda.procedencia === "medido", "moneda: declarada por el tenant (\"medido\") — el ÚNICO campo con valor hoy", JSON.stringify(perfil.campos.moneda));

  // LO QUE ES DERIVABLE EN VALOR pero no en banda: la venta anual real (ventasKPI.totalActual × factorComercialDe)
  const ventaEsperada = Math.round(TENANT_DEMO.ventasKPI.totalActual * 1e3);   // demo declara escalaComercial "K"
  ok(perfil.campos.tamano.ventaAnual.valor === ventaEsperada && perfil.campos.tamano.ventaAnual.procedencia === "derivado", `tamaño: la venta anual real se DERIVA (${perfil.campos.tamano.ventaAnual.valor} — ventasKPI.totalActual × factorComercialDe)`, JSON.stringify(perfil.campos.tamano.ventaAnual));
  // CORRECCIÓN (owner 2026-09-23) — «el período real del demo»: TENANT_DEMO YA declara
  // `.hechos.parametros.periodo_actual` ("2025-12-31", con la evidencia del propio archivo — ver el comentario en
  // `data/tenants/demo.js` junto a `hechos`), por la MISMA vía que un cliente real. La banda ahora SÍ se calcula
  // de punta a punta sobre el tenant real, no solo en un caso fabricado — la cadena completa (con carnada extra)
  // se re-verifica en la sección 17c.
  ok(perfil.campos.tamano.valor === "pequena", `★ CADENA REAL · TENANT_DEMO con período declarado → banda "pequena" (hoy: ${perfil.campos.tamano.valor})`, JSON.stringify(perfil.campos.tamano));
  ok(perfil.campos.tamano.insumos && perfil.campos.tamano.insumos.periodo === "2025-12", "…el insumo `periodo` es el mes de CIERRE de la venta/P&L («2025-12-31» recortado a «2025-12»)", perfil.campos.tamano.insumos && perfil.campos.tamano.insumos.periodo);

  // LO QUE NO EXISTE Y SE DECLARA AUSENTE, no adivinado — sector/tipoProducto/país/modelo comercial
  for (const c of ["sector", "tipoProducto", "pais", "modeloComercial"]) {
    ok(perfil.campos[c].valor === null && perfil.campos[c].procedencia === null && typeof perfil.campos[c].motivo === "string" && perfil.campos[c].motivo.length > 0, `${c}: ausente, declarado con motivo (no null a secas)`, JSON.stringify(perfil.campos[c]));
  }

  // EL PERFIL DE TENANT_DEMO SIGUE INCOMPLETO (sector/tipoProducto/país/modelo comercial faltan; tamaño y moneda
  // YA están) — la realidad de HOY, no un caso de prueba fabricado.
  ok(perfil.completo === false, "TENANT_DEMO: perfil.completo === false (faltan 4 de 6 campos — tamaño y moneda ya no faltan)");
  ok(Array.isArray(perfil.faltantes) && perfil.faltantes.length === 4 && perfil.faltantes.includes("moneda") === false && perfil.faltantes.includes("tamano") === false, `perfil.faltantes trae ${perfil.faltantes.length} campo(s), ni moneda ni tamaño están entre ellos`, perfil.faltantes.join(","));
}
{
  // sobre un tenant VACÍO (sin ventasKPI, sin perfil.moneda) — no revienta, declara todo ausente
  const perfilVacio = construirPerfilCliente({});
  ok(perfilVacio.completo === false && perfilVacio.faltantes.length === 6, "tenant vacío ({}) → perfil.completo === false, los seis campos faltantes, sin reventar", JSON.stringify(perfilVacio.faltantes));
  ok(perfilVacio.empresa.id === null && perfilVacio.empresa.nombre === null, "tenant vacío → identidad null, no inventada");
}

H("13b · perfilAutorizaConocimiento / seleccionarConocimientoDelOficio — FALLA CERRADO, con carnadas reales");
{
  const perfilIncompleto = construirPerfilCliente(TENANT_DEMO);
  const perfilCompletoFalso = { ...perfilIncompleto, completo: true, faltantes: [] };   // SOLO para la carnada — nunca así en producción

  ok(perfilAutorizaConocimiento(perfilIncompleto) === false, "perfilAutorizaConocimiento(incompleto) === false");
  ok(perfilAutorizaConocimiento(perfilCompletoFalso) === true, "perfilAutorizaConocimiento(completo) === true — la función SÍ distingue, no es un false-siempre disfrazado");
  ok(perfilAutorizaConocimiento(null) === false && perfilAutorizaConocimiento(undefined) === false, "perfilAutorizaConocimiento(null/undefined) === false, no revienta");

  // CARNADA R · el catálogo real está vacío hoy, así que esto solo prueba «no revienta con lo real» — la carnada
  // de verdad es la siguiente (con un catálogo FALSO no vacío).
  ok(Array.isArray(CATALOGO_CONOCIMIENTO_DEL_OFICIO) && CATALOGO_CONOCIMIENTO_DEL_OFICIO.length === 0, "CATALOGO_CONOCIMIENTO_DEL_OFICIO está vacío (Etapa 3 no construida) — real, no un placeholder con forma de contenido");
  ok(seleccionarConocimientoDelOficio(perfilIncompleto).length === 0, "con el catálogo real (vacío): selector da [] sobre TENANT_DEMO");

  // CARNADA S · LA CANDADO DE VERDAD: un catálogo FALSO con un ítem que "calzaría perfecto" — con perfil
  // INCOMPLETO tiene que dar [] IGUAL, sin que importe qué traiga el catálogo. Si este assert diera roja, el
  // «falla cerrado» del plan §3 estaría roto: el candado se pone rojo de verdad si alguien cambia `<=` por `<`
  // o borra el `if` de `perfilAutorizaConocimiento` dentro de `seleccionarConocimientoDelOficio`.
  const catalogoFalso = [{ id: "carnada-benchmark-sector", texto: "un ítem que calzaría perfecto si el perfil estuviera completo" }];
  const conPerfilIncompleto = seleccionarConocimientoDelOficio(perfilIncompleto, catalogoFalso);
  ok(Array.isArray(conPerfilIncompleto) && conPerfilIncompleto.length === 0, "CARNADA S · catálogo FALSO con contenido + perfil INCOMPLETO → [] de todas formas (falla cerrado real, no de fachada)", JSON.stringify(conPerfilIncompleto));

  // control negativo de la carnada: con perfil COMPLETO (falso, solo para probar que el candado no es un
  // false-siempre) el MISMO catálogo falso SÍ pasa — si esto diera roja, `seleccionarConocimientoDelOficio`
  // estaría bloqueando todo siempre, lo cual sería tan falso como no bloquear nunca.
  const conPerfilCompleto = seleccionarConocimientoDelOficio(perfilCompletoFalso, catalogoFalso);
  ok(Array.isArray(conPerfilCompleto) && conPerfilCompleto.length === 1 && conPerfilCompleto[0].id === "carnada-benchmark-sector", "control · con perfil COMPLETO (falso) el mismo catálogo SÍ pasa — el candado discrimina, no bloquea siempre", JSON.stringify(conPerfilCompleto));
}

H("13c · el Marco de la Entrega REAL trae el perfil y su límite — las cuatro rutas, TENANT_DEMO");
{
  for (const [nombre, RR] of [["brecha comercial", R], ["cobranza", RC], ["inventario", RI], ["multidominio", RM]]) {
    ok(RR.entrega.marco.empresa === "ADI Demo", `${nombre}: marco.empresa === "ADI Demo" (antes viajaba null siempre)`, String(RR.entrega.marco.empresa));
    ok(!!RR.entrega.marco.perfil && RR.entrega.marco.perfil.completo === false, `${nombre}: marco.perfil viaja, completo === false sobre TENANT_DEMO`);
    ok(RR.entrega.marco.perfil.campos.moneda.valor === "CLP", `${nombre}: marco.perfil.campos.moneda.valor === "CLP"`);
    ok(Array.isArray(RR.entrega.referenciaDelOficio) && RR.entrega.referenciaDelOficio.length === 0, `${nombre}: referenciaDelOficio sigue [] (catálogo vacío) — el enganche no cambia el comportamiento de hoy`);
    const lim = RR.entrega.limites.find((l) => l && l.titulo === "Sin perfil completo del cliente todavía");
    ok(!!lim && /moneda/i.test(lim.motivo) === false && /sector/i.test(lim.motivo), `${nombre}: el límite "perfil incompleto" está presente y nombra los campos que faltan (no "moneda", que SÍ está declarada)`, lim ? lim.motivo : "(ausente)");
    ok(RR.texto.includes("ADI Demo"), `${nombre}: el texto de la Entrega abre el Marco con el nombre del tenant ("ADI Demo")`);
  }
  // el propio verificador (verificar.js) sigue en cero violaciones con el Marco ampliado — el perfil no rompe
  // ninguna de las ocho reglas de composición (no imprime cifras nuevas, no toca Respuesta/Cifras)
  const vR = verificarEntrega({ texto: R.texto, entrega: R.entrega });
  ok(vR.ok, "brecha comercial: verificarEntrega sigue en CERO violaciones con marco.empresa/marco.perfil poblados", JSON.stringify(vR.violaciones));
}
H("13d · ausencias.js — perfil_incompleto es un tipo nuevo, distinto de conocimiento_no_construido");
{
  ok(TIPOS_DE_AUSENCIA.includes("perfil_incompleto"), "TIPOS_DE_AUSENCIA declara \"perfil_incompleto\"");
  const a = ausenciaPorId("perfil_cliente_incompleto");
  ok(!!a && a.tipo === "perfil_incompleto" && a.dominio === "general", "ausenciaPorId(\"perfil_cliente_incompleto\") existe, tipo y dominio correctos", JSON.stringify(a));
  ok(a.id !== "conocimiento_sector_general" && a.tipo !== "conocimiento_no_construido", "distinto del hueco de CATÁLOGO (conocimiento_sector_general) — dos razones, dos ids");
}

/* ═══ 14 · CAMINO B (owner 2026-09-23, Etapa 2 §1-§4) — el perfil de empresa fuera de la plantilla ═══════════ */
H("14 · db/migraciones/012_perfil_empresa.sql — LA MIGRACIÓN ESCRITA, NO APLICADA, sobre TEXTO");
{
  const sql = fs.readFileSync("./db/migraciones/012_perfil_empresa.sql", "utf8");

  // 1 · TODAS LAS COLUMNAS EXISTEN Y SON OPCIONALES — ningún `not null`, ningún default distinto de nulo
  const COLUMNAS = ["sector_codigo", "sector_procedencia", "subsector_codigo", "subsector_procedencia",
    "pais_codigo", "pais_procedencia", "modelo_comercial_codigo", "modelo_comercial_procedencia",
    "tamano_banda_codigo", "tamano_banda_procedencia", "moneda", "moneda_procedencia"];
  for (const c of COLUMNAS) {
    const re = new RegExp(`add column if not exists ${c}\\s+text;`);
    ok(re.test(sql), `columna «${c}»: existe, tipo texto, SIN \`not null\` y sin default (opcional, nula por defecto)`);
  }
  // (acotado a las líneas `add column` de `tenants`: `perfil_taxonomia` SÍ exige `not null` en sus propias
  // columnas —campo/código del catálogo—, que es otra tabla con otra regla, no una columna nueva de `tenants`)
  const lineasAddColumn = (sql.match(/^alter table public\.tenants add column.*$/gm) || []);
  ok(lineasAddColumn.length === COLUMNAS.length && lineasAddColumn.every((l) => !/not null/i.test(l)),
    "★ ninguna columna nueva de `tenants` lleva `not null` — una empresa de hoy no pierde una fila por esto", lineasAddColumn.join("\n"));

  // 2 · LA PROCEDENCIA ES EL VOCABULARIO DEL NOTARIO, y la moneda NUNCA puede ser 'derivado' — estructural
  for (const c of ["sector", "subsector", "pais", "modelo_comercial", "tamano_banda"]) {
    ok(new RegExp(`${c}_procedencia is null or ${c}_procedencia in \\('medido', 'derivado'\\)`).test(sql),
      `${c}_procedencia: solo "medido" o "derivado" — el mismo vocabulario que notario/hechos.js:PROCEDENCIAS`);
  }
  ok(/moneda_procedencia is null or moneda_procedencia = 'medido'/.test(sql),
    "★ ley estructural: moneda_procedencia SOLO puede ser 'medido' — nunca 'derivado', ni por accidente futuro");
  ok(/moneda is null or moneda ~ '\^\[A-Z\]\{2,6\}\$'/.test(sql),
    "moneda: mismo patrón que monedaLimpia() en config/moneda.js — 2 a 6 letras mayúsculas");

  // 3 · LA TAXONOMÍA NACE VACÍA — ningún `insert into perfil_taxonomia` en el archivo
  ok(/create table if not exists public\.perfil_taxonomia/.test(sql), "la tabla de la lista autorizada existe");
  ok(!/insert into public\.perfil_taxonomia/i.test(sql), "★ CERO filas sembradas — la taxonomía la decide el owner, esta tarea no la inventa ni con un ejemplo");
  ok(/campo in \('sector', 'subsector', 'pais', 'modelo_comercial', 'tamano_banda'\)/.test(sql), "los cinco campos gobernados por taxonomía, los mismos que el plan §3 (moneda queda fuera: la valida su propio patrón, no un vocabulario del owner)");

  // 4 · EL CANDADO DE VERDAD — el trigger rechaza un código que no está en la lista, para los cinco campos
  ok(/create or replace function adi\.validar_perfil_tenant/.test(sql), "el trigger de validación existe");
  ok(/before insert or update on public\.tenants/.test(sql), "corre en INSERT y en UPDATE — una fila no puede NACER con un código inválido, ni cambiar a uno");
  for (const c of ["sector", "subsector", "pais", "modelo_comercial", "tamano_banda"]) {
    ok(new RegExp(`new\\.${c}_codigo is not null and not exists[\\s\\S]{0,160}raise exception`).test(sql),
      `★ CARNADA (estructura) · ${c}: un código no autorizado dispara \`raise exception\` — no un warning, no un silencio`);
  }

  // 5 · LA ESCRITURA VA POR UNA FUNCIÓN ACOTADA, no por una política nueva de UPDATE en `tenants`
  ok(/create or replace function public\.adi_declarar_perfil_empresa/.test(sql), "la función de escritura controlada existe");
  ok(/security definer/.test(sql) && /set search_path = public, pg_temp/.test(sql),
    "★ `security definer` con `search_path` fijado — el mismo candado de seguridad que adi.plan_actual()");
  ok(/v_tenant := adi\.tenant_actual\(\)/.test(sql) && /where id = v_tenant/.test(sql),
    "★ solo puede tocar la fila de SU PROPIO tenant (del pase firmado) — nunca un id que mande el cliente");
  ok(!/^create policy/mi.test(sql), "★ NO se crea ninguna política nueva — sigue sin haber un `create policy` en todo el archivo");
  ok(!/^\s*grant (update|insert|delete) on (table )?public\.tenants/mi.test(sql),
    "★ NO se otorga UPDATE/INSERT/DELETE directo sobre `tenants` a `adi_tenant` — sigue de solo lectura para el producto, como manda la 001; la única puerta de escritura es la función acotada");
  ok(/grant execute on function public\.adi_declarar_perfil_empresa/.test(sql), "la función queda otorgada a `adi_tenant`, si no nadie podría llamarla");

  ok(!/drop table|delete from|truncate/i.test(sql), "★ CONTROL NEGATIVO · la migración no borra nada — es puramente aditiva");
  // todo `alter table` / `create table` de este archivo toca SOLO lo que declara esta tarea — nunca
  // `fact_pack_versions`, `uploads`, `memberships` ni (por supuesto) una tabla que represente la plantilla
  const tablasTocadas = [...sql.matchAll(/^(?:alter table|create table if not exists) public\.(\w+)/gm)].map((m) => m[1]);
  ok(tablasTocadas.length > 0 && tablasTocadas.every((t) => t === "tenants" || t === "perfil_taxonomia"),
    "★ CONTROL NEGATIVO · las únicas tablas tocadas son `tenants` y `perfil_taxonomia` — ninguna otra, y ninguna representa la plantilla (que vive en código, no en la base)", tablasTocadas.join(","));
}

H("14b · perfilCliente.js — construirPerfilCliente LEE el camino B cuando existe, y sigue igual cuando no");
{
  // CONTROL: TENANT_DEMO real, sin tocar — el comportamiento de HOY no cambia ni un carácter (ya probado en la
  // sección 13, se repite acá el mínimo para dejar el contraste explícito al lado del caso nuevo).
  const perfilDemo = construirPerfilCliente(TENANT_DEMO);
  ok(perfilDemo.campos.sector.valor === null, "TENANT_DEMO (sin camino B mergeado) sigue con sector ausente — cero regresión");

  // CASO NUEVO: un tenant con el camino B ya mergeado en `perfil` (lo que packActivo haría tras leer `tenants`).
  // La banda de tamaño NO viaja acá con procedencia "medido" a propósito — con TENANT_DEMO (sin período
  // declarado) la banda calculada da null, así que se prueba aparte, sobre datos armados a mano, más abajo
  // (§17 — la sección de la tarea de bandas). Acá se prueba SOLO el resto del camino B (sector/tipoProducto/
  // país/modeloComercial), con códigos que SÍ están en la taxonomía sembrada (`taxonomiaPerfil.js`).
  const CON_CAMINO_B = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "minorista", procedencia: "medido" },
    tipoProducto: { valor: "durable", procedencia: "medido" },
    pais: { valor: "CL", procedencia: "medido" },
    modeloComercial: { valor: "comercios", procedencia: "derivado" },
  } };
  const P = construirPerfilCliente(CON_CAMINO_B);
  ok(P.campos.sector.valor === "minorista" && P.campos.sector.procedencia === "medido", "sector: leído del camino B con su procedencia", JSON.stringify(P.campos.sector));
  ok(P.campos.tipoProducto.valor === "durable", "tipoProducto: leído del camino B (sector minorista lo admite)");
  ok(P.campos.pais.valor === "CL", "país: leído del camino B (nunca derivado de la moneda: acá vino declarado)");
  ok(P.campos.modeloComercial.valor === "comercios" && P.campos.modeloComercial.procedencia === "derivado", "modelo comercial: procedencia 'derivado' se respeta tal cual");
  ok(P.campos.tamano.ventaAnual.valor === perfilDemo.campos.tamano.ventaAnual.valor, "…la venta anual REAL (derivada de ventasKPI) no cambia por el camino B: son dos cosas distintas en el mismo objeto");

  // CARNADA · procedencia inválida (fuera de {"medido","derivado"}) se trata como AUSENTE — defensa en
  // profundidad, la base ya lo rechazaría con el trigger, esto es el segundo control, no el primero.
  const CON_PROCEDENCIA_INVALIDA = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "minorista", procedencia: "estimacion_referencia" } } };
  const Pinv = construirPerfilCliente(CON_PROCEDENCIA_INVALIDA);
  ok(Pinv.campos.sector.valor === null && typeof Pinv.campos.sector.motivo === "string",
    "★ CARNADA · procedencia fuera del vocabulario del notario → el campo se trata como AUSENTE, no como dato dudoso");

  // CARNADA · TAREA 3 — un código fuera de la lista autorizada se rechaza, aunque la procedencia sea válida
  const CON_CODIGO_INVENTADO = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "comercio_retail", procedencia: "medido" } } };   // "comercio_retail" NO está en SECTORES
  const Pcod = construirPerfilCliente(CON_CODIGO_INVENTADO);
  ok(Pcod.campos.sector.valor === null, "★ CARNADA · un código fuera de la lista autorizada (\"comercio_retail\") → rechazado, tratado como ausente", JSON.stringify(Pcod.campos.sector));
  // control negativo — el mismo código, pero uno que SÍ está en la lista, pasa
  const CON_CODIGO_VALIDO = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "distribucion", procedencia: "medido" } } };
  ok(construirPerfilCliente(CON_CODIGO_VALIDO).campos.sector.valor === "distribucion", "control · un código que SÍ está en la lista (\"distribucion\") se acepta — el candado de arriba discrimina, no bloquea siempre");

  // CARNADA · TAREA 3 — tipoProducto no nulo con sector servicios/obras → rechazado (la regla de la propuesta §2)
  const CON_TIPO_PRODUCTO_EN_SERVICIOS = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "servicios", procedencia: "medido" }, tipoProducto: { valor: "durable", procedencia: "medido" } } };
  const Ptp = construirPerfilCliente(CON_TIPO_PRODUCTO_EN_SERVICIOS);
  ok(Ptp.campos.tipoProducto.valor === null && /rechazado/.test(Ptp.campos.tipoProducto.motivo), "★ CARNADA · tipoProducto declarado junto a sector \"servicios\" → rechazado", JSON.stringify(Ptp.campos.tipoProducto));
  const CON_TIPO_PRODUCTO_EN_OBRAS = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "obras", procedencia: "medido" }, tipoProducto: { valor: "insumos", procedencia: "medido" } } };
  ok(construirPerfilCliente(CON_TIPO_PRODUCTO_EN_OBRAS).campos.tipoProducto.valor === null, "★ CARNADA · tipoProducto declarado junto a sector \"obras\" → rechazado (misma regla)");
  // control negativo — el mismo tipoProducto, con un sector que SÍ lo admite, pasa
  const CON_TIPO_PRODUCTO_VALIDO = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil,
    sector: { valor: "fabricacion", procedencia: "medido" }, tipoProducto: { valor: "insumos", procedencia: "medido" } } };
  ok(construirPerfilCliente(CON_TIPO_PRODUCTO_VALIDO).campos.tipoProducto.valor === "insumos", "control · tipoProducto con sector \"fabricacion\" (lo admite) se acepta");

  // CARNADA · valor vacío o no-string tampoco pasa
  const CON_VALOR_VACIO = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, pais: { valor: "", procedencia: "medido" } } };
  ok(construirPerfilCliente(CON_VALOR_VACIO).campos.pais.valor === null, "★ CARNADA · valor vacío no cuenta como declarado");
}

H("14c · perfilEmpresaDesdeFilaTenant — el mapeo puro desde una fila cruda de `tenants`");
{
  const filaCompleta = {
    id: "acme", nombre: "ACME",
    sector_codigo: "minorista", sector_procedencia: "medido",
    tipo_producto_codigo: null, tipo_producto_procedencia: null,
    pais_codigo: "CL", pais_procedencia: "medido",
    modelo_comercial_codigo: null, modelo_comercial_procedencia: null,
    tamano_banda_codigo: "mediana", tamano_banda_procedencia: "derivado",
    moneda: "USD", moneda_procedencia: "medido",
  };
  const m = perfilEmpresaDesdeFilaTenant(filaCompleta);
  ok(m.campos.sector.valor === "minorista" && m.campos.sector.procedencia === "medido", "mapea sector con su procedencia");
  ok(!("tipoProducto" in m.campos), "un par codigo/procedencia ambos NULOS no entra al objeto (no se inventa un `{valor:null}`)");
  ok(m.campos.tamanoBanda.valor === "mediana" && m.campos.tamanoBanda.procedencia === "derivado", "tamanoBanda: la clave camelCase que perfilCliente.js espera");
  ok(m.moneda === "USD", "moneda mapea como string plano (no {valor,procedencia}) — distinto del resto, a propósito");

  ok(perfilEmpresaDesdeFilaTenant(null) === null, "fila nula → null, no revienta");
  ok(perfilEmpresaDesdeFilaTenant({ id: "acme", nombre: "ACME" }) === null, "★ CONTROL NEGATIVO · fila sin ninguna columna del camino B (o migración sin aplicar, columnas ausentes del select) → null, no un objeto vacío disfrazado");

  // CARNADA · un código sin su procedencia (o con una inválida) no entra — defensa en profundidad
  const filaSucia = { sector_codigo: "algo", sector_procedencia: "propuesta", moneda: "us-dollars" };
  const ms = perfilEmpresaDesdeFilaTenant(filaSucia);
  ok(ms === null, "★ CARNADA · procedencia fuera de {medido,derivado} Y moneda con formato inválido → TODO descartado, null");
}

/* ═══ 15 · CAMINO B — LA MONEDA SE HEREDA (Etapa 2 §3, medido con sonda antes de escribir el código) ═════════ */
H("15 · doble en memoria — el mismo patrón de _persistir_carga_gate.mjs, extendido a `tenants`");
const ENV_CON_BASE_PB = {
  SUPABASE_URL: "https://proyecto-de-prueba.supabase.co", SUPABASE_ANON_KEY: "llave-publica-de-prueba",
  SUPABASE_JWT_SECRET: "secreto-jwt-de-prueba",
};
function dobleConTenant({ tenantsRow = null, migracionAplicada = true } = {}) {
  const log = [];
  let ultimaVersion = null;
  let fila = tenantsRow ? { ...tenantsRow } : null;
  const cli = {
    async seleccionar(tabla, o) {
      log.push({ op: "seleccionar", tabla, ...o });
      if (tabla === "fact_pack_versions") {
        if (o && o.filtros && o.filtros.id) return { ok: true, filas: ultimaVersion ? [ultimaVersion] : [] };
        return { ok: true, filas: ultimaVersion ? [{ version: ultimaVersion.version, pack: ultimaVersion.pack }] : [] };
      }
      if (tabla === "tenants") {
        /* Simula la migración SIN APLICAR: pedir columnas del camino B se rechaza, igual que PostgREST
         * rechazaría un `select` sobre una columna que no existe todavía. */
        const pideColumnasNuevas = /sector_codigo|moneda/.test(String(o.columnas || ""));
        if (pideColumnasNuevas && !migracionAplicada) return { ok: false, motivo: "la base respondió 400 (columna inexistente)" };
        return { ok: true, filas: fila ? [fila] : [] };
      }
      return { ok: true, filas: [] };
    },
    async insertar(tabla, o) {
      log.push({ op: "insertar", tabla, ...o });
      const f = Array.isArray(o.filas) ? o.filas[0] : o.filas;
      if (tabla === "fact_pack_versions") ultimaVersion = { ...f, id: "v-1", version: (ultimaVersion ? ultimaVersion.version + 1 : 1) };
      return { ok: true, filas: [{ ...f, id: `${tabla}-id-1` }] };
    },
    async actualizar(tabla, o) {
      log.push({ op: "actualizar", tabla, ...o });
      if (tabla === "fact_pack_versions" && ultimaVersion) ultimaVersion = { ...ultimaVersion, pack: o.cambios.pack };
      return { ok: true, filas: [] };
    },
    async subirObjeto() { return { ok: true, filas: [] }; },
    async llamarFuncion(nombre, argumentos) {
      log.push({ op: "llamarFuncion", nombre, argumentos });
      if (nombre === "adi_activar_version" && ultimaVersion) {
        ultimaVersion = { ...ultimaVersion, activa: true };
        if (argumentos.p_moneda) {
          const pack = ultimaVersion.pack || {};
          ultimaVersion.pack = { ...pack, perfil: { ...(pack.perfil || {}), moneda: argumentos.p_moneda } };
        }
        return { ok: true, filas: [{ id: argumentos.p_version_id, version: ultimaVersion.version, activa: true }] };
      }
      if (nombre === "adi_declarar_perfil_empresa") {
        if (!migracionAplicada) return { ok: false, motivo: "la función no existe todavía (migración sin aplicar)" };
        fila = fila || { id: "acme", nombre: "ACME" };
        if (argumentos.p_moneda) { fila = { ...fila, moneda: argumentos.p_moneda, moneda_procedencia: "medido" }; }
        for (const [pref, campo] of [["sector", "sector"], ["tipo_producto", "tipo_producto"], ["pais", "pais"], ["modelo_comercial", "modelo_comercial"], ["tamano_banda", "tamano_banda"]]) {
          const kCodigo = `p_${pref}_codigo`, kProc = `p_${pref}_procedencia`;
          if (argumentos[kCodigo]) fila = { ...fila, [`${campo}_codigo`]: argumentos[kCodigo], [`${campo}_procedencia`]: argumentos[kProc] || fila[`${campo}_procedencia`] };
        }
        return { ok: true, filas: [{ id: fila.id, sector_codigo: fila.sector_codigo || null, moneda: fila.moneda || null }] };
      }
      if (nombre === "adi_version_activa") {
        return { ok: true, filas: ultimaVersion && ultimaVersion.activa ? [{ id: ultimaVersion.id, version: ultimaVersion.version, pack: ultimaVersion.pack, sello: ultimaVersion.sello || null }] : [] };
      }
      return { ok: true, filas: [] };
    },
  };
  return { cli, log, filaTenant: () => fila };
}
const BYTES_PB = new Uint8Array([80, 75, 3, 4, 9, 9, 9]);

H("15a · ESCRITURA · activar con moneda declarada la deja TAMBIÉN en `tenants` (best-effort)");
{
  const { cli, log } = dobleConTenant();
  const c1 = await persistirCarga({ tenantId: "acme", bytes: BYTES_PB, nombreArchivo: "enero.xlsx", dataset: { id: "acme", nombre: "ACME", perfil: {} }, env: ENV_CON_BASE_PB, cliente: cli });
  ok(c1.guardado, "carga 1 guardada", c1.motivo);
  const a1 = await activarVersion({ tenantId: "acme", versionId: c1.versionId, moneda: "USD", env: ENV_CON_BASE_PB, cliente: cli });
  ok(a1.activada && a1.moneda === "USD", "activada con USD declarado", a1.motivo);

  const llamadaHerencia = log.find((x) => x.op === "llamarFuncion" && x.nombre === "adi_declarar_perfil_empresa");
  ok(!!llamadaHerencia && llamadaHerencia.argumentos.p_moneda === "USD",
    "★ activarVersion llamó a adi_declarar_perfil_empresa con la moneda recién declarada — no se limitó a guardarla en el pack de esta versión");
  ok(log.indexOf(llamadaHerencia) > log.findIndex((x) => x.op === "llamarFuncion" && x.nombre === "adi_activar_version"),
    "…DESPUÉS de confirmar la activación, nunca antes (la herencia no puede bloquear ni condicionar el acto principal)");
}

H("15b · LECTURA · un archivo nuevo sin moneda hereda la de la empresa — YA NO se pregunta dos veces");
{
  const { cli } = dobleConTenant({ tenantsRow: { id: "acme", nombre: "ACME", moneda: "USD", moneda_procedencia: "medido" } });
  const archivo = Buffer.from((await import("./src/ingesta/plantilla/generarPlantilla.js")).plantillaEjemplo()).toString("base64");
  const { code } = await (await import("./src/adi/llm/accessToken.js")).makeAccessCode("prueba", 72, "secreto-de-puerta", Date.now(), "acme");
  /* ⚠️ SIN VARIABLES DE SUPABASE A PROPÓSITO. `handleIngesta` no acepta un `cliente` inyectado en su firma
   * pública — crea el suyo desde el entorno (`clienteDesdeEntorno`). Pasarle un entorno CON base apuntaría a
   * una URL de prueba y el candado de red del gate (correctamente) lo mataría — ya pasó al escribir este
   * gate. Sin `SUPABASE_URL`, `clienteDesdeEntorno` da `null` y el camino de guardado se declara `sinBase`,
   * sin tocar la red: es el mismo patrón que usa `_persistir_carga_gate.mjs` §10. La pieza NUEVA que SÍ se
   * verifica con el doble inyectado es `monedaTenant`, abajo. */
  const ENV = { ADI_TOKEN_SECRET: "secreto-de-puerta" };

  const r = await handleIngesta({ archivo, nombre: "febrero.xlsx", access: code }, ENV);
  ok(r.persistencia && r.persistencia.sinBase === true, "sin Supabase configurado, handleIngesta se declara `sinBase` — cero red", JSON.stringify(r.persistencia));
  const heredada = await monedaTenant({ tenantId: "acme", env: ENV_CON_BASE_PB, cliente: cli });
  ok(heredada === "USD", "★ monedaTenant(acme) devuelve la moneda que la empresa ya declaró", heredada);

  // el efecto de punta a punta: un dataset SIN moneda, mergeado como lo hace handleIngesta.server.js
  const DATASET_SIN_MONEDA = { id: "acme", nombre: "ACME", perfil: {} };
  const deberiaPreguntar_antes = !(DATASET_SIN_MONEDA.perfil && DATASET_SIN_MONEDA.perfil.moneda);
  ok(deberiaPreguntar_antes, "de fábrica, un archivo sin moneda SÍ dispara la pregunta (monedaDelArchivo ausente)");
  const mergeado = { ...DATASET_SIN_MONEDA, perfil: { ...DATASET_SIN_MONEDA.perfil, moneda: heredada } };
  ok(Boolean(mergeado.perfil.moneda), "★ tras el merge (la misma línea que handleIngesta.server.js ejecuta), `perfil.moneda` queda poblado — la pantalla YA NO pregunta");
  ok(r.ok, "…y la ingesta real (sin base configurada en este sub-caso) sigue funcionando igual que siempre", r.motivo);
}

H("15c · CONTROL NEGATIVO · una empresa que NUNCA declaró moneda sigue preguntando — nada se infiere");
{
  const { cli } = dobleConTenant({ tenantsRow: { id: "acme", nombre: "ACME" } });   // sin moneda, sin procedencia
  const heredada = await monedaTenant({ tenantId: "acme", env: ENV_CON_BASE_PB, cliente: cli });
  ok(heredada === null, "★ CONTROL NEGATIVO · sin declaración previa, monedaTenant da null — la pregunta se sigue haciendo, nada se inventa");
}

H("15d · CONTROL NEGATIVO · migración SIN APLICAR → todo se comporta EXACTAMENTE como hoy");
{
  const { cli } = dobleConTenant({ tenantsRow: { id: "acme", nombre: "ACME" }, migracionAplicada: false });
  const heredada = await monedaTenant({ tenantId: "acme", env: ENV_CON_BASE_PB, cliente: cli });
  ok(heredada === null, "★ sin la columna `moneda` en la base (400 simulado), monedaTenant degrada a null — no revienta, no miente");

  const c1 = await persistirCarga({ tenantId: "acme", bytes: BYTES_PB, nombreArchivo: "enero.xlsx", dataset: { id: "acme", nombre: "ACME", perfil: {} }, env: ENV_CON_BASE_PB, cliente: cli });
  const a1 = await activarVersion({ tenantId: "acme", versionId: c1.versionId, moneda: "USD", env: ENV_CON_BASE_PB, cliente: cli });
  ok(a1.activada && a1.moneda === "USD", "★ la activación NO se rompe aunque `adi_declarar_perfil_empresa` no exista todavía — best-effort de verdad", a1.motivo);

  const permanece = await packActivo({ tenantId: "acme", env: ENV_CON_BASE_PB, cliente: cli });
  ok(permanece.estado === "activo" && permanece.pack, "★ packActivo también degrada limpio: sigue devolviendo el pack activo aunque las columnas del perfil no existan", JSON.stringify(permanece.estado));
}

H("15e · declararPerfilEmpresa — el enganche para la pantalla futura (Etapa siguiente, NO construida)");
{
  const { cli, log } = dobleConTenant({ tenantsRow: { id: "acme", nombre: "ACME" } });
  const r = await declararPerfilEmpresa({
    tenantId: "acme", env: ENV_CON_BASE_PB, cliente: cli,
    sector: { codigo: "comercio_retail", procedencia: "medido" },
    moneda: "EUR",
  });
  ok(r.declarada, "declara sector + moneda en un solo llamado", r.motivo);
  const llamada = log.find((x) => x.op === "llamarFuncion" && x.nombre === "adi_declarar_perfil_empresa");
  ok(llamada.argumentos.p_sector_codigo === "comercio_retail" && llamada.argumentos.p_sector_procedencia === "medido" && llamada.argumentos.p_moneda === "EUR",
    "…con los argumentos armados 1 a 1 desde la forma {codigo,procedencia}");
  ok(llamada.argumentos.p_tipo_producto_codigo === null, "…y lo que no se pasó viaja null (coalesce en la base conserva lo que ya había)");

  const sinEmpresa = await declararPerfilEmpresa({ env: ENV_CON_BASE_PB });
  ok(!sinEmpresa.declarada && sinEmpresa.sinBase === true, "sin tenantId no se declara nada, marcado como esperado");
}

/* ═══ 16 · packActivo — el merge del camino B dentro de `pack.perfil`, sin pisar lo que el pack ya trae ═══════ */
H("16 · packActivo — merge real con TENANT_DEMO como base del pack");
{
  const packConTodo = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil } };   // TENANT_DEMO.perfil.moneda = "CLP"
  const { cli } = dobleConTenant({
    tenantsRow: { id: "demo", nombre: "ADI Demo", sector_codigo: "minorista", sector_procedencia: "medido", moneda: "USD", moneda_procedencia: "medido" },
  });
  // sembrar una versión activa con el pack de arriba, usando el mismo doble
  const ins = await cli.insertar("fact_pack_versions", { pase: "x", filas: { pack: packConTodo, activa: false } });
  await cli.llamarFuncion("adi_activar_version", { p_version_id: ins.filas[0].id });

  const g = await packActivo({ tenantId: "demo", env: ENV_CON_BASE_PB, cliente: cli });
  ok(g.estado === "activo", "estado activo", JSON.stringify(g));
  ok(g.pack.perfil.sector && g.pack.perfil.sector.valor === "minorista", "★ el sector de `tenants` queda mergeado dentro de `pack.perfil`");
  ok(g.pack.perfil.moneda === "CLP", "★ LA MONEDA DEL PACK (la de ESTE archivo, \"CLP\") MANDA sobre la de la empresa (\"USD\") — nunca al revés");
  ok(g.pack.ventasKPI === TENANT_DEMO.ventasKPI, "el resto del pack (ventasKPI, etc.) viaja intacto — el merge toca solo `perfil`");

  const perfilCompuesto = construirPerfilCliente(g.pack);
  ok(perfilCompuesto.campos.sector.valor === "minorista" && perfilCompuesto.campos.moneda.valor === "CLP",
    "…y `construirPerfilCliente` sobre el pack ya mergeado lee las dos cosas correctamente juntas (código real de la taxonomía sembrada)");
}

/* ═══ 17 · TAREA 1 (owner 2026-09-23) — LAS BANDAS DE TAMAÑO, en UF, falla cerrada ═══════════════════════════ */
H("17a · bandaPorUF — los bordes EXACTOS (2.400 · 25.000 · 100.000 UF), sellados por el owner");
{
  ok(bandaPorUF(0) === "micro", "0 UF → micro");
  ok(bandaPorUF(2399.99) === "micro", "justo bajo el corte de micro → micro");
  ok(bandaPorUF(2400) === "micro", "★ BORDE · exactos 2.400 UF → micro (el umbral pertenece a la banda de ABAJO)");
  ok(bandaPorUF(2400.01) === "pequena", "★ BORDE · apenas sobre 2.400 UF → pequeña");
  ok(bandaPorUF(25000) === "pequena", "★ BORDE · exactos 25.000 UF → pequeña");
  ok(bandaPorUF(25000.01) === "mediana", "★ BORDE · apenas sobre 25.000 UF → mediana");
  ok(bandaPorUF(100000) === "mediana", "★ BORDE · exactos 100.000 UF → mediana");
  ok(bandaPorUF(100000.01) === "grande", "★ BORDE · apenas sobre 100.000 UF → grande");
  ok(bandaPorUF(1e9) === "grande", "un número muy grande → grande");
  ok(JSON.stringify(UMBRALES_UF) === JSON.stringify({ micro: 2400, pequena: 25000, mediana: 100000 }), "★ los umbrales son EXACTAMENTE los sellados por el owner (2026-09-23): 2.400 · 25.000 · 100.000 UF", JSON.stringify(UMBRALES_UF));
  ok(bandaPorUF(-1) === null && bandaPorUF(NaN) === null && bandaPorUF("100") === null && bandaPorUF(undefined) === null, "★ CONTROL NEGATIVO · un número inválido (negativo, NaN, no-numérico, ausente) → null, nunca una banda inventada");
}

H("17b · calcularBandaTamano — sobre el archivo de demostración ($100MM), UF 2025-12 OFICIAL ($39.727,96 SII)");
{
  const r = calcularBandaTamano({ ventaAnual: 100000000, moneda: "CLP", periodo: "2025-12" });
  ok(r.banda === "pequena" && r.procedencia === "derivado", `$100MM / $39.727,96 = ${r.insumos.ventaAnualUF.toFixed(1)} UF → "pequena" (hoy: ${r.banda}) — ≈2.517 UF, un ~4,9% sobre el corte de 2.400 UF de Micro`, JSON.stringify(r));
  ok(r.insumos.ufValor === 39727.96 && r.insumos.ufFila.grado === "oficial", "los insumos traen el valor de UF usado y su fila completa (auditable)", JSON.stringify(r.insumos.ufFila));
  ok(r.insumos.proporcionada === false, "sin mesesInformados (o con 12), no se prorratea");
  // el mismo monto pero justo bajo el corte de micro en UF ($95.347.104 = 2.400 × $39.727,96) sale "micro"
  const rMicro = calcularBandaTamano({ ventaAnual: 2400 * 39727.96, moneda: "CLP", periodo: "2025-12" });
  ok(rMicro.banda === "micro", `2.400 UF exactas en pesos ($${(2400 * 39727.96).toLocaleString("es-CL")}) → "micro" (hoy: ${rMicro.banda})`);

  // LA TABLA ES UNA PIEZA FIRMADA, no un número suelto — los nueve-campos-de-procedencia del estilo de la casa
  ok(Array.isArray(TABLA_UF) && TABLA_UF.length === 1, `TABLA_UF trae ${TABLA_UF.length} fila (la única sembrada hoy, 2025-12)`);
  const filaUF = TABLA_UF[0];
  ok(["fuente", "fecha", "vigencia", "firma", "grado"].every((k) => typeof filaUF[k] === "string" && filaUF[k].length > 0), "★ la fila trae los cinco campos de procedencia (fuente/fecha/vigencia/firma/grado), ninguno vacío", JSON.stringify(Object.keys(filaUF)));
  ok(filaUF.grado === "oficial", "★ CORRECCIÓN (owner 2026-09-23) · declarado EXPLÍCITAMENTE como valor OFICIAL — ya no una referencia derivada");
  ok(filaUF.valor === 39727.96, "★ el valor coincide EXACTAMENTE con el oficial declarado por el owner (SII, UF al 31-dic-2025)", String(filaUF.valor));
  ok(/sii/i.test(filaUF.fuente) && /sii\.cl/i.test(filaUF.fuente), "★ CANDADO · la fila lleva su FUENTE (SII, con URL)", filaUF.fuente);
  ok(filaUF.fecha === "2025-12-31", "★ CANDADO · la fila lleva su FECHA exacta (la que publica el SII, no la fecha en que se copió)", filaUF.fecha);
  ok(/jc/.test(filaUF.firma) && /owner/i.test(filaUF.firma), "★ la firma nombra a quién — el owner, jc.navsil@gmail.com");
  // ★ CANDADO (owner 2026-09-23, textual: «no quiero mi firma sobre una UF aproximada o derivada») · la firma
  // aprueba la FUENTE, nunca un NÚMERO calculado o propuesto por el owner — «valor de referencia» era la forma
  // vieja (fila derivada, retirada); si vuelve, este candado se enciende.
  ok(/aprob[oó] usar la fuente/i.test(filaUF.firma), "★ CANDADO · la firma dice que el owner aprobó USAR la fuente, no que propuso el número", filaUF.firma);
  ok(!/valor de referencia/i.test(filaUF.firma) && !/propuest[oa] por el owner/i.test(filaUF.firma), "★ CANDADO · ningún campo de firma atribuye al owner una cifra derivada", filaUF.firma);
}

H("17c · LA CADENA DE FALLA CERRADA — sin período → sin UF → sin banda → perfil incompleto → la capa no entrega");
{
  // 1 · sin período: calcularBandaTamano da null con el motivo correcto
  const sinPeriodo = calcularBandaTamano({ ventaAnual: 100000000, moneda: "CLP", periodo: null });
  ok(sinPeriodo.banda === null && /sin período declarado/.test(sinPeriodo.motivo), "★ CARNADA · sin período → banda null, motivo nombra la causa", sinPeriodo.motivo);

  // 2 · CORRECCIÓN (owner 2026-09-23, «el período real del demo») — TENANT_DEMO YA declara
  // `.hechos.parametros.periodo_actual` con evidencia del propio archivo (ver el comentario junto a `hechos` en
  // `data/tenants/demo.js`). Ya NO es el caso "sin período" — es la prueba de que el tenant de fábrica recorre
  // el MISMO camino que un cliente real, de punta a punta, hasta una banda concreta.
  const { TENANT_DEMO: _TD } = await import("./src/data/tenants/demo.js");
  ok(periodoDeclaradoDe(_TD) === "2025-12", `★ CANDADO · periodoDeclaradoDe(TENANT_DEMO) === "2025-12" — el demo declara período por la MISMA vía que un cliente real (hoy: ${periodoDeclaradoDe(_TD)})`, String(periodoDeclaradoDe(_TD)));
  const perfilConPeriodoReal = construirPerfilCliente(_TD);
  ok(perfilConPeriodoReal.campos.tamano.valor === "pequena", `★ CANDADO · CADENA COMPLETA SOBRE EL TENANT REAL · período declarado → UF del período (${perfilConPeriodoReal.campos.tamano.insumos.ufValor}) → banda "${perfilConPeriodoReal.campos.tamano.valor}"`, JSON.stringify(perfilConPeriodoReal.campos.tamano));
  ok(perfilConPeriodoReal.campos.tamano.insumos.ufFila.grado === "oficial", "…la UF que usó la cadena es la fila OFICIAL (SII), no una referencia");
  ok(!perfilConPeriodoReal.faltantes.includes("tamano"), "…y por eso «tamano» ya NO está entre los campos faltantes del perfil");

  // control negativo — SIN el período (un tenant que nunca lo declaró) la cadena sigue fallando cerrada, exactamente
  // como antes de esta corrección: la corrección no debilitó la regla, solo le dio a TENANT_DEMO un dato real.
  const { TENANT_EMPRESA2: _TE2 } = await import("./src/data/tenants/empresa2.js");
  ok(periodoDeclaradoDe(_TE2) === null, "control negativo · empresa2 (no declara nada, a propósito) sigue SIN período — periodoDeclaradoDe === null");
  const perfilSinPeriodo = construirPerfilCliente(_TE2);
  ok(perfilSinPeriodo.campos.tamano.valor === null, "…y por eso su perfil nunca tiene banda (no se inventa)");
  ok(perfilSinPeriodo.completo === false && perfilSinPeriodo.faltantes.includes("tamano"), "…el perfil queda INCOMPLETO por la banda faltante");
  ok(perfilAutorizaConocimiento(perfilSinPeriodo) === false, "★ CADENA COMPLETA (control) · perfilAutorizaConocimiento === false — «la capa no se entrega», exactamente el mandato del encargo");

  // 3 · control positivo genérico — CON período declarado a mano (simulando la ruta real:
  // `tenant.hechos.parametros.periodo_actual`, la que persistirCarga.server.js/activarVersion arma) sobre un
  // tenant sintético, para separar "el mecanismo funciona en general" de "el demo declara su período real" (2·arriba)
  const TENANT_CON_PERIODO = { ..._TD,
    hechos: { parametros: { ..._TD.hechos?.parametros, periodo_actual: "2025-12-15" } },
    perfil: { ..._TD.perfil,
      sector: { valor: "minorista", procedencia: "medido" },
      tipoProducto: { valor: "durable", procedencia: "medido" },
      pais: { valor: "CL", procedencia: "medido" },
      modeloComercial: { valor: "consumidor", procedencia: "medido" },
    },
  };
  const perfilConPeriodo = construirPerfilCliente(TENANT_CON_PERIODO);
  ok(perfilConPeriodo.campos.tamano.valor === "pequena", `★ mecanismo genérico, otra fecha del mismo mes → misma banda (hoy: ${perfilConPeriodo.campos.tamano.valor})`, JSON.stringify(perfilConPeriodo.campos.tamano));
  ok(perfilConPeriodo.campos.tamano.insumos && perfilConPeriodo.campos.tamano.insumos.periodo === "2025-12", "…y el insumo `periodo` es el mes de CIERRE («2025-12-15» recortado a «2025-12»), no una interpolación");
  ok(perfilConPeriodo.completo === true && perfilAutorizaConocimiento(perfilConPeriodo) === true, "★ con los seis campos presentes (banda incluida), el perfil COMPLETA y la capa SÍ se entrega");
}

H("17d · MONEDA SIN TABLA → SIN BANDA (misma regla, sin excepción — la clasificación es chilena)");
{
  const rUSD = calcularBandaTamano({ ventaAnual: 5000000, moneda: "USD", periodo: "2025-12" });
  ok(rUSD.banda === null && /clasificación oficial de tamaño es chilena/.test(rUSD.motivo), "★ CARNADA · USD no tiene tabla → banda null, el motivo dice por qué", rUSD.motivo);
  ok(ufDelPeriodo("2025-12", "USD") === null, "ufDelPeriodo nunca inventa una fila para una moneda sin tabla");
  // control negativo · CLP con un período que SÍ está sembrado da la fila
  ok(ufDelPeriodo("2025-12", "CLP") !== null, "control · CLP con el período sembrado SÍ resuelve");
  // período CLP fuera de la tabla (sin interpolar)
  const rSinFila = calcularBandaTamano({ ventaAnual: 100000000, moneda: "CLP", periodo: "2026-01" });
  ok(rSinFila.banda === null && /hay que sembrar esa fila/.test(rSinFila.motivo), "★ CARNADA · CLP con un período SIN fila firmada → banda null (nunca interpola con la fila más cercana)", rSinFila.motivo);
}

H("17e · el prorrateo a doce meses — SOLO para elegir la banda, registrado, nunca mostrado como cifra");
{
  // 8 meses de venta que YA suman lo mismo que el caso "pequena" de arriba, prorrateados a 12 deberían subir de banda
  const r8 = calcularBandaTamano({ ventaAnual: 60000000, moneda: "CLP", periodo: "2025-12", mesesInformados: 8 });
  ok(r8.insumos.proporcionada === true && r8.insumos.ventaAnualProrrateada === 60000000 * 12 / 8, "★ con 8 meses informados, la venta SE PRORRATEA a 12 para elegir banda (90MM), registrado en `insumos.ventaAnualProrrateada`", JSON.stringify(r8.insumos));
  ok(r8.insumos.ventaAnual === 60000000, "…pero `insumos.ventaAnual` conserva el monto REAL informado (60MM) — el prorrateado nunca reemplaza al real, es un insumo aparte");
  const r12 = calcularBandaTamano({ ventaAnual: 60000000, moneda: "CLP", periodo: "2025-12", mesesInformados: 12 });
  ok(r12.insumos.proporcionada === false && r12.insumos.ventaAnualProrrateada === null, "control · con 12 meses informados, NO se prorratea");
  ok(mesesInformadosDe({ ventasMensuales: [1, 2, 3] }) === 3 && mesesInformadosDe({}) === null, "mesesInformadosDe: cuenta `ventasMensuales`, o null si el tenant no trae el campo (nunca fuerza un prorrateo que no puede probar)");
}

H("17f · CANDADO · el módulo de bandas NO importa nada de red (bandaTamano.js + tablaUF.js)");
{
  // ⚠️ NINGUNA de las palabras de red de acá abajo se escribe CONTIGUA en ESTE archivo, ni siquiera dentro de un
  // patrón que busca detectarla. El propio clasificador de gates (`scripts/clasificarGates.mjs`) escanea el TEXTO
  // CRUDO de cada `_*_gate.mjs` de la raíz para decidir si hace llamadas reales — escribir, por ejemplo, la
  // secuencia de caracteres de una llamada de red (aunque fuera dentro del patrón que la busca, o de un comentario
  // que la nombra) saca a `_entrega_gate.mjs` ENTERO de `gates:offline` EN SILENCIO: exactamente el defecto que
  // `_gates_en_la_corrida_gate.mjs` existe para cazar. Medido: pasó DOS VECES al escribir esta sección (primero con
  // la palabra suelta en un comentario, después con el patrón regex que la buscaba) — quedó como la lección de esta
  // tarea. Por eso cada patrón se arma por CONCATENACIÓN, nunca como un literal `/.../ ` con la secuencia entera.
  // ocho formas de salir a la red, cada una armada por concatenación (ninguna se nombra entera, ni en código ni
  // en comentario, en ningún punto de este archivo): una llamada directa · XHR · un cliente HTTP nativo de Node ·
  // el mismo cliente pedido por nombre · el gateway del LLM por nombre de módulo · el gateway por ruta · el
  // cliente REST de la base de datos · un import apuntando directo a una URL.
  const j = (...partes) => partes.join("");
  const PALABRAS_DE_RED = [
    new RegExp("\\b" + j("f", "e", "t", "c", "h") + "\\s*\\("),
    new RegExp(j("XMLHttp", "Request")),
    new RegExp(j("no", "de", ":", "ht", "tp") + "s?\\b"),
    new RegExp(j("re", "quire", "\\(") + "[\"']" + j("ht", "tps?") + "[\"']\\)"),
    new RegExp("from\\s+[\"'][^\"']*" + j("ll", "mGate", "way") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"'][^\"']*/" + j("ga", "teway") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"'][^\"']*" + j("supa", "base", "Rest") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"']" + j("ht", "tps?") + ":"),
  ];
  const srcBanda = fs.readFileSync("./src/config/contract/bandaTamano.js", "utf8");
  const srcUF = fs.readFileSync("./src/config/contract/tablaUF.js", "utf8");
  let i = 0;
  for (const re of PALABRAS_DE_RED) {
    i++;
    ok(!re.test(srcBanda), `★ bandaTamano.js NO contiene la palabra de red #${i} (sin red)`, srcBanda.match(re) ? String(srcBanda.match(re)[0]) : "");
    ok(!re.test(srcUF), `★ tablaUF.js NO contiene la palabra de red #${i} (sin red)`, srcUF.match(re) ? String(srcUF.match(re)[0]) : "");
  }
  // control positivo — el candado SÍ sabe encender: una llamada real (armada por concatenación, nunca escrita
  // entera en el archivo) tiene que fallar la prueba.
  const _muestraDeRed = "const x = await " + j("f", "e", "t", "c", "h") + String.fromCharCode(40) + "'http://x'" + String.fromCharCode(41);
  ok(PALABRAS_DE_RED[0].test(_muestraDeRed), "control · la propia regex de red SÍ detecta una llamada real (el candado no es un siempre-verde)");
  // los únicos imports de bandaTamano.js son locales, dentro de config/contract/
  const imports = [...srcBanda.matchAll(/^import\s+.*?from\s+["'](.+?)["'];?$/gm)].map((m) => m[1]);
  ok(imports.length === 2 && imports.every((i) => i.startsWith("./")), `★ bandaTamano.js solo importa módulos locales (${imports.join(", ")}) — ninguno de red`, imports.join(","));
}

/* ═══ 18 · TAREA 2 (owner 2026-09-23) — LA SIEMBRA DE LA TAXONOMÍA: una sola verdad ═══════════════════════════ */
H("18a · taxonomiaPerfil.js — las cinco listas, tal como las aprobó el owner");
{
  ok(JSON.stringify(SECTORES) === JSON.stringify(["distribucion", "fabricacion", "minorista", "servicios", "obras", "ninguno"]), "sector: las cinco + obras + ninguno, en ese orden", SECTORES.join(","));
  ok(SECTORES.includes("obras"), "★ «obras» entra DESDE AHORA (owner, textual: «lo incluyó desde ahora»)");
  ok(JSON.stringify(SECTORES_CON_TIPO_PRODUCTO) === JSON.stringify(["distribucion", "fabricacion", "minorista"]), "tipoProducto solo aplica a estos tres sectores");
  ok(JSON.stringify(TIPOS_PRODUCTO) === JSON.stringify(["vence", "consumo", "durable", "temporada", "insumos"]), "tipoProducto: las cinco de la propuesta §2");
  ok(JSON.stringify(MODELOS_COMERCIALES) === JSON.stringify(["cuentas_grandes", "comercios", "consumidor", "publico"]), "modeloComercial: las cuatro de la propuesta §4");
  ok(PAISES[0] === "CL" && PAISES.includes("BR") && PAISES.includes("ES") && PAISES.length === 20, `país: Chile primero, incluye Brasil y España, ${PAISES.length} códigos en total`, PAISES.join(","));
  ok(new Set(PAISES).size === PAISES.length, "país: sin códigos repetidos");
  ok(JSON.stringify(TAMANO_BANDAS) === JSON.stringify(["micro", "pequena", "mediana", "grande"]), "tamanoBanda: las cuatro bandas");
  ok(TAMANO_BANDAS === TAMANO_BANDAS_DE_BANDATAMANO || JSON.stringify(TAMANO_BANDAS) === JSON.stringify(TAMANO_BANDAS_DE_BANDATAMANO), "★ UNA SOLA VERDAD · bandaTamano.js reexporta el MISMO array de taxonomiaPerfil.js — no hay una segunda lista de bandas que se pueda desincronizar");
}

H("18b · codigoValido / validarTipoProductoDeSector — el candado de vocabulario, con carnadas");
{
  ok(codigoValido("sector", "distribucion") === true, "código real → válido");
  ok(codigoValido("sector", "comercio_retail") === false, "★ CARNADA · código inventado → inválido");
  ok(codigoValido("sector", null) === true, "null (no respondido) siempre es válido — no es lo mismo que un código inventado");
  ok(codigoValido("campo_que_no_existe", "cualquiera") === false, "★ CONTROL NEGATIVO · un campo que no está en TAXONOMIA_PERFIL nunca valida nada como bueno");

  ok(validarTipoProductoDeSector(null, null).ok === true, "sin sector ni tipoProducto, ok (nada que validar)");
  ok(validarTipoProductoDeSector("distribucion", "vence").ok === true, "distribucion + vence → ok");
  ok(validarTipoProductoDeSector("minorista", "durable").ok === true, "minorista + durable → ok");
  ok(validarTipoProductoDeSector("fabricacion", "insumos").ok === true, "fabricacion + insumos → ok");
  ok(validarTipoProductoDeSector("servicios", "vence").ok === false, "★ CARNADA · servicios + tipoProducto no nulo → rechazado");
  ok(validarTipoProductoDeSector("obras", "insumos").ok === false, "★ CARNADA · obras + tipoProducto no nulo → rechazado (misma regla)");
  ok(validarTipoProductoDeSector("ninguno", "vence").ok === false, "★ CARNADA · sector \"ninguno\" + tipoProducto no nulo → rechazado");
  ok(validarTipoProductoDeSector(null, "vence").ok === false, "★ CARNADA · sin sector declarado, tipoProducto no nulo → rechazado (no hay con qué validar la combinación)");
  ok(validarTipoProductoDeSector("distribucion", "codigo-inventado").ok === false, "★ CARNADA · tipoProducto fuera de la lista → rechazado, aunque el sector sea válido");
}

H("18c · db/migraciones/013_perfil_taxonomia_siembra.sql — el rename y la regla nueva, sobre TEXTO");
{
  const sql = fs.readFileSync("./db/migraciones/013_perfil_taxonomia_siembra.sql", "utf8");

  // 1 · el rename subsector → tipo_producto, guardado (RENAME no admite IF EXISTS, por eso el DO block)
  ok(/rename column subsector_codigo to tipo_producto_codigo/.test(sql), "renombra subsector_codigo → tipo_producto_codigo");
  ok(/rename column subsector_procedencia to tipo_producto_procedencia/.test(sql), "renombra subsector_procedencia → tipo_producto_procedencia");
  ok(/add column if not exists tipo_producto_codigo/.test(sql) && /add column if not exists tipo_producto_procedencia/.test(sql), "★ IDEMPOTENTE · si la 012 nunca corrió, las columnas nacen con su nombre final directo");

  // 2 · el check de perfil_taxonomia.campo se actualiza
  ok(/campo in \('sector', 'tipo_producto', 'pais', 'modelo_comercial', 'tamano_banda'\)/.test(sql), "el check de `campo` ya no incluye 'subsector', incluye 'tipo_producto'");
  ok(!/campo in \([^)]*'subsector'/.test(sql), "★ CONTROL NEGATIVO · ningún check nuevo sigue aceptando 'subsector'");

  // 3 · LA REGLA NUEVA — tipo_producto exige sector en los tres que lo admiten, con raise exception (candado real)
  ok(/tipo_producto_codigo is not null[\s\S]{0,220}sector_codigo not in \('distribucion', 'fabricacion', 'minorista'\)[\s\S]{0,120}raise exception/.test(sql),
    "★ CARNADA (estructura) · el trigger rechaza tipo_producto con un sector que no lo admite — `raise exception`, no un warning");

  // 4 · LA SIEMBRA — cada código que sale de esta migración, EXTRAÍDO DEL TEXTO, es BYTE-IDÉNTICO al vocabulario
  //     de taxonomiaPerfil.js — «una sola verdad», medida acá y no solo declarada en un comentario.
  const filasPorCampo = {};
  for (const m of sql.matchAll(/\('(sector|tipo_producto|pais|modelo_comercial|tamano_banda)',\s*'([a-z0-9_A-Z]+)'\)/g)) {
    (filasPorCampo[m[1]] ||= []).push(m[2]);
  }
  ok(Object.keys(filasPorCampo).length === 5, `la migración siembra los cinco campos (encontrados: ${Object.keys(filasPorCampo).join(",")})`);
  for (const [campo, lista] of Object.entries(TAXONOMIA_PERFIL)) {
    ok(JSON.stringify(filasPorCampo[campo]) === JSON.stringify(lista),
      `★ UNA SOLA VERDAD · la siembra SQL de "${campo}" es BYTE-IDÉNTICA (mismo orden) al array de taxonomiaPerfil.js`,
      `sql: ${JSON.stringify(filasPorCampo[campo])}\n      js:  ${JSON.stringify(lista)}`);
  }
  const totalFilasEsperadas = Object.values(TAXONOMIA_PERFIL).reduce((n, l) => n + l.length, 0);
  const totalFilasSql = Object.values(filasPorCampo).reduce((n, l) => n + l.length, 0);
  ok(totalFilasSql === totalFilasEsperadas, `★ CARNADA DE SINCRONÍA · ${totalFilasSql} filas sembradas en SQL === ${totalFilasEsperadas} códigos en taxonomiaPerfil.js — si alguien agrega uno sin el otro, este número deja de calzar y el candado arde`);
  ok(/on conflict \(campo, codigo\) do nothing/.test(sql), "la siembra es idempotente (on conflict do nothing)");

  ok(!/drop table|truncate/i.test(sql), "★ CONTROL NEGATIVO · la migración no borra tablas");
}

/* ═══ 19 · TAREA 3 — LOS CANDADOS, resumen final con controles negativos cruzados ═══════════════════════════ */
H("19 · candados de la tarea — resumen con controles negativos, para que ningún candado sea un siempre-verde");
{
  // un perfil con TODO válido y completo (armado a mano, no TENANT_DEMO) tiene que pasar limpio
  const TENANT_PERFECTO = {
    id: "perfecto", nombre: "Perfecto SpA",
    ventasKPI: { totalActual: 500 }, escalaComercial: "K",
    ventasMensuales: Array.from({ length: 12 }, (_, i) => ({ mes: i, periodo: `2025-${String(i + 1).padStart(2, "0")}` })),
    hechos: { parametros: { periodo_actual: "2025-12-31" } },
    perfil: { moneda: "CLP",
      sector: { valor: "distribucion", procedencia: "medido" },
      tipoProducto: { valor: "consumo", procedencia: "medido" },
      pais: { valor: "CL", procedencia: "medido" },
      modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" },
    },
  };
  const perfecto = construirPerfilCliente(TENANT_PERFECTO);
  ok(perfecto.completo === true && perfilAutorizaConocimiento(perfecto) === true, "★ CONTROL POSITIVO · un perfil con los seis campos válidos y una banda calculable COMPLETA de punta a punta", JSON.stringify(perfecto.faltantes));
  ok(TAMANO_BANDAS.includes(perfecto.campos.tamano.valor), "…y la banda calculada es una de las cuatro del vocabulario cerrado, nunca un valor suelto");
}

console.log(`\n── _entrega_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
