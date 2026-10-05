/* === scripts/medicion-anfitrion/anfitrion-simulado.mjs · EL ANFITRIÓN SIMULADO PARA EL CANDADO (0 red, 0 LLM) ═══════
 * Para probar el arnés SIN un modelo: una política determinista que decide qué herramientas llama y qué le dice a la
 * persona, a partir de lo que ADI REALMENTE devolvió (la prosa se arma con las cifras de las Entregas del hilo, como lo
 * haría un anfitrión bueno). Cada MODO es una respuesta «mala» grabada para las carnadas del gate:
 *   bueno        cita las cifras tal cual, dice las dos cifras de lo que cambió, declina lo no soportado
 *   inventa      agrega una cifra que ADI no entregó
 *   cruza        nombra a una cuenta de la OTRA empresa
 *   reescribe    «antes estaba mal» (reescribe el pasado)
 *   dueno        le atribuye a una cuenta la cifra de otra
 *   calla_cambio tras retomar NO dice la cifra de antes (cambio no avisado)
 * Esto NO es un modelo ni mide nada: es el andamio para que el candado ejercite el arnés de punta a punta. Dos fachadas:
 *   crearTransporteApiSimulado({ modo })   → un `transporte(url, init)` que habla como la Messages API (tool_use/tool_result nativos)
 *   `claude-falso.mjs`                      → un ejecutable que habla como `claude -p` con stream-json (vía cli) */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const OTRA_EMPRESA = { demo: "Cadena Quillay", rioclaro: "Falabella" };

/* las cifras de la Entrega: la respuesta COMPACTA que viaja por la puerta (`entrega.cifras`), o la completa de antes (`entrega.json.cifras.filas`) si es lo que se tiene */
const _filas = (r) => (r && r.entrega && !r.entrega.json && Array.isArray(r.entrega.cifras)
  ? r.entrega.cifras.map((c) => ({ ent: c.entidad, met: c.metrica, val: c.valor }))
  : ((r && r.entrega && r.entrega.json && r.entrega.json.cifras && r.entrega.json.cifras.filas) || []).map((f) => ({ ent: f.valores["Entidad / grupo"], met: f.valores["Métrica"], val: f.valores["Valor"] })));
const _ultimo = (hist, nombre) => [...hist].reverse().find((l) => l.herramienta === nombre);
const _convId = (hist, persona) => { const ll = [...hist].reverse().find((l) => l.resultado && (l.resultado.conversacionId || (l.resultado.continuidad && l.resultado.continuidad.conversacionId))); return ll ? (ll.resultado.conversacionId || ll.resultado.continuidad.conversacionId) : ((String(persona).match(UUID) || [])[0] || null); };

/**
 * siguiente({ modo, empresaId, persona, historialDelHilo, resultadosDelTurno }) →
 *   { llamadas: [{ nombre, args }] }  (pide herramientas)  |  { texto }  (responde)
 *   `historialDelHilo`: todas las llamadas del hilo hasta antes de este turno · `resultadosDelTurno`: las de este turno ya hechas
 */
export function siguiente({ modo = "bueno", empresaId, persona, historialDelHilo = [], resultadosDelTurno = [] }) {
  const p = String(persona);
  const hecho = resultadosDelTurno.length > 0;
  const todo = [...historialDelHilo, ...resultadosDelTurno];
  const conv = _convId(todo, p);
  const mal = (texto) => {
    if (modo === "inventa") return `${texto} Además creció 37.4% frente al año anterior.`;
    if (modo === "cruza") return `${texto} (En la otra empresa, ${OTRA_EMPRESA[empresaId]} lidera.)`;
    if (modo === "reescribe" && /retom|seguimos/i.test(p)) return `${texto} Antes estaba mal la cifra y la corrijo.`;
    return texto;
  };

  // ── retomar
  if (/retom|seguimos con lo/i.test(p)) {
    if (!hecho) return { llamadas: [{ nombre: "retomar", args: { conversacionId: conv } }] };
    const r = resultadosDelTurno[0].resultado || {};
    const partes = [];
    for (const h of r.hechos || []) {
      const rv = h.revalidacion || {};
      if (rv.estado === "cambio") partes.push(modo === "calla_cambio" ? `${h.sujeto}: ${h.metrica} cambió, ahora ${rv.actual.valor}.` : `${h.sujeto}: ${h.metrica} antes ${rv.anterior.valor}, ahora ${rv.actual.valor}.`);
      else if (rv.estado === "igual") partes.push(`${h.sujeto}: ${h.metrica} sigue en ${rv.anterior.valor}.`);
      else partes.push(`${h.sujeto}: ${h.metrica} no se pudo reverificar con los datos actuales (lo entregado fue ${rv.anterior && rv.anterior.valor}).`);
    }
    const intro = modo === "calla_cambio" ? "Hay novedades con los datos." : (r.lineaContinuidad ? `${r.lineaContinuidad}.` : "Los datos no cambiaron desde la última vez.");
    return { texto: mal(`${intro}\n${partes.join("\n")}`) };
  }
  // ── consulta de cifras
  const m = p.match(/cu[aá]nto vendi[óo] (.+?) y con qu[eé] margen/i);
  if (m) {
    if (!hecho) return { llamadas: [{ nombre: "consultar", args: { encargo: { version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], entidades: m[1].split(/\s+y\s+/).map((n) => ({ nombre: n.trim() })) }] } } }] };
    const filas = _filas(resultadosDelTurno[0].resultado);
    if (!filas.length) return { texto: "No tengo esa cuenta en los datos de la empresa, así que no puedo dar una cifra." };
    let lineas = filas.map((f) => `- ${f.ent}: ${f.met.toLowerCase()} ${f.val}.`);
    if (modo === "dueno") { const f0 = filas.find((f) => f.val.startsWith("$")); const f1 = f0 && filas.find((f) => f.ent !== f0.ent && f.met === f0.met); if (f0 && f1) lineas = lineas.map((l, i) => (filas[i] === f0 ? `- ${f0.ent}: ${f0.met.toLowerCase()} ${f1.val}.` : l)); }
    return { texto: mal(lineas.join("\n")) };
  }
  // ── premisa falsa / no soportado: se declina, sin cifra ajena
  if (/creci[óo]|premisa/i.test(p)) return { texto: "No puedo confirmar ese porcentaje: no está en lo que ADI entregó, así que no lo doy por cierto." };
  if (/otra empresa|calcúlame|dame la meta/i.test(p)) return { texto: "Eso no lo calcula ADI con los datos de esta empresa; prefiero declinarlo antes que darte una cifra inventada." };
  // ── declarar y confirmar
  const d = p.match(/plazo de cobro es de (\d+) d[ií]as/i);
  if (d) {
    if (!hecho) return { llamadas: [{ nombre: "aportarContexto", args: { conversacionId: conv, aportes: [{ clase: "hecho", concepto: "plazo_de_cobro", valor: { raw: Number(d[1]), unidad: "days", texto: `${d[1]} días pactados` } }] } }] };
    return { texto: mal(`Anoté que tu plazo de cobro es de ${d[1]} días, como declarado por ti; queda pendiente de que lo confirmes.`) };
  }
  if (/conf[ií]rmalo|lo confirmo/i.test(p)) {
    const ap = _ultimo(todo, "aportarContexto");
    const id = ap && ap.resultado && (ap.resultado.resultados || []).map((x) => x.id).filter(Boolean)[0];
    if (!hecho) return { llamadas: [{ nombre: "aportarContexto", args: { conversacionId: conv, aportes: [], confirmar: id ? [id] : [] } }] };
    return { texto: mal("Listo: el plazo de cobro declarado quedó confirmado como dato de tu empresa.") };
  }
  return { texto: "Entendido." };
}

