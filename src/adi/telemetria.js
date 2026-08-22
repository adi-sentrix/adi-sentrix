/* === src/adi/telemetria.js · CÓMO SE ESTÁ PORTANDO ADI (owner 2026-08-21) =====================================
 * EL PROBLEMA QUE RESUELVE, textual de CLAUDE.md §3: «el repo NO registra consumo. No hay contador de llamadas,
 * gasto ni reintentos». Todo lo que sabemos de cómo responde ADI sale de EXÁMENES MANUALES que el owner paga de
 * a US$0.30. Así se descubrió el último defecto: por una captura de pantalla suya. Con clientes reales eso no se
 * sostiene — nadie se entera de que ADI está fallando hasta que alguien lo cuenta.
 *
 * QUÉ REGISTRA: un renglón por TURNO, con lo que hace falta para responder «¿cómo se está portando?» sin gastar
 * una llamada — ruta, estado, vetos, reparaciones, llamadas y latencia. Y nada más.
 *
 * ⚠️ LA FRONTERA DEL DATO, DECIDIDA ACÁ Y NO DESPUÉS. Este renglón es la tabla que Supabase va a heredar
 * ([[adi-frente-datos-del-cliente]]), así que nace con la regla puesta: **no guarda dato de negocio**. Ni cifras,
 * ni nombres de entidades, ni la firma de la carpeta. La PREGUNTA se guarda SOLO cuando el turno no salió verde
 * —que es el único caso en que hace falta saber qué se preguntó para arreglarlo— y recortada. Un registro de
 * salud no es un registro de conversación: mezclarlos es exactamente cómo un log termina siendo una filtración.
 *
 * DÓNDE VIVE HOY: en el navegador (`localStorage`), acotado a los últimos 200 turnos. No hay base de datos
 * todavía y no se inventa una: cuando llegue Supabase, `exportar()` entrega estos mismos renglones y el esquema
 * no cambia. Escribir en el navegador NO es una llamada a nadie — este módulo no puede gastar un peso.
 *
 * PURO · sin imports del gateway · sin red. Si `localStorage` no existe (Node, gates), degrada a memoria. */

export const TELEMETRIA_KEY = "adi_telemetria_v1";
const TOPE = 200;   // últimos N turnos · un anillo, no un archivo que crece sin fin

/* EL ESQUEMA, DECLARADO. Lo que no está acá no se guarda — y el gate lo verifica campo por campo, para que
 * agregar un campo con dato de negocio sea imposible por descuido.
 * ⚠️ `cortes` y `vacias` entraron el 2026-08-21 y cierran el hueco más caro del año: CUATRO veces el cerebro
 * devolvió cadena vacía y no se pudo diagnosticar. La causa (el razonamiento se comía el tope de tokens) apareció
 * recién cuando se instrumentó el MOTIVO DE CORTE… pero solo en la consola del examen. En el producto, un turno
 * vacío seguía diciendo «vacio» y nada más. Ahora el motivo viaja: con `estado:"vacio"` + `cortes:["max_tokens"]`
 * el diagnóstico llega solo, desde un turno real y gratis, en vez de costar una corrida paga.
 * Ninguno de los dos es dato de negocio: son la razón por la que el proveedor cortó y cuántas veces no hubo texto. */
export const CAMPOS_TELEMETRIA = ["t", "via", "route", "estado", "vetos", "reparaciones", "llamadas", "ms", "cortes", "vacias", "pregunta"];

let _memoria = [];   // respaldo cuando no hay localStorage (Node, gates, modo privado del navegador)

const _leer = () => {
  try {
    if (typeof localStorage === "undefined") return _memoria;
    const s = localStorage.getItem(TELEMETRIA_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return _memoria; }
};
const _escribir = (filas) => {
  _memoria = filas;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(TELEMETRIA_KEY, JSON.stringify(filas)); } catch { /* sin storage: queda en memoria */ }
};

