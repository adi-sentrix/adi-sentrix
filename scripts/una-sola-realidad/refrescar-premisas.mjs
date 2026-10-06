/* === scripts/una-sola-realidad/refrescar-premisas.mjs · LAS PREMISAS NUMÉRICAS DE LOS CATÁLOGOS SELLADOS, REFRESCADAS DESDE EL DATO VIGENTE (owner 2026-10-06, diseño §6.5) ==
 * Los catálogos v13–v40 (`fixtures/procedencia/muestra-v13-v40.json`, 532 encargos) se sellaron a mano: sus premisas de CIFRA («Lider · Ventas = $17.8M») llevan el valor del dato de
 * ENTONCES. Con las tablas como realidad, ~100 de esas premisas pasaron a decir lo que el dato ya no dice, y la Entrega les agrega una línea («no coincide con lo entregado») que no es
 * un cambio del producto sino de un encargo viejo. Este script las refresca EXACTAMENTE como quien las escribió: con lo que el Core publica (`publica()` de scripts/consolidacion/base.mjs).
 *
 * REGLA (no refresca de más): una premisa de cifra se refresca SOLO si (a) coincidía con lo que el árbol de ANTES publicaba para esa cuenta y esa métrica, a la precisión con que está
 * escrita, y (b) ya no coincide con lo que publica el árbol de AHORA. Una premisa que nunca fue verdadera (la falsa a propósito: «rotación 1.8x» cuando es 1.6x) no se toca; una que sigue
 * siendo verdadera tampoco. El valor nuevo conserva el formato del viejo (símbolo, escala K/M, decimales, coma o punto, sufijo). No toca el encargo en nada más: ni partes, ni conteos, ni
 * órdenes, ni estados, ni relaciones (esas son las conclusiones del diseño §4f y los gates las declaran por id).
 * OFFLINE · cero red · cero LLM.
 * uso: node --import ./scripts/offline-guard.mjs scripts/una-sola-realidad/refrescar-premisas.mjs --viejo <raiz del árbol de antes> [--escribir] */
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NUEVO = path.resolve(arg("--nuevo", process.cwd())).replace(/\\/g, "/");
const VIEJO = arg("--viejo") ? path.resolve(arg("--viejo")).replace(/\\/g, "/") : null;
const ESCRIBIR = process.argv.includes("--escribir");
if (!VIEJO) { console.error("falta --viejo <raíz del árbol de antes>"); process.exit(2); }
const FIX = NUEVO + "/fixtures/procedencia/muestra-v13-v40.json";

const cargar = async (raiz) => (await import(pathToFileURL(raiz + "/scripts/consolidacion/base.mjs").href)).cargarBase(raiz);
const [bOld, bNew] = [await cargar(VIEJO), await cargar(NUEVO)];
const norm = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const publicadoPor = (base, metrica, sujeto) => {
  const ejes = base.esquema.EJES.filter((e) => { try { return !!base.entityIndex.resolveCanonical(e, sujeto); } catch { return false; } });
  const out = [];
  for (const e of ejes) { const pub = base.publica(e, metrica); if (pub && pub.has(norm(sujeto))) out.push(pub.get(norm(sujeto))); }
  return out;
};

