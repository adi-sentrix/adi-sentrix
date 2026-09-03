/* === _consola_examen.mjs · LA CONSOLA DEL EXAMEN EN AMBIENTE CONTROLADO (owner 2026-08-14) ====================
 * «Prefiero que lo corramos juntos desde el panel/código, con el camino natural activo en ambiente controlado,
 * para que tú veas el veredicto interno y yo vea la respuesta como usuario.»
 *
 * QUÉ CORRE: el camino natural REAL —`answerViaNatural` (el mismo que ChatADI invoca con el flag ON) contra el
 * gateway REAL con `modoNatural`—. No es un arnés paralelo: es exactamente lo que va a producción.
 *
 * QUÉ MUESTRA, por turno: la RESPUESTA VISIBLE (lo que vería el usuario en pantalla) y el VEREDICTO INTERNO
 * (estado · vetos · reparaciones · suplente · vacías · cálculos declarados · alcance heredado · re-cita · costo),
 * más la verificación de que el bloque [[CALCULO]] quedó oculto.
 *
 * EL ESTADO PERSISTE entre invocaciones (`_examen_estado.json`): el hilo se construye turno a turno, como una
 * conversación real. `--reset` empieza de cero; `--titulo "…"` rotula el examen en curso.
 *
 * USO:  node _consola_examen.mjs "la pregunta"
 *       node _consola_examen.mjs --reset --titulo "Examen 1 · clientes y margen"
 *       node _consola_examen.mjs --estado          (resumen del hilo sin gastar)
 * ⚠️ GASTA: cada turno son 1-2 llamadas a Sonnet. Solo con autorización del owner. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

/* (La Poda 2026-09-05: answerViaNatural se retiró — la consola corre SOLO el agente; --agente queda por compat) */
import { handleNarrateC, handleAgente } from "./src/adi/llm/gatewayCore.js";
/* F4-PREP (2026-08-30): el examen del AGENTE corre por esta MISMA consola con `--agente` — el mismo bucle real
 * que ChatADI invoca con la bandera ON (`answerViaAgente` + `handleAgente` del gateway real), estado y
 * expedientes PROPIOS (`_examen_agente_*.json`) para no contaminar el corpus del natural que lee la
 * calibración. ⚠️ GASTA IGUAL QUE EL NATURAL: solo con la autorización del owner que NOMBRE el gasto
 * (protocolo: _EXAMEN_AGENTE_PROTOCOLO.md). Construirlo es gratis; correrlo no. */
import { answerViaAgente, TECHO_ENTRADA_CIERRE_CHARS } from "./src/adi/agente/bucleAgente.js";
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";
import { vetosDeContrato } from "./src/adi/agente/contratoAgente.js";   // R7b · el sello del agente prueba su juez en vivo
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { MARCA_CALCULO } from "./src/adi/oracle/narrationBlocks.js";
import { MODEL_PRICING } from "./src/adi/llm/modelPricing.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";   // MISMO escenario que la app: medir en otro es medir otro negocio
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";

/* ── P3 · LA CONSOLA APUNTA A CUALQUIER EMPRESA (owner 2026-08-31) ────────────────────────────────────────────
 * EL BLOQUEO QUE ESTO ABRE: la consola cargaba `TENANT_DEMO` clavado, así que los tres exámenes midieron el
 * demo porque era lo único que sabía leer. El owner quiere certificar con TRES escenarios —demo de fábrica ·
 * planilla COMPLETA · planilla PARCIAL (solo las columnas obligatorias)— y los dos últimos no se podían correr.
 *
 *   `--planilla <ruta.xlsx>` → ingesta por el camino REAL (`ingestarPlantilla`, el mismo que usa un cliente) e
 *                              `initTenant` sobre ESE dataset. Sin atajos ni datos fabricados acá.
 *   `--tenant <id>`          → una empresa ya cargada en la base. ⚠️ SALE A LA RED contra Supabase (no gasta
 *                              modelo, pero es red) y por eso se DECLARA en el sello.
 *   sin flags                → el demo de siempre, byte-idéntico.
 *
 * EL SELLO NOMBRA EL NEGOCIO EXAMINADO: sin eso, tres corridas distintas se vuelven indistinguibles a la
 * semana, y son justo las tres que hay que comparar. */
