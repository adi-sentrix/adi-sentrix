/* === scripts/una-sola-realidad/cifrasVigentes.mjs · LAS CIFRAS DE LOS CORPUS ARCHIVADOS, LEÍDAS CON EL DATO VIGENTE (owner 2026-10-06) ==============
 * UNA SOLA REALIDAD: cuando el demo dejó de servir el escenario «bonanza» (13 porcentajes redondeados + un rearme de marcas) y pasó a servir
 * sus TABLAS, ~40 cifras impresas del dato de fábrica se movieron en el último dígito (Lider $17.8M → $17.9M, +14.9 % → +15.0 %, Ripley −$422K →
 * −$414K, $99.9M → $100.0M, +7.5 % → +7.6 %, $655K → $656K…). Los corpus ARCHIVADOS —borradores reales del modelo, encargos y Entregas de
 * producción, corpus adversariales del Notario— están escritos con las cifras de entonces, y los gates que los juzgan contra la boleta VIVA los
 * verían falsos: no por un defecto del juez, sino porque el dato que describen ya no es el vigente.
 *
 * Este módulo NO reescribe ningún archivo archivado (son evidencia: se leen byte a byte como se capturaron). Aplica EN MEMORIA, al leerlos, el
 * mapa «cifra impresa de antes → de ahora». Reglas que lo mantienen honesto:
 *   · el mapa es CURADO y declarado (abajo), cada línea con su dueño: nunca se infiere ni se redondea a ojo;
 *   · SOLO entran movimientos del último dígito de cifras de la TABLA de clientes y de los totales de cabecera: nada que sea un cambio de
 *     contenido (marcas y familias —el rearme de «bonanza» se retiró—, conteos, rankings) se mapea: esos son los casos de la conclusión nueva
 *     (§4f del diseño) y los gates que los ejercitan los declaran por id, no los disfrazan;
 *   · una cifra ambigua (la misma impresión es de dos cuentas que se mueven distinto) se mapea SOLO con su signo/forma que la desambigua.
 * Candado: `_una_sola_realidad_gate` verifica que cada «de ahora» del mapa exista en el dato vigente y que ningún «de antes» siga existiendo.
 * OFFLINE · cero red · cero LLM. */
import fs from "node:fs";

