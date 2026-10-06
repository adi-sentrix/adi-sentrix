/* === _puerta_compacta_gate.mjs · LA PUERTA RESPONDE COMPACTA (Etapa 2, medición con anfitrión · owner 2026-10-05, offline) ═══════════
 * Lo que bloqueó el ensayo: cada `consultar` devolvía 63–363 KB (y hasta 2 MB en los catálogos largos) al anfitrión; un anfitrión real guarda o recorta
 * una respuesta así y el modelo solo ve una parte. Decisión del owner: «el anfitrión recibe una respuesta compacta pero completa para conversar —el texto
 * de la Entrega, las cifras necesarias con sus identificadores, la continuidad y las declaraciones relevantes—; la estructura interna completa se queda
 * dentro de ADI. No cambies cifras, Core, Notario ni garantías de verdad.» «20 KB es solo una referencia de prueba.»
 *
 * LO QUE ESTE GATE EXIGE (cada punto con su carnada: una BATERÍA que corre sobre la respuesta real y sobre MUTANTES de ella — cada uno tiene que ponerla en rojo):
 *   1 · el texto de la Entrega viaja ÍNTEGRO, byte a byte, en los 532 encargos de los catálogos sellados v13–v40 (demo).
 *   2 · cada cifra de la tabla viaja con el MISMO id que el libro de la conversación le da (`E<n>.h<k>`), con el mismo valor impreso, entidad, métrica y procedencia
 *       que el libro guardó; y `retomar` las devuelve con el mismo id y valor. Ninguna cifra cambia, ninguna se inventa, ninguna se recalcula.
 *   3 · toda cifra con unidad que el texto imprime está en lo que viaja (cifras · apoyo · lo que quedó fuera del texto · el supuesto de una simulación) con su valor
 *       impreso idéntico, o es una REFERENCIA con su origen dentro de la oración (benchmark, techo, «criterio aplicado»): se mide y se informa cuántas son.
 *   4 · el tamaño de cada acción sobre los catálogos y el demo se MIDE y se informa (máximo, mediana); 20 KB es la REFERENCIA: lo que la supere se reporta, no se recorta.
 *   5 · la estructura completa sigue dentro de ADI: las acciones calculan y guardan lo mismo (la respuesta que viaja es una proyección de la completa); `retomar`,
 *       la revalidación y la continuidad leen el libro, no lo que viaja; conocerEmpresa conserva todo salvo lo que es solo mecanismo (lista cerrada).
 *   6 · por la PUERTA real (bearer · JSON-RPC y REST) lo que llega es la respuesta compacta, la misma proyección.
 *   7 · cero red: `compacto.js` no importa nada de `node:*` ni del gateway.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _puerta_compacta_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { compactarParaAnfitrion, REFERENCIA_DE_TAMANO_BYTES } from "./src/adi/capacidad/compacto.js";
import { manejarPuerta } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { cifrasDeLaEntrega } from "./src/adi/continuidad/revalidar.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { extraerNumeros } from "./scripts/medicion-anfitrion/rastreo.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const bytes = (o) => Buffer.byteLength(typeof o === "string" ? o : JSON.stringify(o));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const clon = (x) => JSON.parse(JSON.stringify(x));
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

initTenant(TENANT_DEMO);
const TENANT = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;

/* ═══ LA BATERÍA DE UNA CONSULTA — devuelve la lista de violaciones (vacía = la respuesta compacta es fiel) ═══════════════════════════════════════════ */
const norm = (s) => String(s).replace(/(\d)d\b/g, "$1 días").replace(/días?/g, "días").replace(/\s/g, "");
const tokensConUnidad = (t) => extraerNumeros(String(t).replace(/(\d)d\b/g, "$1 días")).filter((x) => !x.sinUnidad);
const REFERENCIA_EN_LA_ORACION = /criterio aplicado|referencia planteada|Con la referencia|umbral|techo de|piso de|nivel de|benchmark|Benchmark|\*\*Marco\.\*\*|declarado por la empresa|criterio general/i;

/** cobertura(texto, compacta) → { total, cubiertas, referencias, sinCubrir:[{token, linea}] } — cada cifra con unidad que el texto imprime */
function cobertura(texto, e) {
  const S = new Set();
  const dichas = [...(e.cifras || []), ...(e.apoyo || []), ...((e.detalle && e.detalle.fueraDelTexto) || [])];
  for (const x of dichas) for (const t of tokensConUnidad(x.valor)) S.add(norm(t.crudo));
  for (const x of (e.cifras || [])) if (x.supuesto) for (const t of tokensConUnidad(x.supuesto)) S.add(norm(t.crudo));   // el supuesto de una simulación viaja con SU cifra
  const r = { total: 0, cubiertas: 0, referencias: 0, sinCubrir: [] };
  for (const linea of String(texto).split("\n")) for (const t of tokensConUnidad(linea)) {
    r.total += 1;
    if (S.has(norm(t.crudo))) r.cubiertas += 1;
    else if (REFERENCIA_EN_LA_ORACION.test(linea)) r.referencias += 1;
    else r.sinCubrir.push({ token: t.crudo, linea: linea.slice(0, 160) });
  }
  return r;
}

