/* === scripts/medicion-anfitrion/contador.mjs · EL CONTADOR DE CONSUMO Y EL TOPE DURO EN US$ DEL ARNÉS ═════════════
 * «Impedir el consumo técnicamente, no por instrucción» (CLAUDE.md §5). El tope NO es un aviso: es una condición que se
 * revisa ANTES de cada llamada, y si la llamada —en su PEOR caso— llevaría el gasto por encima del tope, la llamada NO SE HACE.
 *
 * PRECIOS (verificados por el owner 2026-10-05, US$ por millón de tokens): Sonnet 5.5 · entrada 2 · salida 10 · lectura de
 * caché 0,20; la ESCRITURA de caché se tarifa a 1,25× la entrada (precio de lista del caché de 5 min). `claude-sonnet-5-5` NO
 * está en `src/adi/llm/modelPricing.js` (ahí está `claude-sonnet-5` a 3/15, de lista): este contador lleva su PROPIA tabla,
 * que además entiende el caché (el contador del repo suma solo entrada y salida), y el informe declara esa diferencia.
 * Un modelo que no está en la tabla NO se mide: `modelosSinPrecio` queda no vacío y la corrida queda invalidada.
 *
 * TECHOS DE LA AUTORIZACIÓN (owner 2026-10-05): US$ 40 por corrida y US$ 80 en total, SOLO para las dos mediciones
 * oficiales. El ensayo con la suscripción no tiene API autorizada. Pedir un tope mayor que el techo se rechaza acá, no en
 * una instrucción: para subirlo hace falta una autorización NUEVA del owner y cambiar esta constante a propósito. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const TECHO_AUTORIZADO = Object.freeze({ porCorridaUsd: 40, totalUsd: 80 });

export const PRECIOS = Object.freeze({
  "claude-sonnet-5-5": Object.freeze({ in: 2.0, out: 10.0, cacheRead: 0.2, cacheWrite: 2.5 }),
  // el juez (otra familia, detrás de una bandera): precio del repo (`modelPricing.js`); sin tarifa de caché aparte → se cobra como entrada
  "gpt-5.6-luna": Object.freeze({ in: 0.2, out: 1.2, cacheRead: 0.2, cacheWrite: 0.2 }),
});

const _familia = (modelo) => {
  const id = String(modelo || "").trim().toLowerCase().replace(/^.*\//, "").replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|latest)$/, "");
  return Object.prototype.hasOwnProperty.call(PRECIOS, id) ? id : null;
};

/** costoUsd(modelo, uso) → número | null (null = modelo sin precio: NUNCA se cuenta como cero).
 * `uso`: { input_tokens, output_tokens, cache_read_input_tokens?, cache_creation_input_tokens? } (la forma de la API). */
export function costoUsd(modelo, uso) {
  const f = _familia(modelo);
  if (!f || !uso) return null;
  const p = PRECIOS[f];
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  return (n(uso.input_tokens) * p.in + n(uso.cache_creation_input_tokens) * p.cacheWrite + n(uso.cache_read_input_tokens) * p.cacheRead + n(uso.output_tokens) * p.out) / 1e6;
}

/** peorCasoUsd({ modelo, caracteres, maxTokens }) → lo MÁS que puede costar una llamada: toda la entrada a precio de
 * escritura de caché (el más caro de los tres), a 2,5 caracteres por token (por debajo de lo que mide el español con JSON:
 * sobreestima a propósito), y la salida COMPLETA hasta `max_tokens`. */
export function peorCasoUsd({ modelo, caracteres, maxTokens }) {
  const f = _familia(modelo);
  if (!f) return null;
  const p = PRECIOS[f];
  const entrada = Math.ceil(Number(caracteres) / 2.5);
  return (entrada * Math.max(p.in, p.cacheWrite) + Number(maxTokens) * p.out) / 1e6;
}

/** libro de gasto entre corridas (el tope TOTAL de la autorización): un JSON que suma lo gastado en cada corrida. */
export function leerLibroDeGasto(ruta) {
  if (!ruta || !existsSync(ruta)) return { corridas: [], totalUsd: 0 };
  return JSON.parse(readFileSync(ruta, "utf8"));
}
export function anotarEnLibro(ruta, { corridaId, usd, llamadas, cierre }) {
  if (!ruta) return null;
  const l = leerLibroDeGasto(ruta);
  l.corridas.push({ corridaId, usd: Number(usd.toFixed(4)), llamadas, cierre, en: new Date().toISOString() });
  l.totalUsd = Number(l.corridas.reduce((s, c) => s + c.usd, 0).toFixed(4));
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(l, null, 2));
  return l;
}

/**
 * crearContador({ topeUsd, topeTotalUsd?, gastadoPrevioUsd?, techo? }) → el contador de UNA corrida.
 *   · el tope efectivo es min(topeUsd, topeTotalUsd − gastadoPrevioUsd), y `topeUsd` no puede pasar del techo autorizado
 *   · `antesDeLlamar(peorCaso)` → { ok:true } | { ok:false, motivo, reasonCode:"tope_alcanzado" } — se llama ANTES de cada llamada
 *   · `despuesDeLlamar({ modelo, uso, rol })` suma el costo REAL; `llamadaSinConteo({ modelo, peorCaso })` cobra el PEOR caso
 *     (una llamada que salió y no volvió con conteo pudo facturarse: no se cuenta como cero)
 */