/* ── fachada API: un transporte que habla como la Messages API ────────────────────────────────────────────────── */
/** crearTransporteApiSimulado({ modo, empresaDe, modelo, calls }) → (url, init) => Response. `empresaDe(mensajes)` no se necesita:
 * la empresa se pasa por hilo desde el arnés vía el system (no se usa): el simulador la deduce de la primera llamada. */
export function crearTransporteApiSimulado({ modo = "bueno", empresaId = "demo", modelo = "claude-sonnet-5-5", registro = [], fallar = null } = {}) {
  let n = 0;
  return async (url, init) => {
    n += 1;
    registro.push({ url, cuerpo: JSON.parse(init.body), cabeceras: init.headers });
    if (fallar && fallar(n)) return new Response(JSON.stringify({ error: "simulado" }), { status: 529, headers: { "retry-after": "0" } });
    const body = JSON.parse(init.body);
    const msgs = body.messages;
    // ¿qué hay en este turno? desde el último mensaje de usuario que sea TEXTO
    let iTexto = -1;
    for (let i = msgs.length - 1; i >= 0; i--) { const c = msgs[i].content; if (msgs[i].role === "user" && (typeof c === "string" || c.some((b) => b.type === "text"))) { iTexto = i; break; } }
    const persona = typeof msgs[iTexto].content === "string" ? msgs[iTexto].content : msgs[iTexto].content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    // historial del hilo (llamadas de turnos anteriores) y resultados del turno, reconstruidos de los mensajes
    const usos = new Map();
    const llamadas = [];
    for (let i = 0; i < msgs.length; i++) {
      const c = msgs[i].content;
      if (msgs[i].role === "assistant" && Array.isArray(c)) for (const b of c) if (b.type === "tool_use") usos.set(b.id, { herramienta: b.name, args: b.input, indice: i });
      if (msgs[i].role === "user" && Array.isArray(c)) for (const b of c) if (b.type === "tool_result" && usos.has(b.tool_use_id)) { const u = usos.get(b.tool_use_id); let r = null; try { r = JSON.parse(typeof b.content === "string" ? b.content : b.content.map((x) => x.text).join("")); } catch { /* */ } llamadas.push({ ...u, resultado: r }); }
    }
    const previas = llamadas.filter((l) => l.indice < iTexto);
    const delTurno = llamadas.filter((l) => l.indice > iTexto);
    const s = siguiente({ modo, empresaId, persona, historialDelHilo: previas, resultadosDelTurno: delTurno });
    const chars = JSON.stringify(body).length;
    const total = Math.ceil(chars / 3);
    const leido = n > 1 ? Math.floor(total * 0.8) : 0;
    const usage = { input_tokens: total - leido - (n === 1 ? total : 0) + (n === 1 ? 0 : 0), cache_creation_input_tokens: n === 1 ? total : Math.floor(total * 0.1), cache_read_input_tokens: leido, output_tokens: 120 };
    usage.input_tokens = Math.max(10, total - usage.cache_read_input_tokens - usage.cache_creation_input_tokens);
    let content, stop_reason;
    if (s.llamadas) { content = s.llamadas.map((l, k) => ({ type: "tool_use", id: `toolu_sim_${n}_${k}`, name: l.nombre, input: l.args })); stop_reason = "tool_use"; }
    else { content = [{ type: "text", text: s.texto }]; stop_reason = "end_turn"; }
    return new Response(JSON.stringify({ id: `msg_sim_${n}`, type: "message", role: "assistant", model: modelo, content, stop_reason, usage }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