/** verificarConsulta({ completa, compacta, libro }) → string[] */
function verificarConsulta({ completa, compacta, libro }) {
  const v = [];
  const e = compacta && compacta.entrega;
  if (!e) return ["la respuesta compacta no trae `entrega`"];
  if (e.json) v.push("la estructura completa (`entrega.json`) viaja al anfitrión");
  // 1 · el texto, ÍNTEGRO, byte a byte
  if (!Buffer.from(String(e.texto)).equals(Buffer.from(String(completa.entrega.texto)))) v.push("el texto de la Entrega NO viaja íntegro");
  // 2 · las cifras, con los ids del libro
  const n = libro && libro.entregas && libro.entregas.length ? libro.entregas[libro.entregas.length - 1] : null;
  if (!n) v.push("el libro no guardó la Entrega");
  else if (!n.recortada) {
    /* la tabla de la Entrega (sin las cifras de `fueraDelTexto`, que el libro guarda aparte, marcadas `fuera`, y viajan en `detalle`: §8.2 del Contrato del Anfitrión) */
    const esperado = cifrasDeLaEntrega({ ...n, hechos: (n.hechos || []).filter((h) => !h.fuera) }).map((c) => ({ id: c.id, entidad: c.sujeto, metrica: c.metrica, valor: c.valor, procedencia: c.origen }));
    const viajo = (e.cifras || []).map(({ supuesto, ...r }) => r);
    const sinNulos = (x) => Object.fromEntries(Object.entries(x).filter(([, y]) => y !== null && y !== undefined));
    if (!mismo(viajo, esperado.map(sinNulos))) v.push(`las cifras que viajan no son las del libro (viajan ${viajo.length}, el libro guardó ${esperado.length}): ${JSON.stringify(viajo.find((c, i) => !mismo(c, sinNulos(esperado[i] || {}))) || null).slice(0, 220)}`);
    {   /* las cifras de `fueraDelTexto` viajan con el id y el valor que el libro les guardó; si el libro no pudo guardarlas (el tope de 16 KB), viajan sin id, como siempre */
      const enLibro = cifrasDeLaEntrega({ ...n, hechos: (n.hechos || []).filter((h) => h.fuera) }).map((c) => ({ id: c.id, entidad: c.sujeto, metrica: c.metrica, valor: c.valor, procedencia: c.origen }));
      const viajoFz = ((e.detalle && e.detalle.fueraDelTexto) || []).map(({ supuesto, ...r }) => r);
      if (enLibro.length) { if (!mismo(viajoFz, enLibro.map(sinNulos))) v.push(`las cifras de «fuera del texto» que viajan no son las del libro (viajan ${viajoFz.length}, el libro guardó ${enLibro.length})`); }
      else if (viajoFz.some((c) => c.id !== undefined)) v.push("una cifra de «fuera del texto» viaja con id y el libro no la guardó");
    }
    const re = new RegExp(`^E${n.n}\\.h\\d+(\\.\\d+)?$`);
    if (!(e.cifras || []).every((c) => re.test(c.id)) || new Set((e.cifras || []).map((c) => c.id)).size !== (e.cifras || []).length) v.push("los ids de las cifras no son E<n>.h<k> distintos");
  }
  // 3 · ninguna cifra inventada: todo valor que viaja está impreso en el texto (salvo lo que quedó fuera de él, que es de la tabla completa)
  /* el TOTAL DEL LISTADO COMPLETO (owner 2026-10-05, `_total_del_listado_gate`) viaja con su id pero NO se imprime en el texto: es la excepción declarada — solo vale si es el que la Entrega dejó en `cifras.totales` */
  const _totalesDelListado = (completa.entrega.json.cifras && completa.entrega.json.cifras.totales) || [];
  for (const c of (e.cifras || [])) if (!(/total del listado completo/.test(c.metrica || "") && _totalesDelListado.some((t) => t.valor === c.valor && String(c.metrica).endsWith(String(t.entidad).replace(/^Total del listado completo/, "total del listado completo")))) && !String(e.texto).includes(c.valor) && !(completa.entrega.json.detalle && JSON.stringify(completa.entrega.json.detalle).includes(JSON.stringify(c.valor)))) v.push(`la cifra ${c.id} («${c.valor}») no está impresa en el texto`);
  for (const a of (e.apoyo || [])) for (const t of String(a.valor).split(" · ")) if (!String(e.texto).includes(t) && !String(e.texto).includes(t.replace(/^(-?\d+)d$/, "$1 días")) && !String(e.texto).includes(t.replace(/^(-?\d+)d$/, "$1 día"))) v.push(`el apoyo ${a.id} («${t}») no está impreso en el texto`);
  const fuera = ((completa.entrega.json.detalle && completa.entrega.json.detalle.filas) || []).map((f) => f.valores && f.valores["Valor"]).filter(Boolean);
  for (const c of ((e.detalle && e.detalle.fueraDelTexto) || [])) if (!fuera.includes(c.valor) && !JSON.stringify(completa.entrega.json.detalle.filas).includes(JSON.stringify(c.valor))) v.push(`una cifra «fuera del texto» («${c.valor}») no es de la tabla completa`);
  // 4 · toda cifra con unidad que el texto imprime está cubierta (o es una referencia con su origen en la oración)
  const cob = cobertura(e.texto, e);
  if (cob.sinCubrir.length) v.push(`${cob.sinCubrir.length} cifra(s) impresas en el texto no viajan con id: ${cob.sinCubrir.slice(0, 3).map((x) => `«${x.token}» en «${x.linea}»`).join(" | ")}`);
  // 5 · lo declarado y la continuidad, tal cual
  for (const k of ["noResuelto", "uso", "perfil", "declarado", "antecedentes", "continuidad", "meta"]) if (!mismo(compacta[k], completa[k])) v.push(`«${k}» no viaja igual que lo calculado`);
  return v;
}

