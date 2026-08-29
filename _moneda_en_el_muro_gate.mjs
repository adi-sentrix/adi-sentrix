/* === _moneda_en_el_muro_gate.mjs · EL MURO NO SUPONE PESOS (owner 2026-08-27, autorizado) ==============
 *
 * QUÉ VIGILA, y es la parte peligrosa del ajuste de moneda. La orden era de formato —«no quiero que ADI asuma
 * CLP ni USD»— pero el supuesto no vivía en la pantalla: vivía en la CAPA DE VERIFICACIÓN.
 *
 *   · `boleta.parseFigures` extraía una cifra de dinero con `/\$…/`. Con un negocio en euros, «€4.1M» no se
 *     extraía, y lo que no se extrae NO SE VERIFICA: una cifra inventada en esa moneda pasaba entera.
 *   · `guardC._reFor` reconocía el valor de una columna sellada con el mismo literal. Sin «$», la secuencia
 *     quedaba vacía y el chequeo del orden se SALTABA — el propio comentario del archivo ya describía esa
 *     forma de falso negativo para el caso de «pp».
 *
 * Ninguna de las dos fallaba: se volvían ciegas. Un muro que deja de mirar es peor que uno que rechaza mal,
 * porque el rechazo se ve y la ceguera no.
 *
 * ⚠️ Y LA ASIMETRÍA ENTRE LAS DOS ES LO QUE MÁS IMPORTA ACÁ, porque es donde estaría el error fácil: en
 * `guardC` el símbolo puede ser OPCIONAL —el nombre de la columna ya dijo que la cifra es dinero, y los
 * porcentajes y los «pp» se desviaron antes—, pero en `parseFigures` NO PUEDE SERLO: mira texto libre, y un
 * patrón sin símbolo convertiría en monto todo número suelto, incluidos los años y los conteos. La sección 4
 * existe para que nadie «unifique» las dos por prolijidad.
 *
 * OFFLINE · módulos puros · no puede gastar. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { parseFigures } from "./src/adi/boleta.js";
import { simboloMoneda, patronMonto, numeroDelMonto, monedaDelNegocio, fmtMonto } from "./src/config/moneda.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

/** Pone un negocio con la moneda que se le diga (o sin ninguna) y lo activa como tenant. */
const conMoneda = (moneda) => {
  const perfil = { ...(TENANT_DEMO.perfil || {}) };
  if (moneda) perfil.moneda = moneda; else delete perfil.moneda;
  initTenant({ ...TENANT_DEMO, id: "prueba-moneda", perfil });
};

const montosDe = (texto) => parseFigures(texto).filter((f) => f.unit === "money");

