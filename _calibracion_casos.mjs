/* === _calibracion_casos.mjs · LOS CASOS Y LA EVALUACIÓN DE LA MATRIZ DE LA CONSTITUCIÓN — módulo compartido
 * entre el instrumento verboso (_calibracion_notario.mjs) y el candado de la suite (_constitucion_matriz_gate.mjs).
 * UNA sola lista de casos y UNA sola evaluación: el gate y el instrumento no pueden divergir. CERO red, CERO .env. */
import fs from "fs";
import { guardC, ensureCountAuthorized } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CIFRAS = cifrasDelDato("actual");
const _ejes = (ejes) => { const o = []; for (const e of ejes) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice */ } } return o.length ? o : null; };
const ENTIDADES = _ejes(["cliente", "sku", "marca"]);
const DUENOS = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);

const congelado = JSON.parse(fs.readFileSync("_prueba_un_cerebro.json", "utf8"));

/* ════ LOS CASOS · cada uno con su tipo y su chequeo esperado (exigencia 2) ════ */
/* P2 — EL HALLAZGO DE LA CALIBRACIÓN (2026-08-14): el texto congelado «disciplinado» TAMBIÉN inventó — dice
 * «$43K … frenados en 4 SKU» cuando el motor declara 3 SKU frenados y $33K (metió a PHI-IRON-PRO, que no cumple
 * ni el piso de rotación ni el techo de días). El chequeo de estados lo cazó: NO era un falso positivo.
 * → el positivo P2 es la versión CORREGIDA al dato del motor; el original va a los negativos como N9 —
 * el mejor control negativo posible: un invento REAL de Sonnet, no uno sintético. */
const _p2Original = congelado.registro[1].lavado;
const _p2Corregido = _p2Original
  .replace("$43K de $135K en inventario (32%) frenados en 4 SKU", "$33K de $135K en inventario frenados en 3 SKU")
  .replace(/frenados en 4 SKU/g, "frenados en 3 SKU")
  // segundo invento del mismo texto (cazado por el notario en la 3ª pasada): «los 180 días» es un plazo que no
  // existe en el dato (el techo declarado es 120) — la corrección cita el techo real.
  .replace("antes de que cruce los 180 días", "que ya cruzó el techo de 120 días")
  .replace("La causa no es la misma en los cuatro", "La causa no es la misma en los tres");