/* ═══ MUTANTES — la compactación con UN defecto cada una (cada uno tiene que poner en rojo la batería) ═══════════════════════════════════════════════ */
const MUTANTES_CONSULTA = {
  "reescribe el texto (un espacio de más)": (c) => { const k = clon(c); k.entrega.texto = k.entrega.texto.replace("**Marco.**", "**Marco. **"); return k; },
  "recorta el texto (la cola)": (c) => { const k = clon(c); k.entrega.texto = k.entrega.texto.slice(0, -40); return k; },
  "cambia un valor impreso ($19.4M → $19.5M)": (c) => { const k = clon(c); const x = k.entrega.cifras.find((y) => /\d/.test(y.valor)); x.valor = x.valor.replace(/(\d)(?=\D*$)/, (d) => String((Number(d) + 1) % 10)); return k; },
  "redondea un valor impreso": Object.assign((c) => { const k = clon(c); const x = k.entrega.cifras.find((y) => /\.\d/.test(y.valor)); if (x) x.valor = x.valor.replace(/\.\d+/, ""); return k; }, { aplica: (m) => m.compacta.entrega.cifras.some((y) => /\.\d/.test(y.valor)) }),
  "corre los ids (E<n>.h<k+1>)": (c) => { const k = clon(c); for (const x of k.entrega.cifras) x.id = x.id.replace(/\.h(\d+)/, (_, d) => `.h${Number(d) + 1}`); return k; },
  "pierde las cifras": (c) => { const k = clon(c); k.entrega.cifras = []; return k; },
  "pierde la última cifra": (c) => { const k = clon(c); k.entrega.cifras.pop(); return k; },
  "atribuye la cifra a otra entidad": (c) => { const k = clon(c); const a = k.entrega.cifras.find((y) => y.entidad); const b = k.entrega.cifras.find((y) => y.entidad && y.entidad !== a.entidad); if (b) { const t = a.entidad; a.entidad = b.entidad; b.entidad = t; } else a.entidad = "OTRA"; return k; },
  "cambia la procedencia (medido → declarado)": (c) => { const k = clon(c); for (const x of k.entrega.cifras) x.procedencia = "declarado"; return k; },
  "manda también la estructura completa": (c, completa) => { const k = clon(c); k.entrega.json = completa.entrega.json; return k; },
  "olvida la continuidad": (c) => { const k = clon(c); delete k.continuidad; return k; },
  "olvida lo que no se pudo resolver": Object.assign((c) => { const k = clon(c); k.noResuelto = []; return k; }, { aplica: (m) => (m.compacta.noResuelto || []).length > 0 }),   // solo muerde donde hay algo que no se resolvió
};

/* ═══ 1-4 · EL BARRIDO: los 532 encargos de los catálogos sellados v13–v40, cada uno en una conversación nueva ═══════════════════════════════════════ */
H("1-4 · barrido de los 532 encargos de los catálogos v13–v40 (demo): texto íntegro · ids del libro · cifras con su valor impreso · cobertura · tamaño");
const completasPorTamano = [], compactasPorTamano = [];
const violaciones = [];
let nOk = 0, nRecortadas = 0;
const acumCob = { total: 0, cubiertas: 0, referencias: 0, sinCubrir: 0 };
const detalleTam = [];
let muestraParaMutar = [];
for (const c of MUESTRA) {
  const store = crearAlmacenEnMemoria();
  const A = crearAcciones({ continuidad: store });
  const completa = await A.consultar({ tenant: TENANT, encargo: c.encargo });
  const compacta = compactarParaAnfitrion("consultar", completa);
  const t = bytes(compacta);
  completasPorTamano.push(bytes(completa)); compactasPorTamano.push(t); detalleTam.push([t, c.id]);
  if (!completa.ok) { if (!mismo(compacta, completa)) violaciones.push(`${c.id}: una consulta sin Entrega debe viajar igual`); continue; }
  nOk += 1;
  const libro = await store.leerLibro(TENANT.id, completa.continuidad.conversacionId);
  if (libro.entregas[libro.entregas.length - 1].recortada) nRecortadas += 1;
  const v = verificarConsulta({ completa, compacta, libro });
  if (v.length) violaciones.push(`${c.id}: ${v.join(" ; ")}`);
  const cob = cobertura(compacta.entrega.texto, compacta.entrega);
  acumCob.total += cob.total; acumCob.cubiertas += cob.cubiertas; acumCob.referencias += cob.referencias; acumCob.sinCubrir += cob.sinCubrir.length;
  if (muestraParaMutar.length < 40 && compacta.entrega.cifras.length >= 2 && (muestraParaMutar.length < 20 || (compacta.entrega.apoyo || []).length)) muestraParaMutar.push({ completa, compacta, libro, id: c.id });
}
ok(MUESTRA.length === 532 && nOk > 400, `★ los ${MUESTRA.length} encargos sellados corren (${nOk} con Entrega, ${MUESTRA.length - nOk} se declinan igual que antes)`);
ok(violaciones.length === 0, `★ en las ${nOk} Entregas: el texto viaja ÍNTEGRO (byte a byte), las cifras viajan con el id, el valor impreso, la entidad, la métrica y la procedencia que el LIBRO guardó, ninguna cifra inventada, lo declarado y la continuidad intactos`, violaciones.slice(0, 3).join(" || "));
ok(acumCob.sinCubrir === 0, `★ ${acumCob.cubiertas} de ${acumCob.total} cifras con unidad impresas en los textos viajan con su id y su valor impreso idéntico; ${acumCob.referencias} son referencias con su origen en la oración (benchmark, techo, «criterio aplicado»); ${acumCob.sinCubrir} sin cubrir`);
console.log(`   · cifras con unidad impresas: ${acumCob.total} · con id y valor: ${acumCob.cubiertas} (${((acumCob.cubiertas / acumCob.total) * 100).toFixed(1)} %) · referencias con su origen en la oración: ${acumCob.referencias} (${((acumCob.referencias / acumCob.total) * 100).toFixed(1)} %) · sin cubrir: ${acumCob.sinCubrir}`);
ok(nRecortadas === 0, `ninguna Entrega de una conversación nueva queda recortada en el libro (sus ids siempre se pueden retomar)`, `recortadas: ${nRecortadas}`);

