/* === ui/PanelDatos.jsx · TUS DATOS · la pantalla de carga (v1.4 · owner 2026-08-25) =========================
 *
 * LO QUE PIDIÓ EL OWNER, textual: «que el usuario pueda subir la plantilla, ver la preview, confirmar si hay
 * alertas, y dejar esos datos activos para que ADI responda sobre ellos». Eso son cuatro pasos y esta pantalla
 * es exactamente esos cuatro, en ese orden.
 *
 * ⚠️ EL ORDEN NO ES COSMÉTICO. La apertura va ANTES de la preview, no después, y es decisión suya: «el usuario
 * sabrá que ya detectamos algo, y él deberá confirmar si seguimos así». Un aviso que aparece debajo de un resumen
 * tranquilizador ya llegó tarde. Por eso lo primero que se lee, cuando hay algo que decir, es lo que llama la
 * atención — y la pregunta que lo acompaña.
 *
 * ⚠️ NO BLOQUEA. Las alarmas de plausibilidad no son el validador: el archivo YA pasó los 22 chequeos de forma.
 * Acá se lee un negocio que puede ser raro, y el negocio raro es del cliente. Se avisa, se pregunta, y si dice
 * que siga, se sigue — con la observación pegada a lo que venga después (el sello).
 *
 * CERO CÁLCULO ACÁ. Todo lo que se pinta —totales, procedencia, apertura, sello— llega armado del servidor.
 * La regla de la casa vale igual para esta pantalla: la vista pinta, el módulo decide.
 */
import React, { useState, useRef } from "react";
import { C } from "./theme.js";
import { getAccessCode } from "../adi/accessClient.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'DM Sans', system-ui, sans-serif";

const _n = (x) => (typeof x === "number" ? x.toLocaleString("es-CL") : "—");
const _money = (x) => (typeof x === "number" ? "$" + Math.round(x).toLocaleString("es-CL") : "—");

/** Lee el archivo del disco como base64 · el `.xlsx` viaja al servidor porque leerlo exige descomprimir, y el
 *  navegador no tiene con qué. Ver `handleIngesta.server.js` para el porqué completo. */
function aBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("no se pudo leer el archivo del disco"));
    fr.onload = () => {
      const s = String(fr.result || "");
      resolve(s.slice(s.indexOf(",") + 1));   // data:...;base64,XXXX → XXXX
    };
    fr.readAsDataURL(file);
  });
}

/* El código de acceso viaja con cada pedido, igual que en el resto del producto: es de donde el servidor saca
 * DE QUÉ EMPRESA es esta carga cuando tiene que guardarla. El navegador no elige empresa — lleva su código
 * firmado y el servidor lee lo que ya verificó. */
async function pedir(payload) {
  const res = await fetch("/api/adi-ingesta", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, access: getAccessCode() }),
  });
  return res.json();
}

/* ── piezas de pantalla ────────────────────────────────────────────────────────────────────────────────────── */

const Eyebrow = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "1.1px", textTransform: "uppercase",
    color: C.textMuted, fontWeight: 600, marginBottom: 9 }}>{children}</div>
);

const Dato = ({ rotulo, valor, tono }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontFamily: SANS, fontSize: 10.5, color: C.textMuted, marginBottom: 3 }}>{rotulo}</div>
    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: tono || C.text,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
  </div>
);

const Boton = ({ children, onClick, primario, disabled, testid }) => (
  <button data-testid={testid} onClick={onClick} disabled={disabled}
    style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 7,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
      background: primario ? C.celeste : "transparent",
      color: primario ? "#06232b" : C.textSub,
      border: primario ? "none" : `1px solid ${C.borderLight}` }}>{children}</button>
);

/* ── la pantalla ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * PanelDatos · props:
 *   onCerrar()            → cerrar sin activar nada
 *   onActivar(dataset, s) → el usuario confirmó: estos datos pasan a ser los de la sesión (`s` = sello de lectura)
 *   onVolverAlDemo()      → deshacer: volver al negocio de demostración
 *   activo                → { nombre, empresa } del archivo que está activo ahora, o null si corre el demo
 */
