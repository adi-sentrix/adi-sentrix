/* === scripts/consolidacion/familias/f5_verificador.mjs · INVARIANTE DE LA FAMILIA 5 · TODA ORACIÓN QUE SE SIRVE PASÓ SU PROPIO VERIFICADOR ═══════════════
 * «Toda oración que compone la Entrega pasa `verificarEntrega`; composer y verificador no se contradicen» (contrato §7.3·48(d) · 51(c));
 * «una oración que el verificador rechaza se retira de la Entrega y se declara el límite» (§7.3·52(e)).
 *
 * LO QUE LEE: la ENTREGA ya servida (`entrega.respuesta`, `entrega.limites`, `entrega.procedencia`) y la RESOLUCIÓN del encargo. EL ORÁCULO ES EL
 * VERIFICADOR: este control corre `verificarEntrega` sobre LO SERVIDO, con el mismo contexto con que lo corre la casa (`resolucion`, el índice del
 * turno, la profundidad) — NO importa `entrega/componer.js:servirConGarantia` ni repite su lógica: si la pieza dejara salir una oración que el
 * verificador rechaza, el control lo ve por el verificador, no por la pieza.
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   verificador-rechaza-lo-servido  `verificarEntrega` da una violación sobre la Entrega servida: nombra la regla del verificador (1…19). Con la
 *                                   pieza cableada, ninguna oración rechazada llega al usuario (se retira) y ninguna violación estructural sale (se declina).
 *   oracion-rechazada-servida       la violación apunta a una oración concreta de la Respuesta (`respuesta[i]`) y esa oración está servida.
 *   retirada-sin-limite             una oración marcada retirada por el verificador (`entrega.verificacion.retiradas`) no tiene su límite declarado en `entrega.limites`. */

export const familia = {
  id: "F5",
  nombre: "toda oración servida pasó su verificador: el composer y el verificador no se contradicen (una oración rechazada se retira y se declara)",
  invariante(ctx) {
    const { entrega, texto, resolucion, base } = ctx;
    const vs = [];
    const v = (regla, detalle) => vs.push({ regla, detalle: String(detalle).slice(0, 360) });
    const indice = (entrega.procedencia && entrega.procedencia.libro && entrega.procedencia.libro.indice) || null;
    const profundidad = resolucion && resolucion.encargo && resolucion.encargo.profundidad === "breve" ? "breve" : "completa";
    let r = null;
    try { r = base.verificar.verificarEntrega({ texto, entrega, resolucion, indice, profundidad }); } catch (e) { v("EXCEPCION-verificador", (e && e.message) || e); return vs; }
    for (const x of r.violaciones) {
      v("verificador-rechaza-lo-servido", `regla «${x.regla}»: ${x.detalle}`);
      const m = /respuesta\[(\d+)\]/.exec(x.detalle || "");
      if (m && (entrega.respuesta || [])[Number(m[1])]) v("oracion-rechazada-servida", `la oración respuesta[${m[1]}] (${x.regla}) está servida: «${String(entrega.respuesta[Number(m[1])].texto || "").slice(0, 120)}»`);
    }
    /* una oración retirada por el verificador se DECLARA: hay un límite con su marca y su texto sale impreso en la Entrega (y la oración retirada no viaja en ninguna parte) */
    const ver = entrega.verificacion;
    if (ver && Array.isArray(ver.retiradas) && ver.retiradas.length) {
      const limitesRetiro = (entrega.limites || []).filter((l) => l && l._retiradaPorVerificador);
      if (!limitesRetiro.length) v("retirada-sin-limite", `${ver.retiradas.length} oración(es) retirada(s) por «${ver.retiradas.map((x) => x.regla).join(", ")}» y ninguna se declara en los límites`);
      for (const l of limitesRetiro) if (!String(texto).includes(`**${l.titulo}.**`)) v("retirada-sin-limite", `el límite de la oración retirada «${String(l.titulo).slice(0, 80)}» no sale impreso en la Entrega`);
    }
    return vs;
  },
};