const _arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const RUTA_PLANILLA = _arg("--planilla");
const TENANT_ID = _arg("--tenant");
let ORIGEN = { tipo: "demo", nombre: "demo de fábrica", avisos: [], bloqueos: [], totales: null };

if (RUTA_PLANILLA) {
  const buf = fs.readFileSync(RUTA_PLANILLA);
  const ing = ingestarPlantilla(buf, { nombreArchivo: RUTA_PLANILLA.split(/[\\/]/).pop(), fechaCarga: _arg("--fecha") || null });
  if (!ing.ok || !ing.dataset) {
    console.log(`\n🔴 LA PLANILLA NO PASÓ LA INGESTA — el examen no arranca sobre un dato que la app tampoco aceptaría.`);
    for (const b of (ing.preview && ing.preview.bloqueos) || []) console.log(`   · ${b.tipo}: ${b.detalle}`);
    process.exit(1);
  }
  initTenant(ing.dataset);
  ORIGEN = { tipo: "planilla", nombre: `${RUTA_PLANILLA.split(/[\\/]/).pop()} · ${ing.dataset.nombre || ing.dataset.id || "(sin nombre)"}`,
    avisos: (ing.preview && ing.preview.avisos) || [], bloqueos: [], totales: (ing.preview && ing.preview.totales) || null };
} else if (TENANT_ID) {
  /* ⚠️ ESTA RAMA SALE A LA RED. Se declara en el sello y se pide por el MISMO servicio que usa la app
   * (`handleData`), no por un atajo: examinar una empresa que la app no serviría igual no mide nada. */
  const { handleData } = await import("./src/data/tenantService.server.js");
  const res = await handleData({ tenantId: TENANT_ID }, process.env);
  const pack = res && (res.pack || (res.data && res.data.pack));
  if (!pack) {
    console.log(`\n🔴 NO PUDE TRAER LA EMPRESA «${TENANT_ID}» DE LA BASE: ${JSON.stringify(res && (res.estado || res.error || res)).slice(0, 200)}`);
    process.exit(1);
  }
  initTenant(pack);
  ORIGEN = { tipo: "tenant", nombre: `${TENANT_ID}${res.nombre ? ` · ${res.nombre}` : ""} (desde la base · SALIÓ A LA RED)`, avisos: [], bloqueos: [], totales: null };
} else {
  initTenant(TENANT_DEMO);
}

/* ── EL SELLO DE VERSIÓN (owner 2026-08-14) ───────────────────────────────────────────────────────────────────
 * «Antes de medir, confirma explícitamente: versión de código servida · ruta que respondió · bloque [[CALCULO]]
 * oculto · rastro interno activo.» Y no es una formalidad: el servidor de desarrollo estuvo sirviendo MÓDULOS
 * VIEJOS, así que respuestas en vivo se midieron contra código anterior al arreglo. La versión no se DECLARA: se
 * PRUEBA, ejercitando las reglas nuevas contra el muro cargado en este proceso. Todo offline, cero costo. */
