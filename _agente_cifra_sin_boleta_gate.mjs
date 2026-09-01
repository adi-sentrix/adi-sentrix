/* === _agente_cifra_sin_boleta_gate.mjs · EL JUEZ DEL TURNO QUE NO LEYÓ (certificación 2026-09-01) ===========
 *
 * EL DEFECTO: en el turno 7 salió a pantalla **$800K** con la boleta VACÍA — el turno no corrió una sola
 * herramienta. La cifra no estaba en la boleta, ni en la re-cita, ni en el dato. Pasó el muro por la quinta
 * fuente: `esCalculoDelCatalogo` autoriza si **existe alguna cuenta del catálogo que dé el número**, y la
 * cuenta que la autorizó fue `$17,9M × 4,5% = $805.500`, mientras la oración afirmaba otra («2-3 puntos de
 * $19,4M» = $388K–$582K). Medido: 21% de los montos inventados pasan así, y 39 de los 41 que pasan no están
 * en el dato. guardC NO se toca: este juez se SUMA, como `vetosDeContrato`.
 *
 * LAS CUATRO CARNADAS SON LOS CUATRO TURNOS DE LA CORRIDA, y cada una prueba algo distinto (el orden es el que
 * pidió el supervisor, con la del t1 primero porque es la que más caro sale equivocar):
 *   t1 · las 7 brechas en pp del playbook  → prueba que con boleta LLENA el juez no se asoma.
 *   t3 · el $655K que calcula el MOTOR     → lo mismo por otra vía: la cifra sellada de otro lado.
 *   t5 · «2 puntos porcentuales»           → el supuesto del usuario escrito en palabras se empareja.
 *   t7 · $800K                             → el defecto: tiene que morir.
 * Un juez que mate cualquiera de los tres primeros es peor que el agujero que cierra.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo · bandera ADI_AGENTE APAGADA.
 * `node --import ./scripts/offline-guard.mjs _agente_cifra_sin_boleta_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { recitaAprobadaDe } from "./src/adi/oracle/cicloNotarial.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { vetoCifraSinBoleta } from "./src/adi/agente/cifraSinBoleta.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const dp = cifrasDelDato(ESCENARIO_INICIAL);
const juez = (o) => vetoCifraSinBoleta({ datoProyectado: dp, ...o });

/* ═══ 1 · CONDICIÓN A · ACOTADO AL AGENTE, sin excepción ═════════════════════════════════════════════════════
 * El camino natural corre en PRODUCCIÓN y arma su juez con `ledger: { figs: [] }` FIJO — su boleta está vacía
 * SIEMPRE. Aplicarle esta regla no lo endurecería: lo apagaría. Medido: sobre 24 frases correctas del dato,
 * quitarle la quinta fuente al natural deja pasar 0 de 24. */
H("1 · el juez vive SOLO en el agente — el natural no puede importarlo");
{
  const ROOT = process.cwd();
  const fuera = [];
  const mirar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/node_modules|\.git/.test(e.name)) mirar(p); continue; }
      if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
      const rel = path.relative(ROOT, p).replace(/\\/g, "/");
      if (rel.startsWith("src/adi/agente/") || rel.endsWith("_gate.mjs")) continue;
      if (/cifraSinBoleta/.test(fs.readFileSync(p, "utf8"))) fuera.push(rel);
    }
  };
  mirar(path.join(ROOT, "src"));
  ok(!fuera.length, "★ nadie fuera de `src/adi/agente/` importa el juez — el camino natural queda intacto", fuera.join(" · "));
  const natural = fs.readFileSync(path.join(ROOT, "src", "adi", "oracle", "caminoNatural.js"), "utf8");
  ok(/ledger: \{ figs: \[\] \}/.test(natural),
    "…y sigue siendo cierto POR QUÉ: el natural arma su juez con la boleta vacía fija, en todos sus turnos");
}