export function PanelDatos({ onCerrar, onActivar, onVolverAlDemo, activo }) {
  const [estado, setEstado] = useState("vacio");     // vacio · leyendo · rechazado · listo
  const [r, setR] = useState(null);                  // la respuesta del servidor
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  async function subir(file) {
    if (!file) return;
    setEstado("leyendo"); setError(null); setR(null);
    try {
      const resp = await pedir({ archivo: await aBase64(file), nombre: file.name });
      setR(resp);
      setEstado(resp && resp.ok ? "listo" : "rechazado");
      if (resp && !resp.ok) setError(resp.motivo || "el archivo no se pudo procesar");
    } catch (e) {
      setEstado("rechazado");
      setError((e && e.message) || "no se pudo contactar al servidor");
    }
  }

  /* CONFIRMAR = ADOPTAR. Le avisa al servidor que ESTA versión pasa a ser la de la empresa, y recién después
   * activa en la sesión. El orden importa: si el servidor no pudo, el usuario tiene que saber que sus datos
   * no quedaron guardados, no descubrirlo la próxima vez que entre.
   *
   * ⚠️ SIN BASE CONFIGURADA NO HAY `versionId`, Y ENTONCES NO SE LLAMA A NADIE: se activa en memoria como
   * siempre. Es el mismo producto de hoy, sin un paso de más. */
  async function confirmar() {
    const versionId = r && r.persistencia && r.persistencia.versionId;
    if (versionId) {
      setGuardando(true);
      try {
        const resp = await pedir({ op: "activar", versionId });
        if (!resp || !resp.ok) {
          setGuardando(false);
          setError((resp && resp.motivo) || "no se pudieron guardar estos datos");
          return;
        }
      } catch {
        setGuardando(false);
        setError("no se pudo contactar al servidor para guardar estos datos");
        return;
      }
      setGuardando(false);
    }
    onActivar(r.dataset, r.selloConfirmado, { nombre: p.archivo, empresa: (r.dataset && r.dataset.nombre) || p.archivo });
  }

  async function bajarPlantilla(conEjemplo) {
    try {
      const resp = await pedir({ op: "plantilla", conEjemplo });
      if (!resp || !resp.ok) return;
      const bin = atob(resp.archivo);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = resp.nombre; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* si el navegador no deja bajar, no se rompe la pantalla */ }
  }

  const p = (r && r.preview) || null;
  const t = (p && p.totales) || null;
  const proc = (t && t.procedencia) || null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,6,6,0.72)",
      backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>

      <div data-testid="panel-datos" style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto",
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "26px 28px 24px" }}>

        {/* ── cabecera ───────────────────────────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <Eyebrow>Tus datos</Eyebrow>
            <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>
              Prueba ADI con la información de tu negocio
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.textSub, lineHeight: 1.55, marginTop: 7 }}>
              Tres hojas para llenar: <b style={{ color: C.textSub }}>Empresa</b>, <b style={{ color: C.textSub }}>Ventas</b> e
              {" "}<b style={{ color: C.textSub }}>Inventario</b>, más una de ejemplo para mirar. Los campos obligatorios
              van en amarillo. Solo hechos — ADI hace las cuentas, y antes de activar nada te muestro qué leí.
            </div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar"
            style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* ── qué está activo ahora ──────────────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 18, padding: "10px 13px", borderRadius: 8, background: C.surfaceAlt,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSub, minWidth: 0 }}>
            {activo
              ? <>Ahora ADI responde sobre <b style={{ color: C.text }}>{activo.empresa}</b>, de <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{activo.nombre}</span>.</>
              : <>Ahora ADI responde sobre el <b style={{ color: C.text }}>negocio de demostración</b>.</>}
          </div>
          {activo && <Boton onClick={onVolverAlDemo} testid="datos-volver-demo">Volver al demo</Boton>}
        </div>

        {/* ── paso 1 · el archivo ────────────────────────────────────────────────────────────────────── */}
        {estado !== "listo" && (
          <div style={{ marginTop: 20 }}>
            <input ref={fileRef} type="file" accept=".xlsx" data-testid="datos-input" style={{ display: "none" }}
              onChange={(e) => subir(e.target.files && e.target.files[0])}/>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Boton primario testid="datos-subir" disabled={estado === "leyendo"}
                onClick={() => fileRef.current && fileRef.current.click()}>
                {estado === "leyendo" ? "Leyendo…" : "Subir mi planilla"}
              </Boton>
              {/* UNA SOLA DESCARGA (owner 2026-08-26): «no creo que deban descargar una planilla de ejemplo,
                  podrías colocar una pestaña hoja con ese ejemplo y listo». El archivo trae la pestaña Ejemplo
                  adentro, así que dos botones eran dos caminos para lo mismo y una duda sobre cuál bajar. */}
              <Boton onClick={() => bajarPlantilla(false)} testid="datos-bajar-plantilla">Descargar la plantilla</Boton>
            </div>
          </div>
        )}

        {/* ── el rechazo, con qué corregir ───────────────────────────────────────────────────────────── */}
        {estado === "rechazado" && (
          <div data-testid="datos-rechazo" style={{ marginTop: 16, padding: "13px 15px", borderRadius: 8,
            background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.22)" }}>
            <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: C.red }}>{error}</div>
            {p && (p.bloqueos || []).length > 0 && (
              <ul style={{ margin: "9px 0 0 16px", padding: 0 }}>
                {p.bloqueos.slice(0, 8).map((b, i) => (
                  <li key={i} style={{ fontFamily: SANS, fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
                    {b.detalle || b.tipo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── paso 2 · LA APERTURA, antes que el resumen (decisión del owner) ─────────────────────────── */}
        {estado === "listo" && r.apertura && (
          <div data-testid="datos-apertura" style={{ marginTop: 18, padding: "15px 17px", borderRadius: 9,
            background: "rgba(253,224,71,0.05)", border: "1px solid rgba(253,224,71,0.22)" }}>
            <Eyebrow>Antes de analizar</Eyebrow>
            <div style={{ fontFamily: SANS, fontSize: 12.8, color: C.textSub, lineHeight: 1.62, whiteSpace: "pre-line" }}>
              {r.apertura}
            </div>
          </div>
        )}

        {/* ── paso 3 · la preview: qué leyó ADI ───────────────────────────────────────────────────────── */}
        {estado === "listo" && p && (
          <div style={{ marginTop: 18 }}>
            <Eyebrow>Esto es lo que leí</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14,
              padding: "14px 16px", borderRadius: 9, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
              <Dato rotulo="Empresa" valor={(r.dataset && r.dataset.nombre) || "—"}/>
              <Dato rotulo="Período" valor={(p.periodos && p.periodos.actual) || "—"}/>
              <Dato rotulo="Compara contra" valor={(p.periodos && p.periodos.anterior) || "sin período anterior"}/>
              <Dato rotulo="Venta del período" valor={_money(t && t.venta)} tono={C.celeste}/>
              <Dato rotulo="Capital en inventario" valor={_money(t && t.capital)} tono={C.celeste}/>
              <Dato rotulo="Clientes" valor={_n(t && t.clientes)}/>
              <Dato rotulo="SKU" valor={_n(t && t.skus)}/>
              <Dato rotulo="Bodegas" valor={_n(t && t.bodegas)}/>
              <Dato rotulo="Filas de venta" valor={_n(t && t.filasVenta)}/>
              <Dato rotulo="Filas de inventario" valor={_n(t && t.filasInventario)}/>
            </div>

            {/* LA PROCEDENCIA A LA VISTA · «informado manda, calculado rellena» no sirve de nada si el usuario no
                puede ver cuáles cifras son suyas y cuáles las completó ADI. Es la regla hecha pantalla. */}
            {proc && (
              <div data-testid="datos-procedencia" style={{ marginTop: 12, fontFamily: SANS, fontSize: 11.8,
                color: C.textMuted, lineHeight: 1.6 }}>
                Días de inventario: <b style={{ color: C.textSub }}>{proc.dias.informado}</b> informados por ti ·{" "}
                <b style={{ color: C.textSub }}>{proc.dias.calculado}</b> calculados por ADI
                {proc.dias.sinDato > 0 && <> · <b style={{ color: C.amber }}>{proc.dias.sinDato}</b> sin dato suficiente</>}
                {" "}(de {proc.total} SKU).
                {/* EL CAPITAL TAMBIÉN ES CUENTA NUESTRA desde el contrato v1 de Inventario (owner 2026-08-26): la
                    plantilla pide stock FÍSICO y ADI lo valoriza con el costo de la hoja Ventas. Si la pantalla
                    no lo dice, esa cifra se lee como si viniera del sistema del usuario. */}
                {proc.capital && (
                  <><br/>Capital en stock: <b style={{ color: C.textSub }}>{proc.capital.calculado}</b> valorizados por ADI
                    {" "}(stock × costo unitario de tus ventas)
                    {proc.capital.sinDato > 0 && <> · <b style={{ color: C.amber }}>{proc.capital.sinDato}</b> sin venta en el período, no se pueden valorizar</>}.
                  </>
                )}
              </div>
            )}

            {/* ⚠️ DE QUIÉN ES LA VARA · condición del owner para la v1.6: «deja muy claro en preview y en
                respuestas que ADI usa referencia general cuando el cliente no declara una propia. No quiero que
                la referencia general parezca una meta del cliente». Va en un recuadro propio, no en la lista de
                avisos: un límite del que depende cómo se leen TODAS las cifras de margen no puede quedar
                mezclado entre notas menores. */}
            {t && t.referencia && typeof t.referencia.valor === "number" && (
              <div data-testid="datos-referencia" style={{ marginTop: 12, padding: "11px 13px", borderRadius: 8,
                background: t.referencia.procedencia === "informado" ? C.surfaceAlt : "rgba(253,224,71,0.05)",
                border: "1px solid " + (t.referencia.procedencia === "informado" ? C.border : "rgba(253,224,71,0.22)"),
                fontFamily: SANS, fontSize: 11.8, color: C.textSub, lineHeight: 1.6 }}>
                {t.referencia.procedencia === "informado"
                  ? <>Margen de referencia: <b style={{ color: C.text }}>{t.referencia.valor}%</b> — el que declaró tu negocio.</>
                  : <>Margen de referencia: <b style={{ color: C.text }}>{t.referencia.valor}%</b> — es la{" "}
                      <b style={{ color: C.text }}>referencia general de ADI</b>. Tu negocio no declaró una propia,
                      así que <b style={{ color: C.text }}>no es tu meta</b>: es la vara con la que ADI compara
                      cuando no hay otra.</>}
              </div>
            )}

            {/* Lo que se guarda y todavía NO se analiza. Decirlo evita que alguien llene una columna con cuidado
                y después pregunte por ella sin obtener nada. */}
            {t && (t.guardadoSinAnalizar || []).length > 0 && (
              <div data-testid="datos-guardado" style={{ marginTop: 10, fontFamily: SANS, fontSize: 11.5,
                color: C.textMuted, lineHeight: 1.6 }}>
                {t.guardadoSinAnalizar.map((g) => (
                  <div key={g.campo}>Guardé <b style={{ color: C.textSub }}>{g.campo}</b> ({g.distintos} valores en {g.filas} filas), pero todavía no analizo por {g.campo}.</div>
                ))}
              </div>
            )}

            {/* los avisos de forma que no bloquean: parámetros ausentes, ventas sin bodega, etc. */}
            {(p.avisos || []).length > 0 && (
              <ul data-testid="datos-avisos" style={{ margin: "11px 0 0 16px", padding: 0 }}>
                {p.avisos.slice(0, 6).map((a, i) => (
                  <li key={i} style={{ fontFamily: SANS, fontSize: 11.6, color: C.textMuted, lineHeight: 1.6 }}>
                    {a.detalle || a.tipo}
                  </li>
                ))}
              </ul>
            )}

            {/* ── paso 4 · confirmar ─────────────────────────────────────────────────────────────────── */}
            <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* Deshabilitado mientras guarda: dos clicks serían dos activaciones de la misma versión. */}
              <Boton primario testid="datos-activar" onClick={confirmar} disabled={guardando}>
                {guardando ? "Guardando…" : (r.apertura ? "Seguir con estos números" : "Usar estos datos")}
              </Boton>
              <Boton testid="datos-otro" onClick={() => { setEstado("vacio"); setR(null); }}>Subir otro archivo</Boton>
            </div>
            <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 11.3, color: C.textMuted, lineHeight: 1.55 }}>
              {r.apertura
                ? "Al seguir, dejo la observación anotada y la tengo en cuenta cada vez que lea estas cifras."
                : "Tus datos reemplazan al negocio de demostración. Puedes volver al demo cuando quieras."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelDatos;