import { execSync } from "node:child_process";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
/* (La Poda: CONTRATO_CALCULO_NATURAL murió con naturalPrompt.js — el check del sello que lo leía se retiró) */
function _sello() {
  const commit = (() => { try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { return "(sin git)"; } })();
  // `numberGuard.js` y `entityGuard.js` son trabajo sin commitear de OTRA sesión (CLAUDE.md §3: no se tocan ni se
  // commitean). Aparecen sucios siempre; contarlos convertiría la alarma en ruido y dejaría de significar nada.
  const sucio = (() => {
    try {
      return execSync("git status --porcelain src/adi/oracle src/adi/llm src/ui", { encoding: "utf8" })
        .split(/\r?\n/).filter((l) => l.trim() && !/numberGuard\.js|entityGuard\.js/.test(l)).join(" · ");
    } catch { return ""; }
  })();
  const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
  const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "clientes bajo benchmark",
    datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
  const M = "[[CALCULO]]";
  /* ⚠️ LAS PRUEBAS DEL SELLO SE ARMAN DESDE LA CARPETA ACTIVA, NO CON CIFRAS ESCRITAS A MANO (2026-08-15).
   * La primera versión usaba $100.0M / $19.4M / $17.8M — literales del escenario «actual». Al unificar el
   * escenario, el sello se puso ROJO entero: sus cifras no existían en la carpeta nueva, así que cada prueba
   * fallaba por un motivo distinto al que decía medir. El instrumento tenía la misma enfermedad que fue creado
   * para detectar. Ahora sale todo del dato vigente: el benchmark, un cliente y su margen, y la cifra de OTRO. */
  const cif = cifrasDelDato(ESCENARIO_INICIAL);
  const _dato = proyectarDatoNegocio(ESCENARIO_INICIAL);
  const figs = cif.figs || [];
  const clientes = ejes(["cliente"]);
  const bench = figs.find((f) => (f.duenos || []).includes("benchmark") && /%$/.test(String(f.value)));
  const margenCli = figs.find((f) => /%$/.test(String(f.value)) && (f.duenos || []).some((d) => clientes.includes(d)));
  const cli = margenCli ? (margenCli.duenos || []).find((d) => clientes.includes(d)) : null;
  const otro = clientes.find((c) => c !== cli);
  const cifraDeOtro = figs.find((f) => (f.duenos || []).length === 1 && (f.duenos || [])[0] === otro && /^\$/.test(String(f.value)));
  let sinDueno = null, conDueno = null, ajena = null, pp = null;
  if (bench && margenCli && cli && cifraDeOtro) {
    pp = (parseFloat(bench.value) - parseFloat(margenCli.value)).toFixed(1) + "pp";
    const prosa = `${cli} está a ${pp} del benchmark de ${bench.value}.`;
    const linea = (d) => `id=c1 · op=restar · inputs=${bench.value}; ${margenCli.value} · formula=${bench.value} − ${margenCli.value} · resultado=${pp} · unidad=pp${d ? " · dueno=" + d : ""}`;
    sinDueno = guardC(`${prosa}\n\n${M}\n${linea(null)}`, CTX);
    conDueno = guardC(`${prosa}\n\n${M}\n${linea(cli)}`, CTX);
    // la cifra de OTRO cliente, puesta al lado de este: tiene que morir aunque un cálculo la use de insumo
    ajena = guardC(`${cli} vendió ${cifraDeOtro.value} en el año.`, CTX);
  }
  const P = (b) => (b ? "✅" : "🔴");
  /* R7b DEL EXAMEN 1 (2026-08-31): el sello de AMBAS corridas imprimió «camino natural REAL» en un examen del
   * AGENTE — mentía de ruta. El sello del agente ahora PRUEBA su ruta (no la declara): el bucle importado, el
   * catálogo con las tres herramientas propias, la letra F3 viajando y el juez del contrato vetando en vivo. */
  const _rutaAgente = () => {
    const cat = catalogoAgente().map((t) => t.name);
    const fijo = sistemaDelAgente(ESCENARIO_INICIAL).fijo;
    const juez = vetosDeContrato("La carga subió. Procede con la renegociación de Falabella.").some((v) => v.regla === "decision-por-tomada");
    return [
      `│ ruta             : camino AGENTE REAL (answerViaAgente + handleAgente con tier por paso) — probada, no declarada`,
      `│ bucle · catálogo : ${P(typeof answerViaAgente === "function")} answerViaAgente importado  ·  ${P(cat.includes("serieEntidad") && cat.includes("registrarSupuesto") && cat.includes("preferenciaNombre"))} las 3 herramientas del agente en el catálogo (${cat.length} total)`,
      `│ letra · juez     : ${P(/RUTEO Y CÁLCULO:/.test(fijo) && /INVARIANTES/.test(fijo))} la letra F3+[9] viaja en el system  ·  ${P(juez)} vetosDeContrato multa «procede con» en vivo`,
    ];
  };
  /* P3 · QUÉ NEGOCIO SE ESTÁ EXAMINANDO. Sin esta línea, tres corridas sobre tres datos distintos producen
   * expedientes indistinguibles — y son justo las tres que el owner quiere comparar. Con planilla se declara
   * además lo que el archivo NO trae: es lo que el escenario PARCIAL viene a medir. */
  const _negocio = () => {
    const L = [`│ NEGOCIO examinado: ${ORIGEN.nombre}  ·  origen: ${ORIGEN.tipo}`];
    if (ORIGEN.totales) {
      const t = ORIGEN.totales;
      L.push(`│ tamaño del dato  : ${t.clientes ?? "?"} clientes · ${t.skus ?? "?"} SKU · ${t.marcas ?? "?"} marcas · ${t.familias ?? "?"} familias · ${t.bodegas ?? "?"} bodegas`);
    }
    if (ORIGEN.avisos && ORIGEN.avisos.length) {
      L.push(`│ lo que el archivo NO trae (${ORIGEN.avisos.length}) — el agente debe DECLINAR nombrando esto, jamás inventarlo:`);
      for (const a of ORIGEN.avisos.slice(0, 8)) L.push(`│   · ${a.tipo}: ${String(a.detalle || "").slice(0, 96)}`);
      if (ORIGEN.avisos.length > 8) L.push(`│   · … y ${ORIGEN.avisos.length - 8} avisos más`);
    } else if (ORIGEN.tipo === "planilla") {
      L.push(`│ lo que el archivo NO trae: nada — la planilla vino completa`);
    }
    if (ORIGEN.tipo === "tenant") L.push(`│ ⚠️ RED           : esta corrida SALIÓ A LA RED contra la base para traer la empresa (no gastó modelo)`);
    return L;
  };
  return [
    `┌── SELLO DE VERSIÓN ──────────────────────────────────────────────`,
    `│ commit           : ${commit}${sucio ? "  ⚠️ con cambios sin commitear en el motor" : "  (motor limpio)"}`,
    ..._negocio(),
    ..._rutaAgente(),
    `│ escenario        : ${ESCENARIO_INICIAL}  (el MISMO que arranca la app — declarado en config/scenarios.js)`,
    `│ carpeta          : ${(_dato.match(/Ventas totales: \$[\d.]+M/) || ["?"])[0]}  ·  KPI de inventario ${/Inventario \(foto de hoy\)/.test(_dato) ? "presente ✅" : "AUSENTE 🔴"}`,
    `│ contrato · dueño : ${P(sinDueno && !sinDueno.ok && /campo «dueño»/.test(String((sinDueno.violations[0] || {}).detail || "")))} sin dueño la cuenta NO autoriza  ·  ${P(conDueno && conDueno.ok)} con dueño sí  (probado con ${cli || "?"} a ${pp || "?"} del benchmark)`,
    `│ atribución       : ${P(ajena && !ajena.ok)} la cifra de ${otro || "otro"} puesta en ${cli || "?"} NO pasa (obtuvo ${ajena ? (ajena.ok ? "PASÓ 🔴" : ajena.verdict) : "sin caso"})`,
    /* (La Poda: la línea del contrato del cerebro natural se retiró con su prompt) */
    `│ rastro interno   : ✅ activo (estado · vetos · reparaciones · cálculos · [[CALCULO]] oculto, por turno)`,
    `└──────────────────────────────────────────────────────────────────`,
  ].join("\n");
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const MODO_AGENTE = true;   // (La Poda: el único modo es el agente; el flag --agente queda aceptado por compat)
void flag("--agente");
const ESTADO = MODO_AGENTE ? "_examen_agente_estado.json" : "_examen_estado.json";

let S = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : null;
if (flag("--reset") || !S) S = { titulo: valor("--titulo") || "sin título", history: [], mem: {}, turnos: [], costoUSD: 0, llamadas: 0 };
if (valor("--titulo")) S.titulo = valor("--titulo");

if (flag("--estado")) {
  console.log(`《 ${S.titulo} 》 ${S.turnos.length} turnos · ${S.llamadas} llamadas · US$${S.costoUSD.toFixed(4)}`);
  for (const [i, t] of S.turnos.entries()) console.log(`  ${i + 1}. [${t.estado}${t.vetos.length ? " · " + t.vetos.join("|") : ""}] ${t.q.slice(0, 70)}`);
  process.exit(0);
}
/* ⚠️ LA PREGUNTA SE CONFUNDÍA CON EL VALOR DE UNA BANDERA · defecto REAL, costó una llamada (2026-09-01).
 * Esta línea excluía el valor de UNA sola bandera —`--titulo`— nombrándola a mano, así que el valor de las
 * otras tres quedaba disponible para ser tomado como pregunta. Medido: `--planilla <ruta> --sello` corrió un
 * TURNO COMPLETO con la ruta del archivo como pregunta —US$0.0748— en vez de imprimir el sello y salir. El
 * sello nunca se imprimía y, peor, cada `--reset` de un escenario con planilla habría gastado un turno en
 * basura antes de empezar: la certificación entera arrancaba torcida.
 * Se declara qué banderas LLEVAN VALOR, una sola vez. Agregar una bandera nueva sin valor ya no puede romper
 * esto; agregar una CON valor exige anotarla acá, que es donde se mira.
 * (Y se usa el índice del callback: `indexOf` devuelve la PRIMERA aparición, así que un valor repetido —dos
 * rutas iguales, o una pregunta igual a un valor— se evaluaba contra la bandera equivocada.) */
const BANDERAS_CON_VALOR = new Set(["--titulo", "--planilla", "--tenant", "--fecha"]);
const q = args.find((a, i) => !a.startsWith("--") && !BANDERAS_CON_VALOR.has(args[i - 1]));
/* ⚠️ EL RESET TIENE QUE GUARDARSE (medido 2026-08-14 en la 2ª corrida del examen 1): `--reset` sin pregunta
 * armaba el estado nuevo EN MEMORIA y salía por la puerta del «Uso:» sin escribir el archivo — así que el examen
 * siguiente arrancaba con el hilo viejo adentro y el turno 1 se corría con cinco turnos de contexto ajeno. */
if (!q && flag("--sello")) { console.log(_sello()); process.exit(0); }
if (!q && flag("--reset")) { fs.writeFileSync(ESTADO, JSON.stringify(S, null, 2)); console.log(`${_sello()}\n《 ${S.titulo} 》 estado en blanco: 0 turnos.`); process.exit(0); }
if (!q) { console.log("Uso: node _consola_examen.mjs \"la pregunta\"  ·  --reset --titulo \"…\"  ·  --estado"); process.exit(1); }

const DATO = proyectarDatoNegocio(ESCENARIO_INICIAL);
const TARIFA = Object.entries(MODEL_PRICING).find(([k]) => /sonnet/i.test(k));
const _precio = (u) => {
  if (!u || !TARIFA) return 0;
  const inN = (u.input_tokens || 0), cr = (u.cache_read_input_tokens || 0), cw = (u.cache_creation_input_tokens || 0);
  return (inN * TARIFA[1].in + cr * TARIFA[1].in * 0.1 + cw * TARIFA[1].in * 1.25 + (u.output_tokens || 0) * TARIFA[1].out) / 1e6;
};

/* EL EXPEDIENTE DEL TURNO (2026-08-14): cuando un turno cae al suplente, el veredicto solo dice el NOMBRE del
 * veto — y con eso no se puede reparar nada: hay que ver el borrador que el notario rechazó y la multa exacta
 * que se le devolvió. Se captura acá, en el caller, sin tocar una línea del producto. */
const EXPEDIENTE = () => `${MODO_AGENTE ? "_examen_agente_debug_t" : "_examen_debug_t"}${S.turnos.length}.json`;   // uno por turno: el del turno 2 no pisa al del 1
let costoTurno = 0, llamadasTurno = 0, crudoUltimo = "";
const intentos = [];
/* (La Poda 2026-09-05: acá vivía callNatural — el fetch del modo natural de esta consola) */
const callAgente = async ({ mensajes, ronda, attempt = 0, motivoReintento, cierre = false, figsEnBoleta = 0, vetoConCifra = false }) => {
  llamadasTurno++;
  /* R-eco DEL EXAMEN 1 (2026-08-31): la escalada al tier de NARRAR fue el 66% del gasto (US$0.3758, 14
   * llamadas) y produjo CERO verdes — todas con la boleta VACÍA: no había material que reescribir, solo
   * plomería rota (hoy reparada: R1/R2). El tier caro se paga SOLO cuando hay cifras verificadas que
   * reescribir; con boleta vacía, el cierre/reparación va al tier de PLAN. Mismo criterio que el adapter
   * de producción (_fetchAgente). */
  /* P3 de la corrida 2: tampoco se escala con el hilo enorme — el cierre re-paga la boleta entera en CADA
   * intento (78% del gasto de esa corrida). El techo lo declara el bucle: una sola verdad con producción. */
  const _charsHilo = (mensajes || []).reduce((n, m) => n + String((m && m.content) || "").length, 0);
  // (ii) de P2: también escala si la multa nombra una cifra (reescribir una oración) — mismo criterio que prod
  const paso = (attempt > 0 || cierre) && ((figsEnBoleta | 0) > 0 || vetoConCifra) && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";
  const data = await handleAgente({ mensajes, system: sistemaDelAgente(ESCENARIO_INICIAL).fijo, tools: catalogoAgente(), paso, attempt, motivoReintento }, process.env);
  if (data && typeof data.costUSD === "number") costoTurno += data.costUSD;   // el costo lo estima el gateway con el MODELO REAL (tier por paso), no la tarifa sonnet de la consola
  if (!data || !data.ok) throw new Error((data && data.error) || "gateway sin agente");
  crudoUltimo = data.tipo === "texto" ? String(data.texto || "") : `[pedidos] ${JSON.stringify(data.pedidos || [])}`;
  /* EL GRITO DE LA VACÍA (heredado del natural, re-cableado en La Poda): cuatro turnos vacíos fueron
   * indiagnosticables por no guardar el motivo de corte — acá se grita y se guarda SIEMPRE. */
  if (data.tipo === "texto" && !String(data.texto || "").trim()) {
    console.log(`   ⚠ CADENA VACÍA · motivo de corte del proveedor: ${String((data && data.stop) || "(no declarado)")}`);
  }
  intentos.push({ intento: llamadasTurno, ronda, paso, motivoReintento: motivoReintento || null, tipo: data.tipo, borrador: crudoUltimo,
    stop: (data && data.stop) || null,   // el motivo de corte, SIEMPRE: comparar una vacía contra una buena es el diagnóstico
    usage: data.usage || null, modelo: data.model || null, costUSD: data.costUSD ?? null });
  return data.tipo === "herramientas" ? { tipo: "herramientas", pedidos: data.pedidos || [], stop: (data && data.stop) || null } : { tipo: "texto", texto: String(data.texto || ""), stop: (data && data.stop) || null };
};

const t0 = Date.now();
let out;
try {
  out = await answerViaAgente({ text: q, history: S.history, mem: S.mem, scenario: ESCENARIO_INICIAL, callAgente });
} catch (e) { console.log(`\n🔴 EL CAMINO AGENTE LANZÓ: ${String(e && e.message).slice(0, 160)}\n   (en producción, este turno caería en cascada al oráculo sin que el usuario vea el error)`); process.exit(1); }

const nat = (out.r && (MODO_AGENTE ? out.r.agente : out.r.natural)) || {};
const visible = String(out.r.text || "");
S.history = S.history.concat([{ role: "user", text: q }, { role: "adi", text: visible }]);
S.mem = out.mem || S.mem;
S.costoUSD += costoTurno; S.llamadas += llamadasTurno;
/* P3 · el expediente declara SOBRE QUÉ NEGOCIO se corrió y qué le faltaba al dato. Se escribe una vez por
 * corrida (no por turno): es lo que hace comparables los tres escenarios del owner una semana después. */
S.negocio = { tipo: ORIGEN.tipo, nombre: ORIGEN.nombre, totales: ORIGEN.totales || null,
  falta: (ORIGEN.avisos || []).map((a) => ({ tipo: a.tipo, detalle: String(a.detalle || "").slice(0, 160) })) };
S.turnos.push({ q, estado: nat.estado || "?", vetos: nat.vetos || [], costoUSD: costoTurno, visible,
  ...(MODO_AGENTE ? { herramientas: nat.calls ?? 0, figs: nat.figs ?? 0, recitaCifras: nat.recitaCifras ?? 0, reintentosGuard: intentos.filter((i) => i.motivoReintento === "guard").length,
    // cuando el dato no soportó algo, el motivo del MOTOR queda en el expediente: es lo que el escenario
    // PARCIAL viene a medir («declinó nombrando la columna que falta» vs «se disculpó»).
    motivosDelDato: (nat.motivos || []).slice(0, 3) } : {}) });
fs.writeFileSync(ESTADO, JSON.stringify(S, null, 2), "utf8");

console.log(`\n╔═══ ${S.titulo} · turno ${S.turnos.length} ═══╗`);
console.log(`❯ ${q}\n`);
console.log("┌── LO QUE VE EL USUARIO ──────────────────────────────────────────");
console.log(visible.split("\n").map((l) => "│ " + l).join("\n"));
console.log("└──────────────────────────────────────────────────────────────────");
const fugaCalc = visible.includes(MARCA_CALCULO) || /\bid=c\d+\s*·|\bop=[a-z_]+\s*·/.test(visible);
console.log(`\n┌── EL VEREDICTO INTERNO${MODO_AGENTE ? " · AGENTE" : ""} ──────────────────────────────────`);
if (MODO_AGENTE) {
  console.log(`│ rondas · calls   : ${nat.rondas ?? "?"} · ${nat.calls ?? "?"} herramientas ejecutadas`);
  console.log(`│ figs en boleta   : ${nat.figs ?? "?"} · re-cita en mem: ${nat.recitaCifras ?? 0} cifras aprobadas`);
  if (nat.motivos && nat.motivos.length) console.log(`│ límites del dato : ${nat.motivos.join("  ·  ")}`);
  /* R7 (2026-08-31): el post-mortem del examen 1 quedó a ciegas — «vetos: ninguno» con 14 turnos reintentando
   * por guard. Ahora se cuentan los reintentos Y las multas viajan (nat.vetos, del bucle). */
  const porGuard = intentos.filter((i) => i.motivoReintento === "guard").length;
  console.log(`│ reintentos guard : ${porGuard}`);
}
/* [10] (2026-08-31): un «verde» sin UNA herramienta ni UNA cifra no certifica lectura — se marca para que el
 * tablero no lo cuente igual que un verde con boleta (T16/T20 del examen: limitación falsa sellada verde). */
const sinLectura = MODO_AGENTE && nat.estado === "verde" && !(nat.calls > 0) && !(nat.figs > 0) && !(nat.recitaCifras > 0);
console.log(`│ estado           : ${nat.estado || "?"}${nat.suplenteDigno ? "  ⚠️ respondió el SUPLENTE DIGNO" : ""}${sinLectura ? "  ⚠️ VERDE SIN LECTURA (0 herramientas · 0 figs · 0 re-citas)" : ""}`);
console.log(`│ vetos            : ${(nat.vetos || []).length ? nat.vetos.join("  ·  ") : "ninguno"}`);
console.log(`│ reparaciones     : ${nat.reparaciones ?? (nat.estado === "reparado" ? 1 : 0)}`);
console.log(`│ vacías           : ${(nat.vacias || []).length ? nat.vacias.join(",") : "0"}`);
console.log(`│ cálculos declar. : ${nat.calculosDeclarados ?? "—"}`);
console.log(`│ alcance heredado : ${nat.alcanceHeredado ? JSON.stringify(nat.alcanceHeredado.entities || nat.alcanceHeredado) : "—"}`);
console.log(`│ re-cita en mem   : ${(S.mem.recitaAprobada && S.mem.recitaAprobada.figs && S.mem.recitaAprobada.figs.length) || 0} cifras aprobadas`);
console.log(`│ [[CALCULO]]      : ${fugaCalc ? "🔴 FUGA — el bloque llegó a pantalla" : "✅ oculto"}${crudoUltimo.includes(MARCA_CALCULO) ? " (el cerebro SÍ lo declaró)" : " (el cerebro no lo declaró este turno)"}`);
console.log(`│ llamadas · costo : ${llamadasTurno} · US$${costoTurno.toFixed(4)}   ·   acumulado: ${S.llamadas} · US$${S.costoUSD.toFixed(4)}`);
console.log(`│ tiempo           : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`└──────────────────────────────────────────────────────────────────`);
fs.writeFileSync(EXPEDIENTE(), JSON.stringify({ q, estado: nat.estado, vetos: nat.vetos, intentos }, null, 2), "utf8");
// si el turno NO salió del cerebro, se muestra en pantalla POR QUÉ: el último borrador rechazado y la multa que
// se le devolvió. Sin esto, un «suplente» es un callejón sin salida para quien tiene que arreglarlo.
if (nat.suplenteDigno && intentos.length) {
  const ult = intentos[intentos.length - 1];
  console.log(`\n┌── EL BORRADOR QUE EL NOTARIO RECHAZÓ (intento ${ult.intento} de ${intentos.length}) ─────────`);
  console.log(String(ult.borrador || "").split("\n").slice(-24).map((l) => "│ " + l).join("\n"));
  if (ult.multaRecibida) {
    const m = String(ult.multaRecibida).match(/\[[a-z-]+\][\s\S]*/);
    console.log(`├── LA MULTA QUE SE LE DEVOLVIÓ ANTES DE ESE BORRADOR ─────────────`);
    console.log(String(m ? m[0] : ult.multaRecibida).split("\n").slice(0, 8).map((l) => "│ " + l).join("\n"));
  }
  console.log(`└── expediente completo en ${EXPEDIENTE()} ──────────────────────`);
}