const ord = (a) => [...a].sort((x, y) => x - y);
const med = (a) => ord(a)[a.length >> 1], p90 = (a) => ord(a)[Math.floor(a.length * 0.9)], max = (a) => Math.max(...a);
const sobre = compactasPorTamano.filter((x) => x > REFERENCIA_DE_TAMANO_BYTES).length;
const peor = detalleTam.sort((a, b) => b[0] - a[0])[0];
console.log(`   · consultar · tamaño de lo que VIAJA: mediana ${kb(med(compactasPorTamano))} · p90 ${kb(p90(compactasPorTamano))} · MÁXIMO ${kb(max(compactasPorTamano))} (${peor[1]}) · sobre la referencia de ${kb(REFERENCIA_DE_TAMANO_BYTES)}: ${sobre} de ${compactasPorTamano.length}`);
console.log(`   · consultar · tamaño de la respuesta completa (como antes): mediana ${kb(med(completasPorTamano))} · máximo ${kb(max(completasPorTamano))}  →  se reduce ${(med(completasPorTamano) / med(compactasPorTamano)).toFixed(0)}× (mediana) y ${(max(completasPorTamano) / max(compactasPorTamano)).toFixed(0)}× (máximo)`);
ok(max(compactasPorTamano) <= REFERENCIA_DE_TAMANO_BYTES, `★ referencia de prueba: consultar compacta ≤ ${kb(REFERENCIA_DE_TAMANO_BYTES)} en los ${compactasPorTamano.length} encargos (máximo medido ${kb(max(compactasPorTamano))}; si algo la supera, se reporta, no se recorta)`);
ok(max(compactasPorTamano) * 8 < max(completasPorTamano), "la respuesta que viaja pesa menos de una octava parte de la completa en el peor caso");

/* ═══ CARNADAS DE LA BATERÍA — cada mutante pone en rojo la verificación ═════════════════════════════════════════════════════════════════════════ */
H("★ carnadas · una compactación con UN defecto se pone en rojo");
{
  const buenos = muestraParaMutar.filter((m) => verificarConsulta(m).length === 0);
  ok(buenos.length >= 20, `control: la batería da verde sobre ${buenos.length} Entregas reales (la sana no se acusa)`);
  for (const [nombre, mutar] of Object.entries(MUTANTES_CONSULTA)) {
    const donde = buenos.filter((m) => !mutar.aplica || mutar.aplica(m));
    const rojos = donde.filter((m) => verificarConsulta({ completa: m.completa, compacta: mutar(m.compacta, m.completa), libro: m.libro }).length > 0).length;
    ok(donde.length >= 5 && rojos === donde.length, `★ CARNADA «${nombre}»: la batería se pone roja (${rojos} de ${donde.length} Entregas donde el defecto aplica)`);
  }
}

/* ═══ 3 · EL APOYO Y LAS CIFRAS FUERA DEL TEXTO: casos puntuales ══════════════════════════════════════════════════════════════════════════════════ */
H("las cifras que no son de la tabla (premisas juzgadas, comparaciones) y las que quedaron fuera del texto");
{
  const quiero = (id) => MUESTRA.find((c) => c.id === id);
  const correr = async (id) => { const store = crearAlmacenEnMemoria(); const A = crearAcciones({ continuidad: store }); const completa = await A.consultar({ tenant: TENANT, encargo: quiero(id).encargo }); return { completa, compacta: compactarParaAnfitrion("consultar", completa), store }; };
  const z100 = await correr("v13:Z100");   // una premisa falsa: «Jumbo: está al día, venta $17.3M, puesto 3 de 13»
  ok((z100.compacta.entrega.apoyo || []).some((a) => a.premisa === true && /17\.3M/.test(a.valor) && a.veredicto === "falsa"), "una premisa juzgada viaja como apoyo, con su veredicto y el valor que la casa imprimió", JSON.stringify(z100.compacta.entrega.apoyo));
  const z45 = await correr("v13:Z45");     // una Entrega breve: 5 filas quedaron fuera del texto
  ok(z45.completa.entrega.json.meta.recortoFilas > 0 && z45.compacta.entrega.detalle.fueraDelTexto.length === z45.completa.entrega.json.meta.recortoFilas, "las filas que el texto dejó fuera (Entrega breve) viajan aparte, con su cifra, y la forma de pedirlas", `${z45.compacta.entrega.detalle && z45.compacta.entrega.detalle.fueraDelTexto && z45.compacta.entrega.detalle.fueraDelTexto.length} vs ${z45.completa.entrega.json.meta.recortoFilas}`);
  ok(z45.compacta.entrega.detalle.comoPedirlo && z45.compacta.entrega.alcance.recortoFilas > 0, "y dice cuánto recortó y cómo pedir el resto");
  const sim = MUESTRA.find((c) => (c.encargo.partes || []).some((p) => p.cierre === "simulacion"));
  const rs = await correr(sim.id);
  ok(rs.compacta.entrega.cifras.some((c) => c.supuesto) && rs.compacta.entrega.cifras.some((c) => c.procedencia === "derivado"), `una simulación (${sim.id}) viaja con el SUPUESTO de cada cifra y su procedencia «derivado»`);
}