/* [de antes, de ahora, de quién] — formas con PUNTO decimal; el lector deriva solas las de COMA decimal («$17,8M», «+14,9 %»). */
export const MAPA_DE_CIFRAS = [
  /* venta y variación de cuentas (la tabla, no el redondeo de «bonanza») */
  ["$17.8M", "$17.9M", "Lider · venta"],
  ["17.843.000", "17.857.000", "Lider · venta (cruda)"], ["17.843", "17.857", "Lider · venta (cruda)"], ["17843", "17857", "Lider · venta (cruda)"],
  ["+14.9%", "+15.0%", "Lider · variación"], ["14.9%", "15.0%", "Lider · variación"],
  ["+8.2%", "+8.3%", "Falabella · variación (el «8,2 %» SIN signo es de dos cuentas: va por contexto, abajo)"],
  ["+12.2%", "+12.4%", "Jumbo · variación"], ["12.2%", "12.4%", "Jumbo · variación"],
  ["+25.3%", "+25.4%", "Mercado Libre · variación"], ["25.3%", "25.4%", "Mercado Libre · variación"],
  ["+9.2%", "+9.4%", "Tottus · variación"],
  ["+5.4%", "+5.5%", "Sodimac · variación (la carga 5.4 % no cambia: sin signo no se mapea)"],
  ["+2.6%", "+2.7%", "Paris · variación"], ["+4.0%", "+4.1%", "Hites · variación"], ["+3.0%", "+3.1%", "ABC · variación"],
  ["-8.2%", "-8.1%", "Ripley · variación"], ["−8.2%", "−8.1%", "Ripley · variación"],
  ["-12.5%", "-12.4%", "La Polar · variación"], ["−12.5%", "−12.4%", "La Polar · variación"],
  ["-3.9%", "-3.8%", "Unimarc · variación"], ["-5.0%", "-4.9%", "Easy · variación"],
  ["-$422K", "-$414K", "Ripley · variación $"], ["−$422K", "−$414K", "Ripley · variación $"], ["$422K", "$414K", "Ripley · variación $"],
  ["-$420K", "-$417K", "La Polar · variación $"], ["−$420K", "−$417K", "La Polar · variación $"], ["$420K", "$417K", "La Polar · variación $"],
  ["-$177K", "-$175K", "Easy · variación $"], ["-$94K", "-$92K", "Unimarc · variación $"],
  /* unidades vendidas por cuenta (la tabla de clientes, no unidadesAnt × (1 + 0,7·growth)) */
  ["1.042", "1.040", "Falabella · unidades"], ["1042", "1040", "Falabella · unidades"],
  ["1.194", "1.210", "Jumbo · unidades"], ["1194", "1210", "Jumbo · unidades"],
  ["894", "900", "Lider · unidades"],
  /* totales de cabecera: la tabla suma $100.000K y la contribución de la cartera es Σ venta oficial × margen */
  ["$99.9M", "$100.0M", "ventas totales"], ["99.9M", "100.0M", "ventas totales"],
  ["$25.0M", "$25.1M", "contribución de la cartera"],
  ["+7.5%", "+7.6%", "ventas vs año anterior"], ["7.5%", "7.6%", "ventas vs año anterior"],
  ["$655K", "$656K", "carga sobre el nivel (6 cuentas)"], ["655K", "656K", "carga sobre el nivel (6 cuentas)"],
  ["$155K", "$156K", "Sodimac · carga recuperable"],
  /* las MARCAS son la tabla (antes rearmadas desde los clientes por su marca dominante: Samsung $33,2M, y Makita fuera): Samsung $31,6M, Bosch con la carga de su tabla (5,4 %).
   * Solo frases completas de los corpus (una «$33.2M» a secas no se toca). */
  ["Samsung es la marca que más vende ($33.2M)", "Samsung es la marca que más vende ($31.6M)", "Samsung · venta de la tabla"],
  ["es la marca que más vende: $33.2M", "es la marca que más vende: $31.6M", "Samsung · venta de la tabla"],
  ["$33.2M", "$31.6M", "Samsung · venta de la tabla (= Electrodomésticos)"], ["$37.3M", "$35.6M", "LG + Bosch · venta de la tabla (24,6 + 11,0)"],
  ["Samsung vende $33.2M, menos que LG y Bosch juntos ($37.3M entre las dos)", "Samsung vende $31.6M, menos que LG y Bosch juntos ($35.6M entre las dos)", "Samsung · LG + Bosch de la tabla (24,6 + 11,0)"],
  ["Bosch carga 5.5%", "Bosch carga 5.4%", "Bosch · carga de la tabla"],
  ["Bosch margina 26% y carga 5.5%", "Bosch margina 25.5% y carga 5.4%", "Bosch · margen y carga de la tabla"],
  ["Philips deja $7.8M de contribución con 3.5% de carga", "Philips deja $7.3M de contribución con 3.6% de carga", "Philips · contribución y carga de la tabla"],
  ["$540K", "$541K", "Sodimac · contribución no capturada"], ["$240K", "$241K", "Ripley · contribución no capturada"],
  /* la brecha al benchmark de las MARCAS (30,1 − margen de la tabla): el margen de marca se calibró ×0,9804 para cuadrar con la contribución de los clientes
   * (Samsung 24,2→23,7 · LG 24,0→23,5 · Philips 26,6→26,1 · Bosch 26,0→25,5). Solo con su frase pegada (un «5,9» a secas no se toca). */
  ["6.1 puntos bajo el benchmark", "6.6 puntos bajo el benchmark", "LG · brecha al benchmark"],
  ["brecha de 5.9 puntos", "brecha de 6.4 puntos", "Samsung · brecha al benchmark"],
  ["brecha 3.5 puntos", "brecha 4.0 puntos", "Philips · brecha al benchmark"],
  ["brecha 4.1 puntos", "brecha 4.6 puntos", "Bosch · brecha al benchmark"],
];