/* ═══ 2 · LOS CUATRO TURNOS DE LA CORRIDA ═══════════════════════════════════════════════════════════════════ */
H("2 · los cuatro turnos de la certificación, cada uno con su motivo");
{
  // t1 · el playbook deja 63 cifras en la boleta. Las 7 brechas en pp salen de ahí: el juez NO se asoma.
  const T1 = "Tu margen está 8,6 puntos bajo el benchmark. Falabella cede 8,1pp · Lider 6,6pp · Jumbo 6,1pp.";
  ok(juez({ texto: T1, figsEnBoleta: 63, pregunta: "qué clientes están bajo el benchmark" }) === null,
    "★ t1 · con la boleta LLENA (63 cifras) el juez ni se asoma — las brechas del playbook viven");
  ok(juez({ texto: T1, figsEnBoleta: 1, pregunta: "…" }) === null,
    "…y alcanza UNA sola cifra leída: la condición es «no leyó nada», no «leyó poco»");

  // t3 · el subtotal que calcula el MOTOR viene sellado en la boleta del turno.
  ok(juez({ texto: "Los ocho clientes bajo el benchmark suman $655K de contribución no capturada.", figsEnBoleta: 63,
    pregunta: "cuánto dejo sobre la mesa" }) === null,
    "★ t3 · el $655K que calcula el motor pasa: llega sellado en la boleta, no lo inventó el cerebro");

  // t5 · el supuesto que el usuario escribió EN PALABRAS.
  const T5 = "Con esos 2 pp menos de acciones comerciales, ninguno queda sobre el benchmark de 30.1%.";
  ok(juez({ texto: T5, figsEnBoleta: 0,
    pregunta: "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark." }) === null,
    "★ t5 · «2 puntos porcentuales» se empareja con «2 pp» — el supuesto del usuario es suyo, no una invención",
    JSON.stringify(juez({ texto: T5, figsEnBoleta: 0, pregunta: "reducir 2 puntos porcentuales" })));

  // t7 · EL DEFECTO.
  const T7 = "Falabella es el foco porque es tu cliente más grande ($19.4M) y la brecha es auditable. Si recuperas 2-3 puntos ahí, son $800K anuales.";
  const v7 = juez({ texto: T7, figsEnBoleta: 0, pregunta: "Dame una versión más dura, como si tuviera que presentarla al gerente general." });
  ok(!!v7 && v7.cifras.includes("$800K"),
    "★ t7 · EL DEFECTO: $800K con la boleta vacía se multa — la cifra que el muro dejó pasar", JSON.stringify(v7 && v7.cifras));
  ok(!!v7 && !v7.cifras.includes("$19.4M"),
    "…y en la MISMA oración, el $19.4M que SÍ está en el dato no se toca: se multa la cifra, no el turno");
}

/* ═══ 3 · EL CANAL CORRECTO PARA UNA CIFRA DERIVADA ══════════════════════════════════════════════════════════
 * Formulación del supervisor: lo que hay que matar no es «la cifra derivada», es «la cifra derivada por una
 * cuenta que la oración NO declara». El mecanismo ya existe y es del owner: el bloque [[CALCULO]], que guardC
 * RECOMPUTA. Este juez lo respeta en vez de duplicarlo. */
H("3 · una cuenta DECLARADA pasa; la misma cuenta en prosa, no");
{
  /* ⚠️ LA CIFRA DE LA PRUEBA SALE DEL DATO, NO DE UN LITERAL. Este bloque tenía «$100.0M» escrito a mano y
   * funcionaba solo porque el gate corría con `scenario: "actual"` — que NO es un escenario declarado
   * (`scenarios.js:14`) y cae al dato crudo. Con el escenario REAL el literal no existe en el dato y el check
   * se ponía rojo con razón. La regla vale también para un gate: si la cifra no sale del dato, el gate mide un
   * negocio que el producto no sirve. Se toma el total del negocio TAL COMO el dato lo publica y se arma la
   * cuenta con él, así el bloque sigue siendo cierto en cualquier escenario. */
  const _totalDelNegocio = (dp.figs || []).find((f) => /^money:/.test(String(f.canon))
    && Array.isArray(f.duenos) && f.duenos.includes("negocio") && f.duenos.includes("total")
    && !f.duenos.includes("anterior"));   // la del PERÍODO, no la del año anterior
  ok(!!_totalDelNegocio, "el dato publica un total del negocio con el que armar la prueba", JSON.stringify(_totalDelNegocio));
  const BASE = String(_totalDelNegocio.value);                                  // p.ej. «$99.9M» en bonanza
  const _raw = Number(String(BASE).replace(/[^\d.]/g, "")) * 1e6;
  const RES = `$${((_raw * 1.04) / 1e6).toFixed(1)}M`;                          // la cuenta, con la misma escala
  const PROSA = `Ventas totales del negocio: ${BASE} proyectados × 1.04 = ${RES}. Es una proyección con tu supuesto.`;
  const DECL = PROSA + `\n\n[[CALCULO]]\nid=c1 · op=aplicar_pct · inputs=${BASE}; 4% · formula=${BASE} + 4% · resultado=${RES} · unidad=money\n`;
  const Q = "Si subo ventas 4%, ¿qué cambia?";
  ok(!!juez({ texto: PROSA, figsEnBoleta: 0, pregunta: Q }),
    `★ la cuenta escrita SOLO en prosa, con boleta vacía, se multa (${BASE} × 1.04 = ${RES})`);
  ok(juez({ texto: DECL, figsEnBoleta: 0, pregunta: Q }) === null,
    "★ y la MISMA cuenta declarada en [[CALCULO]] pasa — guardC ya la recomputó con sus insumos",
    JSON.stringify(juez({ texto: DECL, figsEnBoleta: 0, pregunta: Q })));
  // end-to-end, por el bucle real: es lo único que prueba que el canal está conectado de verdad
  const turno = (texto) => answerViaAgente({ text: Q, history: [], mem: {},
    scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto }) });
  const rP = await turno(PROSA), rD = await turno(DECL);
  ok(rP.r.agente.estado !== "verde", `★ end-to-end · en prosa el turno NO sale verde (${rP.r.agente.estado})`);
  ok(rD.r.agente.estado === "verde", `★ end-to-end · declarado SÍ (${rD.r.agente.estado}) — el camino está abierto, no cerrado`);
}