/* ═══ 5 · LA ESTRUCTURA COMPLETA SIGUE DENTRO — retomar, revalidar y continuidad leen el libro ═══════════════════════════════════════════════════════ */
H("5 · retomar con la respuesta compacta: los mismos ids, valores y revalidaciones que el libro (y los datos que cambian se dicen con las dos cifras)");
{
  const clonDs = clon(TENANT_DEMO);
  const store = crearAlmacenEnMemoria();
  const A = crearAcciones({ continuidad: store });
  let cid = null, n = 0; const viajaron = [];
  for (const c of MUESTRA.slice(0, 400)) {
    const r = await A.consultar({ tenant: TENANT, encargo: { ...c.encargo, conversacionId: cid } });
    cid = r.continuidad.conversacionId;
    if (r.ok) { n += 1; viajaron.push(...compactarParaAnfitrion("consultar", r).entrega.cifras); }
    if (n >= 6) break;
  }
  const completa = await A.retomar({ tenant: TENANT, conversacionId: cid });
  const compacta = compactarParaAnfitrion("retomar", completa);
  ok(completa.ok && completa.hechos.length >= 20, `la conversación de 6 Entregas se retoma (${completa.hechos.length} cifras)`);
  /* una Entrega vieja que el libro recortó por tamaño (tope de 16 KB, `continuidad/libro.js`) ya no conserva sus cifras: retomar lo declara en `advertencias` y sus ids no se revalidan — es el diseño de la continuidad, no de la puerta */
  const vigentes = new Set(completa.entregas.filter((e) => !e.recortada).map((e) => e.n));
  const recortadas = completa.entregas.filter((e) => e.recortada).map((e) => e.n);
  ok(recortadas.every((n) => completa.advertencias.some((a) => a.includes(`E${n}`))), `las Entregas que el libro recortó (${recortadas.map((n) => "E" + n).join(", ") || "ninguna"}) las declara retomar en «advertencias»`);
  const nDe = (c) => Number(/^E(\d+)\./.exec(c.id)[1]);
  const vistas = new Map(completa.hechos.map((h) => [h.id, h]));
  const comparadas = viajaron.filter((c) => vigentes.has(nDe(c)));
  const noEstan = comparadas.filter((c) => { const h = vistas.get(c.id); return !h || (h.sujeto ?? null) !== (c.entidad ?? null) || h.metrica !== c.metrica || h.valor !== c.valor; });
  ok(comparadas.length >= 10 && noEstan.length === 0, `★ las ${comparadas.length} cifras que viajaron en las Entregas vigentes del libro vuelven en retomar con el MISMO id, entidad, métrica y valor`, JSON.stringify(noEstan.slice(0, 2)));
  const hSolo = (x) => x.hechos.map((h) => [h.id, h.sujeto ?? null, h.metrica ?? null, h.valor ?? null, h.origen ?? null, h.estadoReverificacion, h.revalidacion && h.revalidacion.estado, h.revalidacion && h.revalidacion.anterior && h.revalidacion.anterior.valor, h.revalidacion && h.revalidacion.actual && h.revalidacion.actual.valor, h.revalidacion && h.revalidacion.diferencia && h.revalidacion.diferencia.texto]);
  ok(mismo(hSolo(compacta), hSolo(completa)), "★ retomar compacta: cada cifra con su id, sujeto, métrica, valor, origen y revalidación (estado, antes, ahora, diferencia) idénticos a lo calculado");
  for (const k of ["ok", "conversacionId", "estadoVigente", "resumen", "eventos", "lineaContinuidad", "advertencias", "uso"]) ok(mismo(compacta[k], completa[k]), `retomar compacta · «${k}» viaja igual`);
  ok(!compacta.hechos.some((h) => "rv" in h || "ref" in h || "unidad" in h || "periodo" in h), "retomar compacta no manda el crudo interno (`rv`, `ref`) ni campos vacíos");
  console.log(`   · retomar · 6 Entregas, ${completa.hechos.length} cifras: completa ${kb(bytes(completa))} → compacta ${kb(bytes(compacta))}`);

  // la conversación más larga que el libro admite (12 Entregas, el tope de `ENTREGAS_TOPE`): lo que viaja sigue cabiendo en la referencia
  {
    const st = crearAlmacenEnMemoria(); const AL = crearAcciones({ continuidad: st });
    let c2 = null, k = 0, mayor = 0;
    for (const c of MUESTRA) {
      const r = await AL.consultar({ tenant: TENANT, encargo: { ...c.encargo, conversacionId: c2 } });
      c2 = r.continuidad.conversacionId; if (r.ok) k += 1;
      mayor = Math.max(mayor, bytes(compactarParaAnfitrion("consultar", r)));
      if (k >= 24) break;
    }
    const rl = await AL.retomar({ tenant: TENANT, conversacionId: c2 });
    const rlc = compactarParaAnfitrion("retomar", rl);
    console.log(`   · conversación de ${k} consultas: retomar completa ${kb(bytes(rl))} → compacta ${kb(bytes(rlc))} (${rlc.hechos.length} cifras) · la consulta más pesada de la conversación: ${kb(mayor)}`);
    ok(bytes(rlc) <= REFERENCIA_DE_TAMANO_BYTES && mayor <= REFERENCIA_DE_TAMANO_BYTES, `en una conversación de ${k} consultas, retomar compacta (${kb(bytes(rlc))}) y la consulta más pesada (${kb(mayor)}) caben en la referencia`);
  }

  // DATOS QUE CAMBIAN (otra versión de carga): las dos cifras, calculadas por ADI, viajan en `revalidacion`
  const otra = clon(TENANT_DEMO); otra.clientesVentas.find((x) => x.nombre === "Falabella").actual = Math.round(otra.clientesVentas.find((x) => x.nombre === "Falabella").actual * 1.07);   /* una sola realidad (2026-10-06): la venta es SU actual (la tabla); antes el +7 % se aplicaba al anterior y la venta lo seguía por el crecimiento del escenario */
  const store2 = crearAlmacenEnMemoria();
  const A2 = crearAcciones({ continuidad: store2 });
  const r1 = await A2.consultar({ tenant: TENANT, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }] } });
  const rt = await A2.retomar({ tenant: { ...TENANT, dataset: otra, version: 2 }, conversacionId: r1.continuidad.conversacionId });
  const rtc = compactarParaAnfitrion("retomar", rt);
  const cambio = rt.hechos.find((h) => h.revalidacion && h.revalidacion.estado === "cambio");
  const cambioC = rtc.hechos.find((h) => h.id === (cambio && cambio.id));
  ok(Boolean(cambio) && cambioC.revalidacion.estado === "cambio" && cambioC.revalidacion.anterior.valor === cambio.revalidacion.anterior.valor && cambioC.revalidacion.actual.valor === cambio.revalidacion.actual.valor && cambioC.revalidacion.diferencia.texto === cambio.revalidacion.diferencia.texto, "★ un cambio de datos viaja con las DOS cifras (antes y ahora) y la diferencia que calculó ADI, idénticas", JSON.stringify(cambioC && cambioC.revalidacion));
  ok(rtc.lineaContinuidad === rt.lineaContinuidad && rtc.lineaContinuidad && mismo(rtc.resumen, rt.resumen), "y la línea de continuidad y el resumen de estados, intactos");
  ok(!JSON.stringify(rtc).includes('"raw"'), "el valor crudo de la diferencia y de cada cifra no viaja (solo lo impreso: nadie recalcula sobre un número que ADI no dijo)");
  // CARNADAS de retomar
  const MUT_RET = {
    "cambia un valor": (c) => { const k = clon(c); k.hechos[0].valor = "$0.1M"; return k; },
    "pierde una cifra": (c) => { const k = clon(c); k.hechos.pop(); return k; },
    "corre un id": (c) => { const k = clon(c); k.hechos[0].id = "E9.h99"; return k; },
    "cambia el estado de la revalidación": (c) => { const k = clon(c); const h = k.hechos.find((x) => x.revalidacion); h.revalidacion.estado = "igual"; h.estadoReverificacion = "igual"; return k; },
  };
  for (const [nombre, mutar] of Object.entries(MUT_RET)) ok(!mismo(hSolo(mutar(rtc)), hSolo(rt)), `★ CARNADA retomar «${nombre}»: la comparación se pone roja`);
}