console.log("\n" + "=".repeat(100));
console.log("1 · EL SÍMBOLO SALE DE LO DECLARADO, Y SIN DECLARAR NO HAY SÍMBOLO");
console.log("=".repeat(100));
{
  conMoneda(null);
  ok(monedaDelNegocio() === null, "un negocio sin moneda declarada devuelve null, no un valor cómodo");
  ok(simboloMoneda() === "", "…y no se le pone símbolo: suponerlo es lo que la orden prohíbe");
  ok(fmtMonto(4100000, { compacto: true }) === "4,1M", `…el monto sale sin símbolo: ${fmtMonto(4100000, { compacto: true })}`);

  conMoneda("CLP");
  ok(simboloMoneda() === "$", `CLP escribe «$»: ${simboloMoneda()}`);
  conMoneda("USD");
  ok(simboloMoneda() === "US$", `USD escribe «US$»: ${simboloMoneda()}`);
  conMoneda("EUR");
  ok(simboloMoneda() === "€", `EUR escribe «€»: ${simboloMoneda()}`);

  /* Una moneda que no conocemos se rotula con su CÓDIGO. Prestarle el «$» a una moneda cualquiera es la misma
   * afirmación falsa, solo que más difícil de notar. */
  conMoneda("XYZ");
  ok(simboloMoneda().trim() === "XYZ", `una moneda desconocida usa su código, nunca un «$» prestado: ${simboloMoneda()}`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · LA BOLETA VE EL DINERO EN LA MONEDA DEL NEGOCIO");
console.log("=".repeat(100));
{
  conMoneda("EUR");
  const f = montosDe("Falabella aporta €4.1M de contribución.");
  ok(f.length === 1, `«€4.1M» se extrae como cifra de dinero (encontradas: ${f.length})`);
  ok(f[0] && Math.round(f[0].raw) === 4100000, `…y con su valor correcto: ${f[0] && f[0].raw}`);

  /* «$» se sigue aceptando siempre: el negocio de demostración y todo lo ya escrito lo usan. */
  ok(montosDe("Falabella aporta $4.1M.").length === 1, "…y «$» se sigue reconociendo, no se rompe lo anterior");

  conMoneda("USD");
  const u = montosDe("El capital en stock es US$135K.");
  ok(u.length === 1 && u[0].raw === 135000, `«US$135K» se extrae entero, sin cortar en el «$»: ${u[0] && u[0].raw}`);
}

console.log("\n" + "=".repeat(100));
console.log("3 · LA CARNADA · el muro sigue cazando una cifra inventada en euros");
console.log("=".repeat(100));
{
  /* Esto es lo que el owner autorizó y lo que hay que demostrar: que extender el patrón no aflojó el muro.
   * `parseFigures` es lo que alimenta el «no inventa»: si la cifra no se extrae, nadie la compara contra la
   * boleta y pasa sola. Se comprueba que la cifra inventada SÍ aparece para ser comparada. */
  conMoneda("EUR");
  const inventada = montosDe("Falabella aporta €9.9M, muy por encima de lo esperado.");
  ok(inventada.length === 1 && Math.round(inventada[0].raw) === 9900000,
    "⚠️ una cifra INVENTADA en euros se extrae y por lo tanto se puede verificar — antes era invisible");

  /* Y el reverso, que es lo que hace útil a la carnada: ANTES de este cambio no se veía. Se reproduce el
   * patrón viejo para comprobar que el defecto era real y no una historia. */
  const patronViejo = /(-?)\$\s?(\d[\d.,]*\d|\d)\s?([KMB])?/gi;
  ok(!patronViejo.test("Falabella aporta €9.9M"),
    "…y el patrón anterior NO la veía: el agujero que se cerró existía de verdad");

  /* Que el número siga saliendo bien en las dos escalas y con signo. */
  conMoneda("EUR");
  const neg = montosDe("La caída fue de -€6K en el trimestre.");
  ok(neg.length === 1 && neg[0].raw === -6000, `el signo negativo se conserva: ${neg[0] && neg[0].raw}`);
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA ASIMETRÍA · en texto libre el símbolo NO puede ser opcional");
console.log("=".repeat(100));
{
  /* ⚠️ ESTE ES EL CHEQUEO QUE IMPIDE LA «PROLIJIDAD» PELIGROSA. Si alguien hiciera opcional el símbolo en
   * `parseFigures` —para que un pack sin moneda también se verifique— todo número suelto pasaría a ser un
   * monto: los años, los conteos de clientes, los códigos. El remedio sería peor que la falla. */
  conMoneda("EUR");
  const sueltos = montosDe("En 2026 fueron 13 clientes y 6 SKU, con 22% de margen.");
  ok(sueltos.length === 0,
    `ningún número suelto se toma por dinero (encontrados: ${sueltos.length})`,
    JSON.stringify(sueltos.map((x) => x.text)));

  ok(montosDe("El margen fue 22% y la brecha 8.6pp.").length === 0,
    "…ni un porcentaje ni unos puntos porcentuales");

  /* En cambio en `guardC` el símbolo SÍ es opcional, y ahí es seguro: quien llama ya decidió que la columna es
   * dinero. Se ejerce el patrón directamente. */
  conMoneda(null);
  ok(patronMonto().test("4.1M"), "en cambio el patrón del orden sellado SÍ acepta un monto sin símbolo…");
  ok(Math.round(numeroDelMonto("4.1M")) === 4100000, `…y lo sabe leer: ${numeroDelMonto("4.1M")}`);
  conMoneda("EUR");
  ok(patronMonto().test("€4.1M") && Math.round(numeroDelMonto("€4.1M")) === 4100000, "…y también con el símbolo declarado");
  ok(numeroDelMonto("US$135K") === 135000, `…y con un símbolo de dos caracteres: ${numeroDelMonto("US$135K")}`);
}

console.log("\n" + "=".repeat(100));
console.log("5 · LA BOLETA Y EL TEXTO ESCRIBEN IGUAL · si divergen, el muro veta lo correcto");
console.log("=".repeat(100));
{
  /* El valor que la boleta guarda tiene que ser el MISMO string que el texto repite. Si el formateador canónico
   * de la boleta pusiera «$» y la narración «€», el notario dejaría de reconciliarlas y empezaría a rechazar
   * cifras correctas — un falso positivo caro, con reintento pagado. */
  for (const m of ["CLP", "USD", "EUR", null]) {
    conMoneda(m);
    const s = simboloMoneda();
    const enTexto = `${s}4.1M`;
    const vistos = montosDe(`Aporta ${enTexto} de contribución.`);
    if (m === null) {
      ok(vistos.length === 0, "sin moneda declarada no hay símbolo, y entonces la cifra no se puede verificar en texto libre — limitación declarada, no disimulada");
    } else {
      ok(vistos.length === 1 && Math.round(vistos[0].raw) === 4100000,
        `con ${m}, lo que se escribe («${enTexto}») es exactamente lo que el muro lee`);
    }
  }
  initTenant(TENANT_DEMO);   // se devuelve el store a su estado, para no contaminar a nadie
}

console.log(`\n── _moneda_en_el_muro_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