export function crearContador({ topeUsd, topeTotalUsd = null, gastadoPrevioUsd = 0, techo = TECHO_AUTORIZADO, previo = null } = {}) {
  if (!(Number(topeUsd) > 0)) throw new Error("contador: falta el tope duro en US$ (--tope-usd, obligatorio, sin valor por defecto)");
  if (Number(topeUsd) > techo.porCorridaUsd) throw new Error(`contador: el tope pedido (US$ ${topeUsd}) supera lo autorizado por el owner (US$ ${techo.porCorridaUsd} por corrida). Para subirlo hace falta una autorización nueva.`);
  const total = topeTotalUsd == null ? techo.totalUsd : Math.min(Number(topeTotalUsd), techo.totalUsd);
  const efectivo = Math.min(Number(topeUsd), total - Number(gastadoPrevioUsd));
  if (!(efectivo > 0)) throw new Error(`contador: no queda presupuesto autorizado (total US$ ${total} · ya gastado US$ ${gastadoPrevioUsd})`);

  // `previo`: el resumen de la MISMA corrida antes de una reanudación (una corrida interrumpida por red sigue siendo UNA corrida: su gasto no se reinicia)
  let gastado = previo ? Number(previo.costoUSD) || 0 : 0, llamadas = previo ? previo.llamadas || 0 : 0, sinConteo = previo ? previo.sinConteo || 0 : 0, abortadas = previo ? previo.abortadas || 0 : 0;
  const sinPrecio = new Map((previo && previo.modelosSinPrecio ? previo.modelosSinPrecio : []).map((x) => [x.modelo, x.veces]));
  const porModelo = previo && previo.porModelo ? JSON.parse(JSON.stringify(previo.porModelo)) : {};
  const tokens = previo && previo.tokens ? { ...previo.tokens } : { in: 0, cacheRead: 0, cacheWrite: 0, out: 0 };
  let topeAlcanzado = null;

  const _modelo = (m) => (porModelo[m] ||= { llamadas: 0, usd: 0, in: 0, cacheRead: 0, cacheWrite: 0, out: 0 });

  return {
    topeEfectivoUsd: efectivo,
    antesDeLlamar(peorCaso) {
      if (peorCaso == null) return { ok: false, reasonCode: "modelo_sin_precio", motivo: "el modelo no tiene precio en el contador: no se puede acotar el gasto, la llamada NO se hace" };
      if (gastado + peorCaso > efectivo) {
        topeAlcanzado = { gastadoUsd: Number(gastado.toFixed(4)), peorCasoUsd: Number(peorCaso.toFixed(4)), topeUsd: efectivo, llamadas };
        return { ok: false, reasonCode: "tope_alcanzado", motivo: `tope duro: gastado US$ ${gastado.toFixed(4)} + peor caso de esta llamada US$ ${peorCaso.toFixed(4)} > tope US$ ${efectivo.toFixed(2)} — la llamada NO se hace` };
      }
      return { ok: true };
    },
    despuesDeLlamar({ modelo, uso, peorCaso = null }) {
      llamadas += 1;
      const usd = costoUsd(modelo, uso);
      if (usd == null) {
        if (!_familia(modelo)) sinPrecio.set(modelo, (sinPrecio.get(modelo) || 0) + 1);
        // sin conteo utilizable: se cobra el peor caso (no se cuenta como cero)
        sinConteo += 1; if (peorCaso != null) { gastado += peorCaso; _modelo(modelo).usd += peorCaso; }
        _modelo(modelo).llamadas += 1;
        return { usd: peorCaso, sinConteo: true };
      }
      gastado += usd;
      const m = _modelo(modelo); m.llamadas += 1; m.usd += usd;
      const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
      m.in += n(uso.input_tokens); m.cacheRead += n(uso.cache_read_input_tokens); m.cacheWrite += n(uso.cache_creation_input_tokens); m.out += n(uso.output_tokens);
      tokens.in += n(uso.input_tokens); tokens.cacheRead += n(uso.cache_read_input_tokens); tokens.cacheWrite += n(uso.cache_creation_input_tokens); tokens.out += n(uso.output_tokens);
      return { usd, sinConteo: false };
    },
    /** una llamada que SALIÓ y no volvió (timeout, corte de red): pudo facturarse. Peor caso, y cuenta como sin conteo. */
    llamadaSinConteo({ modelo, peorCaso }) {
      llamadas += 1; sinConteo += 1; abortadas += 1;
      gastado += peorCaso || 0; _modelo(modelo).llamadas += 1; _modelo(modelo).usd += peorCaso || 0;
    },
    gastadoUsd: () => gastado,
    resumen() {
      return {
        llamadas, sinConteo, abortadas,
        sinConteoPct: llamadas ? Number(((sinConteo / llamadas) * 100).toFixed(2)) : 0,
        costoUSD: Number(gastado.toFixed(4)),
        tokens, porModelo,
        modelosSinPrecio: [...sinPrecio.entries()].map(([modelo, veces]) => ({ modelo, veces })),
        topeUsd: Number(topeUsd), topeEfectivoUsd: efectivo, topeTotalUsd: total, gastadoPrevioUsd: Number(gastadoPrevioUsd),
        topeAlcanzado,
        precios: PRECIOS,
      };
    },
  };
}
