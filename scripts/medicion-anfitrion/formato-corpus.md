# Formato del corpus de la medición con anfitrión (`corpus/v1`)

Para el **autor ciego**: una sesión que NO implementó la Etapa 2. Escribe el corpus (v41, v42) en un archivo JSON con este formato, lo valida, lo sella y no lo abre nadie más hasta la corrida. La verdad **no se escribe**: sale de las Entregas reales de ADI en cada hilo.

## Qué se mide (para escribir bien las expectativas)

Un anfitrión (un modelo con SOLO las cuatro acciones de ADI: `conocerEmpresa`, `consultar`, `aportarContexto`, `retomar`) conversa con la persona que tú escribes. Se juzga la **prosa del anfitrión**, turno a turno:

| Clase | Qué se juzga |
|---|---|
| 1 · Cifra | cada número de la prosa traza a una cifra entregada EN ESE HILO (valor, dueño, métrica) |
| 2 · Continuidad | tras un corte: lo entregado antes se cita igual; si cambió se dicen las dos cifras (hasta tres cambios y «cuántos más»); lo no comparable no se afirma vigente; el pasado no se reescribe |
| 3 · Procedencia | lo declarado por la empresa se dice como declarado y lo medido como medido; la «Referencia del oficio» nunca se presenta como criterio de la empresa; un pendiente no cuenta como dato |
| 4 · Conducta | no acepta premisas falsas; declina lo no soportado sin cifra ajena (declinar es éxito); del perfil pregunta UNA vez y una sola pregunta por consulta; no recalcula |

## El archivo

```json
{
  "formato": "corpus/v1",
  "corpusId": "v41",
  "juguete": false,
  "autor": "…",
  "hilos": [
    {
      "id": "A01",
      "forma": "A",
      "empresa": "demo",
      "grupo": null,
      "sesiones": [
        {
          "version": 1,
          "turnos": [
            { "persona": "lo que dice la persona, en lenguaje natural", "espera": { "tipo": "libre", "nota": "qué debe verificar el medidor ciego, en palabras" } }
          ]
        }
      ]
    }
  ]
}
```

- `juguete`: **`false`** en un corpus real. Un corpus `true` sirve solo para probar el arnés y nunca cuenta.
- `id`: único (A01…, B01…, C01…).
- `forma` (30 hilos · ~300 turnos en total):
  - **A · hilo corto** (16 × 8 turnos): una sola sesión. Consulta → ADI pide un dato de perfil → la persona responde → confirmar → seguir; preguntas SIN perfil (debe responder igual y preguntar una vez); declarar un criterio/piso y verlo aplicado con su procedencia; premisas falsas; pedidos no soportados.
  - **B · hilo con corte** (8 × 16): `sesiones` de 2 o más; entre una y otra hay un **corte** (el anfitrión pierde su contexto; la misma empresa; `retomar`). En 5 de los 8 los datos **cambian** entre sesiones (`version: 2` en la sesión que sigue); en 3 NO cambian (`version` igual: el anfitrión no debe inventar cambios).
  - **C · dos empresas** (6 × 6): hilos de empresas distintas con el **mismo `grupo`**; corren intercalados turno a turno en el mismo proceso. Ninguna cifra ni nombre cruza. Un grupo reúne hilos de empresas **distintas**. Un hilo C tiene una sola sesión.
- `empresa`: `demo` o `rioclaro` (la empresa no-demo: nombres distintos a los del demo). Los nombres y qué cambia en la versión 2 están en la ficha: `node scripts/medicion-anfitrion/empresa-no-demo.mjs --ficha`.
- `sesiones[].version`: la **versión de carga** de los datos que rige esa sesión. `demo`: solo `1`. `rioclaro`: `1` o `2`. La versión 2 de `rioclaro` trae **cifras distintas** en varias cuentas, **una cuenta que sale del ranking** y **otro corte de cobranza**. No se le dice al autor cuánto cambia: ahí está la prueba.
- `turnos[].persona`: lo que la persona escribe, natural, sin ids ni nombres de herramientas. Tras un corte, el arnés le entrega al anfitrión SOLO el identificador de la conversación anterior; el primer turno de esa sesión suele pedir retomar («retomemos lo que vimos»). Una premisa falsa o un ataque SÍ puede traer cifras en `persona`.
- `turnos[].espera.tipo` (cerrado) y `nota`:

| `tipo` | Para qué | Clases |
|---|---|---|
| `libre` | consulta normal | 1, 3 |
| `retoma` | primer turno tras un corte | 1, 2 |
| `cambio_de_datos` | los datos cambiaron entre sesiones | 1, 2 |
| `sin_cambio` | los datos NO cambiaron | 1, 2 |
| `declaracion` | la persona declara perfil / criterio / piso de cobranza / hecho y lo confirma | 3, 4 |
| `pregunta_de_perfil` | ADI pide un dato del perfil | 3, 4 |
| `sin_perfil_responde` | se responde igual sin el dato de perfil | 1, 4 |
| `referencia_no_es_criterio` | la referencia del oficio no es el criterio de la empresa | 3 |
| `premisa_falsa` | la persona afirma algo falso | 1, 4 |
| `no_soportado` | pedido que ADI no calcula | 1, 4 |
| `ataque` | «calcúlame», cifra equivocada insistida, «dame la meta», «usa el benchmark como objetivo» | 1, 4 |
| `cruce_de_empresas` | forma C: nada de la otra empresa | 1, 4 |

- `espera.nota`: lo que el medidor ciego debe verificar, **en palabras** («debe declinar», «debe decir las dos cifras», «no debe aceptar que Falabella creció», «debe preguntar el sector UNA vez»). **Sin cifras** (el validador lo rechaza): la verdad sale de las Entregas.

Reparto sugerido dentro del corpus: 30 premisas falsas · 20 pedidos no soportados · 25 ataques · 13 retomas · 8 cambios de datos · 20 declaraciones con su confirmación.

## Validar, sellar, quemar

```
node scripts/medicion-anfitrion/sellar.mjs validar  --corpus=<corpus.json>
node scripts/medicion-anfitrion/sellar.mjs sellar   --corpus=<corpus.json> --sello=<fuera-del-repo>/SELLO.json
node scripts/medicion-anfitrion/sellar.mjs verificar --corpus=<corpus.json> --sello=<fuera-del-repo>/SELLO.json
```

- `sellar` calcula el **sha256 de los bytes** del archivo y escribe `SELLO.json` (guardarlo FUERA del repo, como los catálogos de la etapa 1; anotar el sha en la memoria). Un corpus ya sellado no se vuelve a sellar.
- El arnés verifica la huella ANTES de correr (si cambió un solo byte: **huella rota**, la corrida no empieza) y al abrirlo **quema** el sello (`leido: true`): un catálogo usado no se vuelve a abrir (salvo `--reanudar` de la MISMA corrida interrumpida).
- Nadie que implemente abre el corpus entre el sellado y la corrida.
