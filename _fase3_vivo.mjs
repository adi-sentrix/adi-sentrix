/* _fase3_vivo.mjs · NOTARIO SEMÁNTICO · FASE 3 · CERTIFICACIÓN EN VIVO (owner 2026-09-15) ══════════════════════════════════════════
 * GASTA DINERO REAL. Solo se corre con la autorización del owner que nombre el gasto. La de esta corrida: «máximo 30 llamadas externas
 * y US$3 de gasto total; si cualquiera de los dos límites se alcanza, detente y trae resultados». Los dos topes son cerrojos acá
 * (`TOPE_LLAMADAS`, `TOPE_USD`): la llamada que los excedería no sale.
 *
 * Qué hace: corre N prompts NUEVOS (fixtures/notario-fase3-prompts-2026-09-15.json) por el bucle real (`answerViaAgente`) con el cerebro
 * de producción (`handleAgente` → adapter del proveedor, mismo system, mismo catálogo, mismo `paso`), guardando por llamada la salida
 * cruda del modelo (prosa + bloque), la boleta con la que se juzgó, el uso de tokens, el costo (tabla de la casa) y la latencia; y por
 * turno el expediente del Notario. Después (fase B) el EXTRACTOR INDEPENDIENTE —otro modelo, que ve SOLO la prosa servida— extrae las
 * afirmaciones de hecho para medir la omisión sin que el modelo se evalúe a sí mismo. Todo queda en
 * fixtures/notario-fase3-vivo-2026-09-15.json; la medición (fase C) es offline: `node _fase3_medir.mjs`.
 *
 * Uso: node _fase3_vivo.mjs [--solo=agente|extractor] [--desde=N] */
import fs from "node:fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { initTenant, getTenantId, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente, TECHO_ENTRADA_CIERRE_CHARS } from "./src/adi/agente/bucleAgente.js";
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";
import { handleAgente } from "./src/adi/llm/gatewayCore.js";
import { estimateCostUSD, MODEL_PRICING, resolvePricingKey } from "./src/adi/llm/modelPricing.js";
/* el costo PARA EL CERROJO cuenta también el caché (escritura ×1,25 · lectura ×0,1), que la tabla de la casa no tarifa: se toma el mayor de los dos */
const costoConCache = (model, usage) => { const fam = resolvePricingKey(model); const p = fam && MODEL_PRICING[fam]; if (!p || !usage) return null; const inT = Number(usage.input_tokens) || 0, cw = Number(usage.cache_creation_input_tokens) || 0, cr = Number(usage.cache_read_input_tokens) || 0, out = Number(usage.output_tokens) || 0; return (inT * p.in + cw * p.in * 1.25 + cr * p.in * 0.1) / 1e6 + (out * p.out) / 1e6; };
import { extraerDeclaracion, MARCA_INICIO, MARCA_FIN } from "./src/adi/notario/declaracion.js";

const TOPE_LLAMADAS = 30;          // la autorización del owner: 30 llamadas externas en total (agente + extractor)
const TOPE_USD = 3;                // …y US$3 en total (owner 2026-09-15, segunda autorización: «presupuesto máximo US$3»)
const TOPE_AGENTE = 24;            // reserva para el extractor: el agente no pasa de 24
const TOPE_POR_TURNO = 3;          // cierre + reparación + re-cierre; más que eso, el turno se corta y se anota
const SALIDA = "fixtures/notario-fase3-vivo-2026-09-15.json";
const PROMPTS = JSON.parse(fs.readFileSync("fixtures/notario-fase3-prompts-2026-09-15.json", "utf8")).prompts;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([a-z]+)=(.*)$/.exec(a); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true]; }));
const solo = args.solo || null;