/* ═══ 4 · LAS TRES FUENTES DE RESPALDO, una por una ═════════════════════════════════════════════════════════ */
H("4 · lo que sí respalda una cifra con la boleta vacía");
{
  const Q = "y entonces?";
  ok(juez({ texto: "El benchmark de margen es 30.1%.", figsEnBoleta: 0, pregunta: Q }) === null,
    "el DATO: una cifra que el archivo trae pasa (el benchmark)");
  ok(juez({ texto: "Son 13 clientes en la cartera.", figsEnBoleta: 0, pregunta: Q }) === null,
    "los CONTEOS del dato: «13 clientes» pasa");
  const recita = recitaAprobadaDe({ textoAprobado: "Falabella cerró en $19.4M de venta.", catalogoEntidades: ["Falabella"], previa: null });
  ok(juez({ texto: "Esa venta de Falabella de $19.4M sigue en pie.", figsEnBoleta: 0, pregunta: Q, recitaAprobada: recita }) === null,
    "la RE-CITA: una cifra que ADI ya mostró y el muro aprobó pasa");
  ok(juez({ texto: "Con tu supuesto de 7% el número cambia.", figsEnBoleta: 0, pregunta: "ponele que crezco 7%" }) === null,
    "la PREGUNTA del usuario: su propio supuesto es suyo");
  ok(!!juez({ texto: "Eso son $42K anuales.", figsEnBoleta: 0, pregunta: Q }),
    "★ y una cifra que no sale de ninguna de las tres, no");
}

/* ═══ 5 · EL DESPLAZAMIENTO DE CONDUCTA, MEDIDO (condición B del supervisor) ════════════════════════════════
 * «Quiero el número: cuántos turnos del corpus se mueven de verde a reparado/límite. Si es alto, el arreglo
 * necesita que la letra le enseñe a declarar, no solo que el juez lo multe.» Se mide acá y no en un chat, para
 * que el día que alguien afloje el juez el número se mueva a la vista. */
H("5 · el desplazamiento sobre el corpus de exámenes");
{
  const R = "C:/Users/jcnav/ADI-Sentrix/ADI_PROYECTO/";
  const duenos = [];
  for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { duenos.push(...axisEntityNames(e)); } catch { /* sin índice */ } }
  let total = 0, sinBoleta = 0, mueven = 0; const cuales = [];
  for (const f of ["_examen_agente_estado.json", "_examen_agente_estado_escenario1.json"]) {
    let j; try { j = JSON.parse(fs.readFileSync(R + f, "utf8")); } catch { continue; }
    let recita = null;
    for (const [i, t] of (j.turnos || []).entries()) {
      if (!t || !t.visible) continue;
      total++;
      if (Number(t.figs || 0) === 0) {
        sinBoleta++;
        const v = juez({ texto: t.visible, figsEnBoleta: 0, pregunta: t.q, recitaAprobada: recita });
        if (v) { mueven++; cuales.push(`t${i + 1}(${v.cifras.join(",")})`); }
      }
      const n = recitaAprobadaDe({ textoAprobado: t.visible, catalogoEntidades: duenos, previa: recita });
      if (n) recita = n;
    }
  }
  if (!total) { ok(false, "el corpus de exámenes no está donde se esperaba — la medición no corrió"); }
  else {
    console.log(`      corpus: ${total} turnos · ${sinBoleta} con boleta vacía · se mueven ${mueven}`);
    ok(mueven <= 2, `★ el desplazamiento es ${mueven} de ${total} turnos (${cuales.join(" ")}) — y son el defecto, no respuestas correctas`);
    ok(cuales.every((c) => /\$800K/.test(c)), "★ y todo lo que se mueve es el $800K del t7: cero respuestas correctas apagadas", cuales.join(" "));
  }
}