/** registrarTurno(rastro) → guarda UN renglón. Nunca lanza: es un instrumento, no una garantía. */
export function registrarTurno(rastro) {
  try {
    const r = rastro || {};
    const estado = r.estado || null;
    const fila = {
      t: typeof r.t === "number" ? r.t : null,            // marca de tiempo, la pone el caller (este módulo es puro)
      via: r.via || null,                                  // natural · oracle · llm · deterministico · demo
      route: r.route || null,                              // lo que declara el motor
      estado,                                              // verde · reparado · suplente · vacio
      vetos: Array.isArray(r.vetos) ? r.vetos.slice(0, 6) : [],
      reparaciones: Number.isFinite(r.reparaciones) ? r.reparaciones : null,
      llamadas: Number.isFinite(r.llamadas) ? r.llamadas : null,
      ms: Number.isFinite(r.ms) ? Math.round(r.ms) : null,
      // POR QUÉ cortó el proveedor en cada llamada del turno, y cuántas volvieron sin una sola letra.
      cortes: Array.isArray(r.cortes) ? r.cortes.slice(0, 6) : [],
      vacias: Number.isFinite(r.vacias) ? r.vacias : null,
      // LA PREGUNTA SOLO CUANDO ALGO SALIÓ MAL (ver la frontera del dato, arriba)
      pregunta: estado && estado !== "verde" ? String(r.pregunta || "").slice(0, 120) : null,
    };
    _escribir([fila, ..._leer()].slice(0, TOPE));
    return fila;
  } catch { return null; }
}

/** resumenTelemetria() → la respuesta a «¿cómo se está portando?», sin gastar una llamada. */
export function resumenTelemetria() {
  const filas = _leer();
  const n = filas.length;
  if (!n) return { turnos: 0, texto: "Todavía no hay turnos registrados." };
  const porEstado = {};
  const porVeto = {};
  const porCorte = {};
  let sinTexto = 0;
  let llamadas = 0, conLlamadas = 0, ms = 0, conMs = 0, reparaciones = 0;
  for (const f of filas) {
    const e = f.estado || "sin estado";
    porEstado[e] = (porEstado[e] || 0) + 1;
    for (const v of (f.vetos || [])) porVeto[v] = (porVeto[v] || 0) + 1;
    for (const c of (f.cortes || [])) porCorte[c] = (porCorte[c] || 0) + 1;
    if (Number.isFinite(f.vacias) && f.vacias > 0) sinTexto++;
    if (Number.isFinite(f.llamadas)) { llamadas += f.llamadas; conLlamadas++; }
    if (Number.isFinite(f.ms)) { ms += f.ms; conMs++; }
    if (Number.isFinite(f.reparaciones)) reparaciones += f.reparaciones;
  }
  const pct = (k) => `${Math.round(((porEstado[k] || 0) / n) * 100)}%`;
  const vetos = Object.entries(porVeto).sort((a, b) => b[1] - a[1]);
  const cortes = Object.entries(porCorte).sort((a, b) => b[1] - a[1]);
  return {
    turnos: n,
    porEstado,
    verde: pct("verde"), reparado: pct("reparado"), suplente: pct("suplente"),
    reparaciones,
    llamadasPorTurno: conLlamadas ? +(llamadas / conLlamadas).toFixed(2) : null,
    msPromedio: conMs ? Math.round(ms / conMs) : null,
    vetosFrecuentes: vetos.slice(0, 5).map(([k, c]) => `${k} (${c})`),
    // Y EL RESUMEN LO DICE EN UNA LÍNEA: un turno vacío sin motivo es un misterio; con el motivo es un arreglo.
    cortesFrecuentes: cortes.slice(0, 3).map(([k, c]) => `${k} (${c})`),
    turnosSinTexto: sinTexto,
    texto: [
      `${n} turnos · ${pct("verde")} verde · ${pct("reparado")} reparado · ${pct("suplente")} suplente`,
      conLlamadas ? `${(llamadas / conLlamadas).toFixed(2)} llamadas por turno · ${reparaciones} reparaciones en total` : null,
      conMs ? `${Math.round(ms / conMs)} ms de promedio` : null,
      vetos.length ? `vetos más frecuentes: ${vetos.slice(0, 3).map(([k, c]) => `${k} (${c})`).join(" · ")}` : "sin vetos registrados",
      sinTexto ? `⚠️ ${sinTexto} turno(s) sin una sola letra del cerebro · motivos de corte: ${cortes.map(([k, c]) => `${k} (${c})`).join(" · ") || "(no declarados)"}` : null,
    ].filter(Boolean).join("\n"),
  };
}

/** exportarTelemetria() → los renglones crudos. Es la tabla que Supabase va a heredar, sin traducción. */
export function exportarTelemetria() { return _leer().slice(); }

/** borrarTelemetria() → vaciar el anillo (para empezar una medición limpia). */
export function borrarTelemetria() { _escribir([]); }