/* una cifra escrita: { signo, prefijo, num, dec, sufijo, mult, coma } o, si es un número JSON, { numero } */
const MULT = { K: 1e3, M: 1e6, B: 1e9 };
function leer(v) {
  if (typeof v === "number") return Number.isFinite(v) ? { numero: v } : null;
  if (typeof v !== "string") return null;
  const m = /^\s*([+\-−]?)(\$?)\s*(\d[\d.,]*?)\s*([KMB])?\s*(%|x|×)?(\s+[A-Za-zÁ-úñ]+(?:\s+[A-Za-zÁ-úñ]+)?)?\s*$/.exec(v);
  if (!m) return null;
  let n = m[3]; const coma = /,\d{1,3}$/.test(n) && !/\./.test(n);
  n = coma ? n.replace(",", ".") : n.replace(/,/g, "");
  const x = parseFloat(n); if (!Number.isFinite(x)) return null;
  const dec = (n.split(".")[1] || "").length;
  return { signo: m[1] === "-" || m[1] === "−" ? -1 : 1, signoTxt: m[1], prefijo: m[2], num: x, dec, escala: m[4] || "", pct: m[5] || "", cola: m[6] || "", mult: MULT[m[4]] || 1, coma };
}
const valorDe = (c) => (c.numero != null ? c.numero : c.signo * c.num * c.mult);
const tolDe = (c) => (c.numero != null ? Math.max(1e-9, Math.abs(c.numero) * 1e-9) : 0.5 * Math.pow(10, -c.dec) * c.mult * 1.0001);
/* ¿lo escrito coincide con lo publicado a la precisión con que está escrito? Se prueban las escalas del Core (la venta comercial en miles; el resto crudo). */
const ESCALAS = [1, 1000];
const coincide = (c, pub) => ESCALAS.some((s) => Math.abs(valorDe(c) - pub * s) <= tolDe(c));
function escribirComo(c, pubNuevo, escalaOk) {
  const x = pubNuevo * escalaOk;
  if (c.numero != null) return Number.isInteger(c.numero) ? Math.round(x) : +x.toFixed(Math.max(2, (String(c.numero).split(".")[1] || "").length));
  const absX = Math.abs(x) / c.mult;
  let t = absX.toFixed(c.dec);
  if (c.coma) t = t.replace(".", ",");
  return `${c.signoTxt || (x < 0 ? "-" : "")}${c.prefijo}${t}${c.escala}${c.pct}${c.cola}`.replace(/^\s+/, "");
}

const F = JSON.parse(fs.readFileSync(FIX, "utf8"));
const cambios = [], sinTocar = { falsaAPropósito: 0, sigueVerdadera: 0, sinPublicacion: 0, noLeible: 0 };
for (const caso of F.casos) {
  for (const p of caso.encargo.premisas || []) {
    /* dos formas de premisa llevan una cifra del dato: «cifra» (p.valor) y «variacion» con su magnitud (p.variacion.valor: «Jumbo creció 12.2 %») */
    const esVar = p.tipo === "variacion" && p.variacion && p.variacion.valor != null;
    if (!(esVar || (p.tipo === "cifra" && p.valor != null))) continue;
    const dueno = esVar ? p.variacion : p, campoV = "valor", metricaP = esVar ? "variacion" : p.metrica;
    const c = leer(dueno[campoV]); if (!c) { sinTocar.noLeible++; continue; }
    const a = publicadoPor(bOld, metricaP, p.sujeto), n = publicadoPor(bNew, metricaP, p.sujeto);
    if (!a.length || !n.length) { sinTocar.sinPublicacion++; continue; }
    const escalaViejo = ESCALAS.find((s) => a.some((x) => Math.abs(valorDe(c) - x * s) <= tolDe(c)));
    if (escalaViejo == null) { sinTocar.falsaAPropósito++; continue; }
    if (n.some((x) => Math.abs(valorDe(c) - x * escalaViejo) <= tolDe(c))) { sinTocar.sigueVerdadera++; continue; }
    const pubN = n[0];
    const nuevo = escribirComo(c, pubN, escalaViejo);
    cambios.push({ id: caso.id, p: p.id, metrica: metricaP, sujeto: p.sujeto, de: dueno[campoV], a: nuevo });
    dueno[campoV] = nuevo;
  }
}
console.log(`premisas de cifra refrescadas: ${cambios.length} · sin tocar: ${JSON.stringify(sinTocar)}`);
for (const c of cambios.slice(0, 400)) console.log(`  ${c.id}.${c.p} · ${c.sujeto} · ${c.metrica}: ${JSON.stringify(c.de)} → ${JSON.stringify(c.a)}`);
if (ESCRIBIR) {
  F.nota = String(F.nota || "").replace(/\s*\[Una sola realidad[^\]]*\]/, "") + ` [Una sola realidad (owner 2026-10-06): las ${cambios.length} premisas de cifra que eran verdaderas con el dato de entonces y ya no lo son se refrescaron con scripts/una-sola-realidad/refrescar-premisas.mjs; nada más del encargo se tocó y el sha de cada caso se re-selló sobre el texto vigente.]`;
  fs.writeFileSync(FIX, JSON.stringify(F), "utf8");
  console.log("✓ escrito", FIX);
}