/* ═══ 6 · CARNADAS ══════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · carnadas");
const carnada = async (nombre, archivo, reemplazos, comprobar) => {
  const p = path.join(process.cwd(), archivo);
  const original = fs.readFileSync(p, "utf8");
  let mutado = original, aplicados = 0;
  for (const [re, por] of reemplazos) { const antes = mutado; mutado = mutado.replace(re, por); if (mutado !== antes) aplicados++; }
  if (aplicados !== reemplazos.length) { fail++; console.log(`  ✗ carnada «${nombre}»: el patrón no existe más — carnada muerta`); return; }
  fs.writeFileSync(p, mutado);
  try {
    const mod = await import(`${pathToFileURL(p).href}?carnada=${encodeURIComponent(nombre)}`);
    const cayo = await comprobar(mod);
    ok(cayo, `carnada «${nombre}» → el chequeo se pone ROJO`, cayo === false ? "el defecto pasó DESAPERCIBIDO" : undefined);
  } finally { fs.writeFileSync(p, original); }
};

// (a) LA MÁS CARA DE EQUIVOCAR: si alguien le saca la condición de boleta vacía, el playbook entero se apaga.
await carnada("el juez se asoma aunque el turno HAYA leído (el playbook muere)", "src/adi/agente/cifraSinBoleta.js",
  [[/  if \(Number\(figsEnBoleta\) > 0\) return null;/, "  // CARNADA: la condición de boleta vacía, retirada"]],
  async (M) => !!M.vetoCifraSinBoleta({ texto: "Falabella cede 8,1pp contra el benchmark.", figsEnBoleta: 63,
    pregunta: "qué clientes están bajo el benchmark", datoProyectado: dp }));

// (b) el canal del cálculo declarado, tapado: el camino correcto para una cifra derivada deja de existir y el
// cerebro se queda sin salida — multado haga lo que haga.
await carnada("el cálculo declarado deja de valer", "src/adi/agente/cifraSinBoleta.js",
  [[/  const declaradas = _declaradasEnCalculo\(texto\);/, "  const declaradas = new Set();   // CARNADA"]],
  async (M) => !!M.vetoCifraSinBoleta({ figsEnBoleta: 0, pregunta: "Si subo ventas 4%, ¿qué cambia?", datoProyectado: dp,
    /* la cifra de ESTA carnada es deliberadamente ajena al dato: lo que se prueba es que, tapado el canal del
     * cálculo, un resultado DECLARADO vuelve a multarse. Si saliera del dato pasaría por la otra puerta y la
     * carnada mediría otra cosa. */
    texto: "Proyección: $77.7M.\n\n[[CALCULO]]\nid=c1 · op=aplicar_pct · inputs=$74.7M; 4% · formula=$74.7M + 4% · resultado=$77.7M · unidad=money\n" }));

// (c) el supuesto del usuario, ignorado: su propia cifra se le devuelve como invención (el t5).
await carnada("el supuesto del usuario deja de contar como suyo", "src/adi/agente/cifraSinBoleta.js",
  [[/  const delUsuario = new Set\(parseFigures\(String\(pregunta \|\| ""\)\)\.map\(\(x\) => x\.canon\)\);/,
    "  const delUsuario = new Set();   // CARNADA"]],
  async (M) => !!M.vetoCifraSinBoleta({ texto: "Con esos 2 pp menos, ninguno queda arriba.", figsEnBoleta: 0,
    pregunta: "simula reducir 2 puntos porcentuales", datoProyectado: dp }));

// (d) EL DEFECTO MISMO: el juez desconectado del bucle. Sin esto, el $800K del t7 vuelve a pantalla.
await carnada("el juez desconectado del bucle", "src/adi/agente/bucleAgente.js",
  [[/    const vSinBoleta = \(sitio === "cierre" \|\| sitio === "reparacion"\) \? vetoCifraSinBoleta\(\{/,
    "    const vSinBoleta = false ? vetoCifraSinBoleta({"]],
  async (M) => {
    initTenant(TENANT_DEMO);
    const T7 = "Falabella es el foco porque es tu cliente más grande ($19.4M). Si recuperas 2-3 puntos ahí, son $800K anuales.";
    const r = await M.answerViaAgente({ text: "Dame una versión más dura.", history: [], mem: {}, scenario: ESCENARIO_INICIAL,
      callAgente: async () => ({ tipo: "texto", texto: T7 }) });
    return /\$800K/.test(String(r.r.text || ""));   // el defecto: la cifra vuelve a pantalla
  });

console.log(`\n── _agente_cifra_sin_boleta_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