H("5 · conocerEmpresa compacta: conserva todo salvo lo que es solo mecanismo (lista cerrada)");
{
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const completa = await A.conocerEmpresa({ tenant: TENANT });
  const compacta = compactarParaAnfitrion("conocerEmpresa", completa);
  /* lo que se OMITE, a propósito, y por qué (lista cerrada): la fuente interna de cada fórmula y de cada estado, los insumos del cálculo del tamaño, y lo que otro bloque ya dice igual (período, moneda y empresa del catálogo = los de `datos`/`empresa`) */
  const esperada = (() => {
    const x = clon(completa);
    for (const lista of [x.catalogo.definiciones, x.catalogo.estados]) for (const it of lista) delete it.fuente;
    for (const c of Object.values(x.perfil.campos)) if (c && typeof c === "object") { delete c.insumos; delete c.ventaAnual; }
    delete x.catalogo.periodos; delete x.catalogo.moneda; delete x.catalogo.empresa;
    return x;
  })();
  // «expandir» lo que se dijo una sola vez: banderas por defecto, forma de declarar, id → rótulo
  const expandida = (() => {
    const x = clon(compacta);
    for (const t of x.catalogo.temas) for (const c of t.conceptos) { c.referencia = c.referencia === true; c.negocio = c.negocio === true; c.ejes = c.ejes || []; }
    for (const k of ["criterios", "hechos", "citables"]) x.declarable[k] = x.declarable[k].map((it) => { if (!it.forma) return it; const { forma, ...r } = it; const f = clon(x.declarable.formas[forma]); f.concepto = it.concepto; f.valor.unidad = it.unidad; return { ...r, comoDeclarar: f }; });
    delete x.declarable.formas;
    x.catalogo.conceptosDeDefinicion = Object.entries(x.catalogo.conceptosDeDefinicion).flatMap(([id, r]) => [].concat(r).map((rotulo) => ({ id, rotulo })));
    x.catalogo.estados = x.catalogo.estados.map((e) => ({ complemento: null, ...e }));
    for (const c of Object.values(x.perfil.campos)) if (c && typeof c === "object") { for (const k of ["fuente", "motivo"]) if (!(k in c)) c[k] = null; }
    return x;
  })();
  const orden = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v));
  const cdd = (x) => ({ ...x, catalogo: { ...x.catalogo, conceptosDeDefinicion: [...x.catalogo.conceptosDeDefinicion].map((e) => `${e.id}|${e.rotulo}`).sort() } });
  // la comparación se hace por bloque, para decir cuál falla
  const bloques = { ok: 0, empresa: 0, datos: 0, conversacionId: 0, hechosAportados: 0, pendientesDeConfirmar: 0, estadoVigente: 0, declarable: 0 };
  for (const k of Object.keys(bloques)) ok(orden(expandida[k]) === orden(esperada[k]), `conocerEmpresa compacta · «${k}» conserva todo lo de la completa`, orden(expandida[k]).slice(0, 300));
  const pe = (x) => Object.fromEntries(Object.entries(x.perfil).map(([k, v]) => [k, k === "campos" ? Object.fromEntries(Object.entries(v).map(([c, y]) => [c, { valor: y.valor ?? null, procedencia: y.procedencia ?? null, fuente: y.fuente ?? null, motivo: y.motivo ?? null }])) : v]));
  ok(orden(pe(expandida)) === orden(pe(esperada)), "conocerEmpresa compacta · el perfil conserva el valor, la procedencia, la fuente y el motivo de cada campo (menos los insumos del tamaño)");
  ok(orden(cdd(expandida).catalogo) === orden(cdd(esperada).catalogo), "★ conocerEmpresa compacta · el catálogo (temas, conceptos con sus ejes, cierres, ejes, definiciones, lo que NO calcula, ausencias, criterios, estados, supuestos, conceptos de definición) conserva todo", orden(cdd(expandida).catalogo).slice(0, 200));
  ok(compacta.perfil.campos.tamano.valor === completa.perfil.campos.tamano.valor && compacta.perfil.campos.tamano.procedencia === "derivado" && /criterio general de ADI/.test(compacta.perfil.campos.tamano.fuente), "el tamaño conserva su valor, su procedencia «derivado» y su fuente («criterio general de ADI»)");
  const t = bytes(compacta);
  console.log(`   · conocerEmpresa · completa ${kb(bytes(completa))} → compacta ${kb(t)} (${((1 - t / bytes(completa)) * 100).toFixed(0)} % menos) · referencia ${kb(REFERENCIA_DE_TAMANO_BYTES)}${t > REFERENCIA_DE_TAMANO_BYTES ? " · SUPERA la referencia: se reporta, no se recorta información" : ""}`);
  ok(t < bytes(completa) * 0.8 && t < 40 * 1024, `conocerEmpresa compacta pesa menos del 80 % de la completa y cabe holgada en un anfitrión (${kb(t)})`);
  // CARNADAS
  const sinConcepto = clon(compacta); sinConcepto.catalogo.temas[0].conceptos.pop();
  const sinAusencia = clon(compacta); sinAusencia.catalogo.ausencias.pop();
  const textoCambiado = clon(compacta); textoCambiado.catalogo.noCalcula[0].porque += " (y algo más)";
  const sinForma = clon(compacta); sinForma.declarable.formas = {};
  const exp = (c) => { try { const x = clon(c); for (const t of x.catalogo.temas) for (const q of t.conceptos) { q.referencia = q.referencia === true; q.negocio = q.negocio === true; q.ejes = q.ejes || []; } return orden(x.catalogo.temas) + orden(x.catalogo.ausencias) + orden(x.catalogo.noCalcula) + orden(x.declarable.formas); } catch { return "ROTO"; } };
  const base = exp(compacta);
  ok(exp(sinConcepto) !== base && exp(sinAusencia) !== base && exp(textoCambiado) !== base && exp(sinForma) !== base, "★ CARNADAS conocerEmpresa: perder un concepto, una ausencia, cambiar un texto o perder la forma de declarar se detecta");
}