/* los NÚMEROS CRUDOS (campo `raw` de una cifra de boleta archivada, en dólares): solo los de las variaciones y la venta de las cuentas que se movieron, exactos */
/* LAS CIFRAS SIN SIGNO QUE SON DE MÁS DE UNA CUENTA (o de una cuenta y de otra cosa): se refrescan SOLO si la cuenta que las posee aparece en la misma cadena (la más cercana: antes
 * de la cifra, y si no, después) o es el `sujeto` del objeto archivado que las contiene. Sin dueño a la vista no se tocan: nunca se adivina.
 *   «8,2 %» = la variación de Falabella (→ 8,3 %) o la de Ripley (→ 8,1 %, en la forma «cayó 8,2 %») · «5,0 %» = la de Easy (→ 4,9 %; −4,949 % sobre la tabla) · «12,5 %» = La Polar (→ 12,4 %). */
const POR_DUENO = [["8.2%", { Falabella: "8.3%", Ripley: "8.1%" }], ["5.0%", { Easy: "4.9%" }], ["12.5%", { "La Polar": "12.4%" }]];
export const RAW_DE_CIFRAS = new Map([
  [17843000, 17857000], [-422000, -414000], [422000, 414000], [-420000, -417000], [420000, 417000], [-177000, -175000], [-94000, -92000],
]);

function _variantes() {
  const out = [];
  for (const [a, b, d] of MAPA_DE_CIFRAS) {
    out.push([a, b, d]);
    if (/\.\d/.test(a) && !/^\d{1,3}\.\d{3}(?:\.\d{3})?$/.test(a)) out.push([a.replace(/(\d)\.(\d)/g, "$1,$2"), b.replace(/(\d)\.(\d)/g, "$1,$2"), d + " (coma decimal)"]);
  }
  return out.sort((x, y) => y[0].length - x[0].length);
}
const _V = _variantes();
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _RE = new RegExp(`(?<![\\d.,])(${_V.map(([a]) => _esc(a)).join("|")})(?![\\d])`, "g");
const _DE = new Map(_V.map(([a, b]) => [a, b]));

/** El texto con las cifras de antes cambiadas por las vigentes (una pasada; sin tocar lo que no esté en el mapa). */
export function refrescarCifras(texto, sujeto = null) {
  if (typeof texto !== "string") return texto;
  let t = texto.replace(_RE, (m) => _DE.get(m) ?? m);
  for (const [tok, deQuien] of POR_DUENO) {
    for (const forma of [tok, tok.replace(".", ",")]) {
      const base = t;
      t = base.replace(new RegExp(`(?<![\\d.,+\\-−])${_esc(forma)}`, "g"), (m, idx) => {
        let mejor = null, pos = -1;
        for (const n of Object.keys(deQuien)) { const i = base.lastIndexOf(n, idx); if (i > pos) { pos = i; mejor = n; } }
        if (!mejor) { let p2 = Infinity; for (const n of Object.keys(deQuien)) { const i = base.indexOf(n, idx); if (i >= 0 && i < p2) { p2 = i; mejor = n; } } }
        if (!mejor && typeof sujeto === "string" && deQuien[sujeto]) mejor = sujeto;
        if (!mejor) return m;
        return forma.includes(",") ? deQuien[mejor].replace(".", ",") : deQuien[mejor];
      });
    }
  }
  return t;
}
/** Recorre un valor JSON y refresca todas sus cadenas, y los campos `raw` numéricos de la tabla RAW_DE_CIFRAS (ningún otro número se toca). */
export function refrescarEnProfundidad(v, clave = null, sujeto = null) {
  if (typeof v === "string") return refrescarCifras(v, sujeto);
  if (typeof v === "number") return clave === "raw" && RAW_DE_CIFRAS.has(v) ? RAW_DE_CIFRAS.get(v) : v;
  if (Array.isArray(v)) return v.map((x) => refrescarEnProfundidad(x, clave, sujeto));
  if (v && typeof v === "object") { const s = typeof v.sujeto === "string" ? v.sujeto : sujeto; const o = {}; for (const [k, x] of Object.entries(v)) o[k] = refrescarEnProfundidad(x, k, s); return o; }
  return v;
}
/** Lee un corpus archivado (ruta o URL) con las cifras vigentes. El archivo no se modifica. */
export function leerFixtureVigente(ruta) {
  const p = ruta instanceof URL ? ruta : ruta;
  return refrescarEnProfundidad(JSON.parse(fs.readFileSync(p, "utf8")));
}