export const CASOS_REF = null;
const CASOS = [
  // ── POSITIVOS CONGELADOS (los 5 textos naturales de _prueba_un_cerebro.json; P2 corregido al motor) ──
  ...congelado.registro.map((r, i) => ({
    id: `P${i + 1}·congelado${i === 1 ? "·CORREGIDO" : ""}·${r.q.slice(0, 34)}`, q: r.q,
    texto: i === 1 ? _p2Corregido : r.lavado, espera: "PASA",
    tipo: "respuesta completa (cifras + comparación + recomendación)",
    afirma: i === 1 ? "la misma respuesta con la clasificación DEL MOTOR (3 frenados, $33K)" : "las cifras de la carpeta con dueño, cuentas con fórmula, juicio asesor sobre evidencia",
  })),

  // ── PARÁFRASIS POSITIVAS (exigencia 3: lenguaje natural legítimo debe pasar) ──
  { id: "P6·paráfrasis·conteo «tres principales»", espera: "PASA", tipo: "conteo auto-enumerado",
    afirma: "un conteo que la propia respuesta enumera (3 dichos, 3 listados, todos reales)",
    q: "¿quiénes están peor?", texto: "Tus tres principales clientes bajo el benchmark de 30.1% son Lider con 21.5%, Falabella con 22.0% y Sodimac con 23.5%." },
  { id: "P7·paráfrasis·supuesto «crece 6%» con fórmula", espera: "PASA", tipo: "cálculo derivado (simulación)",
    afirma: "una derivada con su fórmula a la vista sobre dato base + supuesto del usuario",
    q: "si crece 6% qué pasa", texto: "Tus ventas totales marcan $100.0M. Con tu supuesto de +6%: $100.0M × 1.06 = $106.0M. Bajo este supuesto, generaría $6.0M adicionales — es una proyección, no un dato observado." },
  { id: "P8·política-del-2%·interpretación declarada", espera: "PASA", tipo: "ambigüedad declarada + cálculo",
    afirma: "la lectura elegida del «2%» dicha explícita, con la cuenta mostrada",
    q: "baja 2% la carga de Falabella", texto: "Interpreto ese 2% como 2 puntos porcentuales: la carga comercial de Falabella marca 4.5%, y 4.5% − 2.0pp = 2.5%. Si te referías a un 2% relativo, el resultado cambia — dime y lo recalculo." },
  { id: "P10·corrida doble·la cuenta escrita como la escribe un asesor", espera: "PASA", tipo: "cálculo derivado (forma monto ± % = monto)",
    afirma: "«$100.0M + 4% = $104.0M» — la forma que la corrida doble del 2026-08-14 midió vetada siendo legítima",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Bajo ese supuesto, las ventas totales del negocio pasarían de $100.0M + 4% = $104.0M — son $4.0M adicionales. Es una proyección con tu supuesto, no un dato observado." },
  { id: "N10·corrida doble·la misma forma con la cuenta MAL", espera: "MUERE", tipo: "cálculo derivado falso", chequeoEsperado: /cifra-no-autorizada/, construido: false,
    afirma: "la misma forma pero con el resultado que no cierra: recomputar tiene que cazarlo",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Bajo ese supuesto, las ventas totales del negocio pasarían de $100.0M + 4% = $117.0M." },
  // chequeoEsperado acepta las DOS de la familia «cifra»: según si el valor inventado coincide o no con alguna
  // cifra del dato, muere por `cifra-no-autorizada` o por `cifra-de-dato-sin-dueno` (27.0% existe en la carpeta
  // con otro dueño). Son el mismo veredicto de fondo — «esa cifra no está autorizada acá» —, no dos categorías.
  { id: "N12·la flecha en tasas con un salto que el usuario NO declaró", espera: "MUERE", tipo: "cálculo derivado falso", chequeoEsperado: /cifra-no-autorizada|cifra-de-dato-sin-dueno/, construido: false,
    afirma: "«de 22.0% a 27.0%» son 5 puntos cuando el usuario declaró 2 — la flecha no puede autorizar cualquier salto",
    q: "reduce en 2 puntos las acciones comerciales de Falabella",
    texto: "Con ese cambio, el margen de Falabella pasa de 22.0% a 27.0%." },
  /* ESLABÓN 5 del recorrido medido: el alcance heredado. `ctx.alcanceHeredado` solo viaja cuando el turno
   * resolvió una referencia deíctica contra el turno anterior — los candidatos son los del MISMO eje. */
  { id: "P11·alcance heredado·responde sobre ESOS clientes", espera: "PASA", tipo: "alcance heredado",
    afirma: "la respuesta habla de las cuentas del turno anterior (Falabella, Lider, Jumbo, Sodimac)",
    ctx: { alcanceHeredado: { entities: ["Falabella", "Lider", "Jumbo", "Sodimac"], candidatos: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre", "ABC", "Easy", "Unimarc", "Hites", "La Polar"] } },
    q: "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark",
    texto: "Con 2 puntos menos de carga en cada una: Falabella pasa de 22.0% a 24.0%, Lider de 21.5% a 23.5%, Jumbo de 24.0% a 26.0% y Sodimac de 23.5% a 25.5%. Ninguna cruza tu benchmark de 30.1% — es una proyección con tu supuesto, no un dato observado." },
  { id: "N11·alcance heredado·cambia el conjunto en silencio", espera: "MUERE", tipo: "alcance heredado", chequeoEsperado: /alcance-heredado/, construido: false,
    afirma: "responde sobre Paris y Tottus cuando la pregunta era sobre las cuatro cuentas del turno anterior",
    ctx: { alcanceHeredado: { entities: ["Falabella", "Lider", "Jumbo", "Sodimac"], candidatos: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre", "ABC", "Easy", "Unimarc", "Hites", "La Polar"] } },
    q: "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark",
    texto: "Con esa baja, Paris queda en 28.5% y Tottus en 30.0% — Paris sigue bajo tu benchmark de 30.1%." },
  /* LAS FORMAS NATURALES DE LA CUENTA (mini doble enfocada 2026-08-14: el notario vetaba 4 de 5 formas en que un
   * asesor escribe la misma operación). Cada positivo tiene su negativo con el resultado que NO cierra. */
  { id: "P12·cuenta·factor con palabra en medio", espera: "PASA", tipo: "cálculo derivado",
    afirma: "«$100.0M proyectados × 1.04 = $104.0M» — la redacción natural del mismo cálculo",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Es una proyección con tu supuesto." },
  { id: "N13·cuenta·factor con palabra en medio, resultado MAL", espera: "MUERE", tipo: "cálculo derivado falso", chequeoEsperado: /cifra-no-autorizada|cifra-de-dato-sin-dueno/, construido: false,
    afirma: "la misma forma con el resultado que no cierra",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $121.0M." },
  { id: "P13·cuenta·tasa sobre monto, resultado último", espera: "PASA", tipo: "cálculo derivado",
    afirma: "«$104.0M proyectados × 25.1% = $26.1M» — la tasa del dato aplicada al monto",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Contribución del negocio: $104.0M proyectados × 25.1% = $26.1M. Es una proyección con tu supuesto." },
  { id: "P14·cuenta·resta con resultado último", espera: "PASA", tipo: "cálculo derivado",
    afirma: "«$104.0M − $26.1M = $77.9M» — la cascada como se escribe",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Contribución del negocio: $104.0M proyectados × 25.1% = $26.1M. El costo implícito del negocio queda en $104.0M proyectados − $26.1M = $77.9M. Es una proyección con tu supuesto." },
  { id: "N14·cuenta·resta con resultado MAL", espera: "MUERE", tipo: "cálculo derivado falso", chequeoEsperado: /cifra-no-autorizada|cifra-de-dato-sin-dueno/, construido: false,
    afirma: "la resta que no cierra",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. El costo implícito del negocio queda en $104.0M proyectados − $26.1M = $61.4M." },
  { id: "P15·cuenta·comparación entre dos montos de la oración", espera: "PASA", tipo: "cálculo derivado (variación)",
    afirma: "«$104.0M quedaría 7.2% sobre el presupuesto ($97.0M)» — la variación entre dos montos que la oración nombra",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Esa proyección de $104.0M quedaría 7.2% sobre el presupuesto del negocio ($97.0M). Es una proyección con tu supuesto." },
  { id: "N15·cuenta·comparación con el % MAL", espera: "MUERE", tipo: "cálculo derivado falso", chequeoEsperado: /cifra-no-autorizada|cifra-de-dato-sin-dueno/, construido: false,
    afirma: "la misma comparación con una variación que no es la de esos dos montos",
    q: "Si subo ventas 4%, ¿qué cambia?", texto: "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Esa proyección de $104.0M quedaría 19.4% sobre el presupuesto del negocio ($97.0M)." },
  /* LAS OMISIONES DEL ALCANCE HEREDADO (decisión del owner 2026-08-14) */
  { id: "N16·alcance heredado·deja fuera una cuenta en silencio", espera: "MUERE", tipo: "alcance heredado", chequeoEsperado: /alcance-heredado-incompleto/, construido: false,
    afirma: "responde sobre 3 de las 4 cuentas del turno anterior sin decir que filtró",
    ctx: { alcanceHeredado: { entities: ["Falabella", "Lider", "Jumbo", "Sodimac"], candidatos: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre", "ABC", "Easy", "Unimarc", "Hites", "La Polar"] } },
    q: "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark",
    texto: "Con 2 puntos menos de carga: Falabella pasa de 22.0% a 24.0%, Lider de 21.5% a 23.5% y Jumbo de 24.0% a 26.0%. Ninguna cruza tu benchmark de 30.1%." },
  { id: "P16·alcance heredado·subconjunto DECLARADO", espera: "PASA", tipo: "alcance heredado",
    afirma: "se queda con una cuenta, pero lo dice — la salida explícita que el owner pidió",
    ctx: { alcanceHeredado: { entities: ["Falabella", "Lider", "Jumbo", "Sodimac"], candidatos: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre", "ABC", "Easy", "Unimarc", "Hites", "La Polar"] } },
    q: "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark",
    texto: "Me concentro solo en Falabella, que es la de mayor venta del grupo: pasa de 22.0% a 24.0% y sigue bajo tu benchmark de 30.1%. Las otras tres se comportan igual — dime si quieres el detalle de cada una." },
  { id: "P17·alcance heredado·la PREGUNTA pidió un subconjunto", espera: "PASA", tipo: "alcance heredado",
    afirma: "el usuario preguntó por el peor: responder por uno solo es correcto",
    ctx: { alcanceHeredado: { entities: ["Falabella", "Lider", "Jumbo", "Sodimac"], candidatos: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre", "ABC", "Easy", "Unimarc", "Hites", "La Polar"] } },
    q: "de esos, ¿cuál es el peor?",
    texto: "Lider es el peor del grupo: margen 21.5%, 8.6 puntos bajo tu benchmark de 30.1%." },
  { id: "P9·typos·el narrador normaliza, el notario verifica lo normalizado", espera: "PASA", tipo: "supuesto del usuario con typo + entidad normalizada",
    afirma: "regla del owner 2026-08-14: «falabela»→Falabella y «2 putnos»→2 puntos porcentuales — el número que el usuario tipeó respalda al supuesto YA normalizado",
    q: "baja 2 putnos la carga de falabela", texto: "Interpreto 2 puntos porcentuales: la carga comercial de Falabella marca 4.5%, y 4.5% − 2.0pp = 2.5%." },

  // ── NEGATIVOS · deben morir POR SU chequeo (exigencia 1: la razón correcta) ──
  { id: "N1·cifra sin dueño", espera: "MUERE", tipo: "cifra", chequeoEsperado: /cifra-de-dato-sin-dueno|cifra-no-autorizada/, construido: true,
    afirma: "una cifra real de la carpeta sin su dueño en la oración",
    q: "¿cómo viene el margen?", texto: "El margen es 22.0% y no alcanza para el año." },
  { id: "N2·cifra inventada sin fórmula", espera: "MUERE", tipo: "cifra", chequeoEsperado: /cifra-no-autorizada/, construido: true,
    afirma: "una derivada sin origen mostrado",
    q: "proyecta 6% más", texto: "Con el 6% más, tus ventas llegarían a $106.0M el año próximo." },
  { id: "N3·estado inventado (4 frenados, motor dice 3)", espera: "MUERE", tipo: "estado", chequeoEsperado: /estado/, construido: false,
    afirma: "una clasificación que la carpeta no declara, con entidades reales",
    q: "¿cuánto capital frenado hay?", texto: "Tienes 4 SKU frenados en el inventario: LG-DRYER8KG, MAK-COMP-AIR, BOS-SANDER y PHI-IRON-PRO están frenados hoy." },
  { id: "N4·estado con sinónimo («bloqueados»)", espera: "MUERE", tipo: "estado", chequeoEsperado: /estado/, construido: false,
    afirma: "el mismo estado inventado dicho con otra palabra — el chequeo debe resistir sinónimos",
    q: "¿qué SKU están mal?", texto: "Tienes 4 SKU bloqueados: LG-DRYER8KG, MAK-COMP-AIR, BOS-SANDER y PHI-IRON-PRO no se mueven." },
  { id: "N5·vocabulario (meta≠benchmark), dueño nombrado", espera: "MUERE", tipo: "vocabulario", chequeoEsperado: /vocabulario|meta/, construido: false,
    afirma: "el benchmark del negocio llamado «meta» — con el dueño bien nombrado para que SOLO el vocabulario pueda matarlo",
    q: "¿cómo va la cartera?", texto: "El margen promedio de la cartera marca 25.1%, contra tu meta de margen de 30.1% — la cartera sigue bajo esa meta." },
  { id: "N6·ranking falso", espera: "MUERE", tipo: "ranking", chequeoEsperado: /ranking|orden/, construido: false,
    afirma: "un orden que la carpeta no sostiene (los tres de mayor venta reales son Falabella, Lider, Jumbo)",
    q: "¿quiénes venden más?", texto: "Tus tres clientes de mayor venta son Jumbo, Sodimac y Ripley." },
  { id: "N7·hipótesis como hecho", espera: "MUERE", tipo: "simulación narrada como hecho", chequeoEsperado: /cifra-no-autorizada|hipotesis|graduacion/, construido: true,
    afirma: "un resultado simulado prometido como hecho futuro",
    q: "simula subir ventas 4%", texto: "Al subir las ventas 4% tu contribución va a generar $26.1M el año próximo, ese es el resultado que vas a obtener." },
  { id: "N8·política-del-2%·ambigüedad silenciosa", espera: "MUERE", tipo: "ambigüedad", chequeoEsperado: /ambig/, construido: false,
    afirma: "un «2%» materialmente ambiguo aplicado sin declarar la lectura (tomó pp en silencio: 4.5−2.0=2.5)",
    q: "baja 2% la carga de Falabella", texto: "Con el 2% menos, la carga comercial de Falabella queda en 2.5%." },
  { id: "N9·MEDIDO·el invento del texto disciplinado (P2 original)", espera: "MUERE", tipo: "estado", chequeoEsperado: /estado/, construido: false,
    afirma: "«$43K frenados en 4 SKU» — un invento REAL de Sonnet: el motor declara 3 SKU frenados y $33K",
    q: "¿Dónde tengo capital inmovilizado?", texto: _p2Original },
];

function evaluar(caso) {
  let texto = caso.texto;
  try { texto = ensureCountAuthorized(texto, { figs: [] }, []); } catch { /* el backstop jamás tumba el turno */ }
  const v = guardC(texto, {
    ledger: { figs: [] }, results: [], trace: null, question: caso.q,
    datoProyectado: CIFRAS, entidadesDelTenant: ENTIDADES, duenosDelTenant: DUENOS,
    contentScope: "full", tablePolicy: "auto",
    ...(caso.ctx || {}),   // extras del caso (p.ej. `alcanceHeredado`, que solo viaja cuando el turno heredó una referencia)
  });
  return { ok: v.ok, verdict: v.verdict, violations: (v.violations || []).map((x) => `${x.kind}:${String(x.detail || "").slice(0, 100)}`) };
}

export { CASOS, evaluar };