H("5 · aportarContexto viaja tal cual (ya es chica) y la estructura completa de las acciones sigue calculándose");
{
  const store = crearAlmacenEnMemoria();
  const A = crearAcciones({ continuidad: store });
  const r = await A.aportarContexto({ tenant: TENANT, aportes: [{ clase: "criterio", concepto: "benchmark", valor: { raw: 28, unidad: "pct" } }] });
  const c = compactarParaAnfitrion("aportarContexto", r);
  ok(c === r && mismo(c, r) && bytes(c) < 4096, `aportarContexto no cambia (${kb(bytes(c))})`);
  // las acciones siguen devolviendo la estructura completa, y lo guardado en el libro NO depende de la respuesta que viaja
  const cons = await A.consultar({ tenant: TENANT, encargo: MUESTRA[0].encargo });
  ok(cons.entrega.json && cons.entrega.json.procedencia && cons.entrega.json.procedencia.libro.hechos.length > 0 && cons.entrega.json.cifras.filas.length > 0, "★ `consultar` (la acción) sigue devolviendo la estructura completa: libro de hechos, procedencia, universos");
  const antes = JSON.stringify(cons);
  compactarParaAnfitrion("consultar", cons);
  ok(JSON.stringify(cons) === antes, "★ compactar NO muta la respuesta completa (es una proyección pura)");
  const libro = await store.leerLibro(TENANT.id, cons.continuidad.conversacionId);
  ok(libro.entregas[0].hechos.length > 0 && libro.entregas[0].revalidable === true && libro.entregas[0].encargo, "el libro conserva lo que `retomar` necesita para revalidar (el Encargo, las cifras con su crudo)");
}