initTenant(TENANT_DEMO);
const scenario = ESCENARIO_INICIAL;
const corpus = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, "utf8")) : { fecha: "2026-09-15", escenario: scenario, tenant: getTenantId(), autorizacion: "owner 2026-09-15: máximo 30 llamadas externas y US$3", turnos: [], extractor: [], contador: { llamadas: 0, usd: 0 } };
const guardar = () => fs.writeFileSync(SALIDA, JSON.stringify(corpus, null, 1) + "\n");
const contador = corpus.contador;
let detenido = null;   // el tope que se alcanzó (el bucle del agente puede tragarse la excepción: la bandera lo detiene igual)
const _antesDeLlamar = (quien) => {
  if (contador.llamadas + 1 > TOPE_LLAMADAS) { detenido = `TOPE de llamadas (${TOPE_LLAMADAS}) alcanzado antes de ${quien}`; throw new Error(detenido); }
  if (contador.usd >= TOPE_USD) { detenido = `TOPE de gasto (US$${TOPE_USD}) alcanzado antes de ${quien}`; throw new Error(detenido); }
};
const _contar = (usd) => { contador.llamadas += 1; contador.usd += Number(usd) || 0; guardar(); };

/* ── FASE A · el agente en vivo ─────────────────────────────────────────────────────────────────────────────────────── */
async function faseAgente() {
  const desde = Number(args.desde) || 0;
  const contexto = (() => { try { const t = getTenantData(); return (t && t.perfil && t.perfil.contexto) || null; } catch { return null; } })();
  const system = sistemaDelAgente(scenario, { contextoDelNegocio: contexto }).fijo;
  const tools = catalogoAgente();
  for (let i = desde; i < PROMPTS.length; i++) {
    const q = PROMPTS[i].texto;
    if (corpus.turnos.some((t) => t.i === i)) continue;   // ya corrido (reanudación)
    if (contador.llamadas + 1 > TOPE_AGENTE) { console.log(`\n■ tope del agente (${TOPE_AGENTE} llamadas): se detiene antes del turno ${i}`); break; }
    const llamadas = [];
    let cortado = null;
    const cerebro = async ({ mensajes, ronda, attempt, motivoReintento, cierre, figsEnBoleta, vetoConCifra, figs }) => {
      if (llamadas.length >= TOPE_POR_TURNO) { cortado = `tope por turno (${TOPE_POR_TURNO})`; throw new Error(cortado); }
      _antesDeLlamar(`turno ${i} ronda ${ronda}`);
      if (contador.llamadas + 1 > TOPE_AGENTE) { cortado = `tope del agente (${TOPE_AGENTE})`; throw new Error(cortado); }
      const _charsHilo = (mensajes || []).reduce((n, m) => n + String((m && m.content) || "").length, 0);
      const paso = (cierre || attempt > 0) && ((figsEnBoleta | 0) > 0 || vetoConCifra) && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";
      const t0 = Date.now();
      const out = await handleAgente({ mensajes, system, tools, paso, access: null, tenantId: getTenantId(), attempt, motivoReintento }, process.env);
      const ms = Date.now() - t0;
      if (!out || !out.ok) throw new Error((out && out.error) || "gateway sin agente");
      const usdCasa = Number.isFinite(out.costUSD) ? out.costUSD : estimateCostUSD(out.model, out.usage);
      const usd = Math.max(Number(usdCasa) || 0, Number(costoConCache(out.model, out.usage)) || 0);
      _contar(usd);
      const reg = { ronda, attempt, paso, cierre: !!cierre, motivoReintento: motivoReintento || null, charsHilo: _charsHilo, figsEnBoleta: figsEnBoleta | 0,
        modelo: out.model, usage: out.usage || null, usd, usdCasa, ms, stop: out.stop || null, tipo: out.tipo,
        salida: out.tipo === "herramientas" ? JSON.stringify(out.pedidos) : String(out.texto || ""),
        figs: Array.isArray(figs) ? figs : [] };
      llamadas.push(reg);
      console.log(`  · llamada ${contador.llamadas} · turno ${i} ronda ${ronda} · ${paso} · ${out.tipo} · ${out.usage ? `${out.usage.input_tokens}+${out.usage.cache_read_input_tokens || 0}c→${out.usage.output_tokens}` : "sin usage"} · US$${usd.toFixed(4)} · ${(ms / 1000).toFixed(1)}s · acumulado US$${contador.usd.toFixed(3)}`);
      return out.tipo === "herramientas" ? { tipo: "herramientas", pedidos: out.pedidos || [], stop: out.stop ?? null } : { tipo: "texto", texto: String(out.texto || ""), stop: out.stop ?? null };
    };
    console.log(`\n■ turno ${i} · «${q}»`);
    const t0 = Date.now();
    let r = null, error = null;
    try { r = await answerViaAgente({ text: q, history: [], mem: {}, scenario, callAgente: cerebro }); } catch (e) { error = String(e && e.message || e); }
    const ms = Date.now() - t0;
    const a = r && r.r && r.r.agente ? r.r.agente : null;
    corpus.turnos.push({ i, pregunta: q, tags: PROMPTS[i].tags || [], ms, error, cortado,
      servido: r && r.r ? String(r.r.text || "") : "", estado: a ? a.estado : null, calls: a ? a.calls : null, figs: a ? a.figs : null,
      vetos: a ? a.vetos : null, cortes: a ? a.cortes : null, notario: a ? a.notario : null, via: a ? a.via : null, caida: a ? a.caida : null,
      llamadas: llamadas.map((l) => ({ ...l, declaracion: l.tipo === "texto" ? extraerDeclaracion(l.salida) : null })) });
    guardar();
    console.log(`  → estado ${a ? a.estado : "—"} · ${llamadas.length} llamadas · ${(ms / 1000).toFixed(1)}s${error ? ` · ERROR ${error.slice(0, 120)}` : ""}${cortado ? ` · CORTADO: ${cortado}` : ""}`);
    if (detenido || /TOPE de/.test(String(error || ""))) { console.log(`\n■ se alcanzó un tope (${detenido || error}): se detiene y se traen resultados`); break; }
    if (contador.usd >= TOPE_USD) { detenido = `TOPE de gasto (US$${TOPE_USD})`; console.log(`\n■ ${detenido}: se detiene`); break; }
  }
}