/* ═══ 6 · POR LA PUERTA REAL ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · por la puerta real (bearer · JSON-RPC y REST): lo que llega es la respuesta compacta, la misma proyección");
{
  const SECRETO = "secreto-de-gate-puerta-compacta-no-real";
  const ENV = { ADI_TOKEN_SECRET: SECRETO, ADI_COMPLEMENTO: "true" };
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  const store = crearAlmacenEnMemoria();
  const base = crearAcciones({ continuidad: store });
  const ultima = {};
  const acc = Object.fromEntries(["conocerEmpresa", "consultar", "aportarContexto", "retomar"].map((k) => [k, async (a) => (ultima[k] = await base[k](a))]));
  let ip = 0;
  const llamarRpc = async (name, args) => {
    const req = new Request("http://gate.local/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": `10.7.7.${++ip}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ip, method: "tools/call", params: { name, arguments: args } }) });
    const res = await manejarPuerta(req, ENV, { acciones: acc });
    const j = await res.json();
    return { texto: j.result.content[0].text, payload: JSON.parse(j.result.content[0].text) };
  };
  const llamarRest = async (ruta, args) => {
    const req = new Request(`http://gate.local/capacidad/${ruta}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": `10.8.8.${++ip}` }, body: JSON.stringify(args) });
    const res = await manejarPuerta(req, ENV, { acciones: acc });
    return await res.json();
  };
  const viaja = (accion) => JSON.parse(JSON.stringify(compactarParaAnfitrion(accion, ultima[accion])));

  const co = await llamarRpc("conocerEmpresa", {});
  ok(mismo(co.payload, viaja("conocerEmpresa")) && !co.payload.catalogo.definiciones.some((d) => "fuente" in d), "★ conocerEmpresa por la puerta (JSON-RPC) = la proyección compacta de lo que la acción calculó");
  const enc = MUESTRA.find((c) => c.id === "v13:Z07").encargo;
  const cr = await llamarRpc("consultar", { encargo: enc });
  ok(mismo(cr.payload, viaja("consultar")) && !cr.payload.entrega.json && Array.isArray(cr.payload.entrega.cifras) && Buffer.from(cr.payload.entrega.texto).equals(Buffer.from(ultima.consultar.entrega.texto)), "★ consultar por la puerta (JSON-RPC) = la proyección compacta; el texto, íntegro");
  console.log(`   · consultar por la puerta: ${kb(bytes(cr.texto))} (la acción calculó ${kb(bytes(ultima.consultar))})`);
  ok(bytes(cr.texto) < REFERENCIA_DE_TAMANO_BYTES, `lo que sale por la puerta cabe en la referencia (${kb(bytes(cr.texto))})`);
  const ap = await llamarRpc("aportarContexto", { conversacionId: cr.payload.continuidad.conversacionId, aportes: [{ clase: "criterio", concepto: "benchmark", valor: { raw: 28, unidad: "pct" } }] });
  ok(mismo(ap.payload, viaja("aportarContexto")), "aportarContexto por la puerta, tal cual");
  const rt = await llamarRpc("retomar", { conversacionId: cr.payload.continuidad.conversacionId });
  ok(mismo(rt.payload, viaja("retomar")) && rt.payload.hechos.length >= 1 && rt.payload.hechos.every((h) => !("rv" in h)), "retomar por la puerta (JSON-RPC) = la proyección compacta");
  const rest = await llamarRest("consultar", { encargo: enc });
  ok(mismo(rest, viaja("consultar")) && !rest.entrega.json, "★ el REST de GPT Actions (`.../capacidad/consultar`) viaja igual de compacto");
  const ign = await llamarRpc("consultar", { encargo: enc, tenant: "empresa2" });
  ok(Array.isArray(ign.payload.advertencias) && ign.payload.advertencias.length === 1 && ign.payload.entrega.texto.length > 100 && !ign.payload.entrega.json, "las advertencias de la puerta (el tenant ignorado) se siguen agregando a la respuesta compacta");
  // el error y la acción desconocida no se tocan
  const mal = await llamarRpc("consultar", { encargo: { version: "encargo/v1", partes: [] } });
  ok(mal.payload.ok === false || mal.payload.entrega === null || mal.payload.noResuelto, "un encargo inválido se declina igual que antes");
}

/* ═══ 7 · SIN RED, SIN node:* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · candado: compacto.js no importa nada de `node:*` ni del gateway, y este gate es offline");
{
  const src = fs.readFileSync(new URL("./src/adi/capacidad/compacto.js", import.meta.url), "utf8");
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  ok(!/from\s+["']node:/.test(sinComentarios) && !/require\(/.test(sinComentarios), "compacto.js no importa nada de `node:*` (corre en edge, como el resto de la puerta)");
  const j = (...p) => p.join("");
  ok(!new RegExp(j("llm", "Gate", "way") + "|" + j("gateway", "Core") + "|" + j("fe", "tch", "\\s*\\(") + "|" + j("api\\.", "openai") + "|" + j("api\\.", "anthropic")).test(sinComentarios), "compacto.js no nombra ningún camino de red ni del gateway del LLM");
  const imports = [...sinComentarios.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  ok(imports.every((i) => i.startsWith("./") || i.startsWith("../")) && imports.length <= 3, `solo importa piezas de la casa (${imports.join(", ")})`);
  ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");
}

console.log(`\n── _puerta_compacta_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