/* ── FASE B · el extractor independiente ────────────────────────────────────────────────────────────────────────────────
 * Otro modelo (Opus 5, no el del agente), que ve SOLO la prosa servida —sin el bloque, sin la boleta— y extrae las afirmaciones de hecho
 * con el mismo esquema (una por línea). En lotes de hasta 3 respuestas por llamada (30 llamadas en total incluyen esta fase). */
const MODELO_EXTRACTOR = "claude-opus-5";
const INSTRUCCION_EXTRACTOR = `Eres un extractor de afirmaciones. Recibes respuestas de un asesor de negocios (en español) y devuelves, para cada respuesta, TODAS las afirmaciones de HECHO que la prosa hace: cifras, órdenes/rankings/superlativos, relaciones (mayor/menor/parte/razón), grupos, conteos, variaciones (sube/baja/crece/cae), estados (frenado, vencido, sano). No incluyas opiniones, recomendaciones, ofertas ni preguntas. No sabes nada del negocio: extrae lo que la prosa AFIRMA, sin juzgar si es verdad.
Formato de salida, sin ningún texto fuera de él: para cada respuesta un bloque
[R<k>]
${MARCA_INICIO}
{"tipo":"cifra|orden|relacion|grupo|conteo|variacion|estado","sujeto":"<entidad o negocio>","metrica":"<métrica tal como la prosa la nombra>","valor":"<cifra literal si la hay>","orden":{"forma":"max|min|topk|puesto","k":<n>,"direccion":"mayor|menor"},"relacion":{"forma":"mayor|menor|parte|igual|razon","vs":"<otro sujeto o métrica>"},"conteo":{"n":<n>,"m":<m o null>,"predicado":"<qué se cuenta>"},"variacion":{"direccion":"sube|baja","valor":"<cifra si la hay>"},"estado":{"estado":"<estado>"},"universo":"<de qué conjunto, si la prosa lo dice>","texto":"<fragmento LITERAL de la prosa, ≤80 caracteres, que contiene la afirmación>"}
${MARCA_FIN}
Incluye solo los campos que apliquen al tipo. Una afirmación por línea. El campo "texto" tiene que ser un fragmento literal (copiado) de la prosa.`;
async function faseExtractor() {
  /* las piezas: la prosa del MODELO (sin su bloque) en cada sitio; --piezas=cierres (por defecto) | reparaciones */
  const sitioPedido = args.piezas === "reparaciones" ? "reparacion" : "cierre";
  const piezas = [];
  for (const t of corpus.turnos) {
    const textos = (t.llamadas || []).filter((l) => l.tipo === "texto" && l.declaracion && String(l.declaracion.respuesta || "").trim());
    const pieza = sitioPedido === "cierre" ? textos[0] : textos[1];
    if (!pieza) continue;
    if (corpus.extractor.some((x) => x.i === t.i && x.sitio === sitioPedido)) continue;
    if (args.turnos && !String(args.turnos).split(",").map(Number).includes(t.i)) continue;   // --turnos=4,7,9: solo esas piezas
    piezas.push({ i: t.i, sitio: sitioPedido, pregunta: t.pregunta, prosa: String(pieza.declaracion.respuesta).replace(/\[\[CALCULO\]\][\s\S]*?\[\[\/CALCULO\]\]/g, "").trim() });
  }
  const lotes = []; for (let k = 0; k < piezas.length; k += 3) lotes.push(piezas.slice(k, k + 3));
  for (const lote of lotes) {
    if (detenido) break;
    _antesDeLlamar(`extractor (${sitioPedido}: turnos ${lote.map((t) => t.i).join(",")})`);
    const user = lote.map((t, k) => `[R${k + 1}] (respuesta a la pregunta: «${t.pregunta}»)\n${t.prosa}`).join("\n\n────\n\n");
    const body = { model: MODELO_EXTRACTOR, max_tokens: 12000, system: INSTRUCCION_EXTRACTOR, messages: [{ role: "user", content: user }] };
    const headers = { "content-type": "application/json", "anthropic-version": "2023-06-01" };
    if (process.env.ANTHROPIC_API_KEY) headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
    const t0 = Date.now();
    const res = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
    const ms = Date.now() - t0;
    if (!res.ok) { const txt = await res.text(); throw new Error(`extractor HTTP ${res.status}: ${txt.slice(0, 200)}`); }
    const data = await res.json();
    const usd = Math.max(Number(estimateCostUSD(data.model || MODELO_EXTRACTOR, data.usage)) || 0, Number(costoConCache(data.model || MODELO_EXTRACTOR, data.usage)) || 0);
    _contar(usd);
    const texto = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    console.log(`  · extractor · ${sitioPedido} · turnos ${lote.map((t) => t.i).join(",")} · ${data.usage ? `${data.usage.input_tokens}→${data.usage.output_tokens}` : "sin usage"} · US$${usd.toFixed(4)} · ${(ms / 1000).toFixed(1)}s · acumulado US$${contador.usd.toFixed(3)} · llamadas ${contador.llamadas}`);
    const partes = texto.split(/\[R(\d+)\]/).slice(1);
    for (let k = 0; k < partes.length; k += 2) {
      const idx = Number(partes[k]) - 1; const t = lote[idx]; if (!t) continue;
      const ex = extraerDeclaracion(partes[k + 1]);
      corpus.extractor.push({ i: t.i, sitio: t.sitio, modelo: data.model || MODELO_EXTRACTOR, usage: data.usage || null, usd: usd / lote.length, ms, afirmaciones: ex.afirmaciones || [], errores: ex.errores, crudo: partes[k + 1].slice(0, 8000) });
    }
    guardar();
  }
}

try {
  if (!solo || solo === "agente") await faseAgente();
  if (!solo || solo === "extractor") await faseExtractor();
} catch (e) {
  console.log(`\n■ DETENIDO: ${String(e && e.message || e).slice(0, 300)}`);
} finally {
  guardar();
  console.log(`\n── fase 3 · llamadas ${contador.llamadas}/${TOPE_LLAMADAS} · gasto US$${contador.usd.toFixed(3)}/${TOPE_USD} (tabla de la casa) · turnos ${corpus.turnos.length}/${PROMPTS.length} · extractor ${corpus.extractor.length} respuestas ──`);
}
