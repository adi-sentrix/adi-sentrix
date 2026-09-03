# LA PODA DEL CAMINO NATURAL · plan medido (2026-09-03)

**La palabra del owner:** «No quiero mantener dos ADIs como opción de producto. El agente debe pasar a ser
el camino principal. El viejo puede quedar solo como rollback técnico temporal… cualquier mejora nueva va
al agente.»

**Qué se poda y qué NO.** Se poda EL CAMINO NATURAL (el orquestador `caminoNatural.js` y su cableado).
NO se poda el ORÁCULO (`answerViaOracle` y su mundo): en la cascada el oráculo es la red más profunda y
QUEDA — este plan lo deja explícito porque cambia el tamaño del retiro en un orden de magnitud (ver §3).

Todo lo de abajo está **medido con imports y greps hoy**, no de memoria.

---

## 1 · El inventario: exclusivo vs compartido

**COMPARTIDOS — se quedan (el agente los usa):** los 15 imports directos de `caminoNatural.js` son casi
todos infraestructura de la casa: `guardC`, `datoProyectado`, `entityIndex`, `boleta`, `voiceGuard`,
`fichaIntent`, `narrationBlocks`, `responseContract`, `criteria`, `conversation`, `serieIntent`,
`conversationScope`, `estadoCarga`, `selloEnRespuesta` — y **`cicloNotarial`, que el agente TAMBIÉN usa**
(`bucleAgente.js` lo importa): nada de esto se toca.

**EXCLUSIVOS DEL NATURAL — los candidatos al retiro físico:**
1. `src/adi/oracle/caminoNatural.js` — el orquestador entero.
2. La rama `modoNatural` de `gatewayCore.js` (líneas ~435-474: `payload.modoNatural === true` cambia el
   system y el formato del hilo) — muere la rama, no el archivo.
3. `_fetchNatural` y el bloque `if (ADI_CAMINO_NATURAL)` de `ChatADI.jsx`.
4. El flag `ADI_CAMINO_NATURAL` (flagProfile/voiceFlags) — al final, no al principio (es el rollback).

**⚠️ LA PRE-CONDICIÓN, medida:** `bucleAgente.js:44` importa **`_respaldoDeLoYaAprobado` DESDE
caminoNatural.js** — el respaldo de la escalera del agente vive hoy en el archivo que se quiere retirar.
**Paso 0 obligatorio: extraerlo a un módulo compartido** (p. ej. `src/adi/oracle/respaldo.js`) con su gate
re-apuntado. Sin esto, el retiro físico rompe al agente. (El otro import aparente — `cifraSinBoleta.js` —
es solo un comentario: verificado, no hay dependencia de código.)

**Capacidades que hoy viven pegadas al natural, cada una con su decisión:**
| Capacidad | Dónde vive | Decisión propuesta |
|---|---|---|
| El puente serieIntent (declinar honesto/serie real) | compartido — el agente ya lo corre | nada que hacer ✓ |
| La puerta a la ficha desde texto libre | `fichaIntent` compartido; ChatADI lo aplica a TODO turno | nada que hacer ✓ |
| El suplente digno / cortes de salud (`cortesDelTurno`) | natural | el agente ya registra motivos/vetos equivalentes — se retira con él |
| `bypass sin pago` (`ADI_BYPASS_SIN_PAGO`, hoy APAGADO) | `bypassConfianza.js`, consumido por ChatADI y serieIntent — **no por el natural** | no muere con esta poda; queda como está |
| El molde «sigue verificado y en pie» | vivo SOLO para el natural (condición vieja del owner) | muere con el natural — y el check del gate de consistencia que lo protegía se retira con él |

---

## 2 · Los gates: cuáles mueren, cuáles se re-apuntan — el número real

**La cifra que importa: los gates que inyectan `callPlan`/`callNarrate` son 81 — y NO mueren con esta
poda.** Son del ORÁCULO, que queda como red final. El miedo a «~90 gates muertos» era del retiro del
oráculo, que NO es este plan.

**Los del natural son 6 archivos** (medidos por `answerViaNatural`/`callNatural`/`modoNatural`):
| Gate | Qué hace | Destino |
|---|---|---|
| `_camino_natural_conexion_gate` | el cableado del natural | **muere** con el retiro físico |
| `_alcance_heredado_natural_gate` | conducta del natural | **muere** (su conducta vive en el agente, certificada) |
| `_ficha_texto_libre_gate` | la puerta a la ficha vía natural | **se re-apunta** al camino del agente (la ficha es compartida) |
| `_serie_puente_gate` | el puente (espía sobre el natural) | **se re-apunta**: el puente vive en el bucle del agente; §7 (el sujeto sagrado) ya es del módulo compartido |
| `_consistencia_conversacional_gate` §6 | el molde byte-idéntico DEL NATURAL | **se retira ese check** (el molde muere con su dueño) |
| `_cascada_resiliencia_gate` | la red agente→natural→oráculo | **se re-apunta** en el paso 2: agente→oráculo directo (queda de DOS peldaños) |
| (+ `_consola_examen.mjs` — herramienta, no gate) | tiene la rama natural | se le quita la rama |

También: la rama `modoNatural` de los gates del gateway (si alguno la pina) y `_certificacion_congelada_gate`
NO se toca (corre por el agente). La suite baja ~2 gates y se re-apuntan ~4 — **una tarde de trabajo, no
una semana**: el patrón de re-apuntado ya se ejecutó seis veces en este proyecto.

---

## 3 · El orden seguro

**Paso 0 · La pre-condición (antes de todo):** extraer `_respaldoDeLoYaAprobado` a módulo compartido.
Suite verde. *(Riesgo: cero — es mover una función con su gate.)*

**Paso 1 · La cascada deja de caer al natural (reversible en una línea):** `ADI_CAMINO_NATURAL` sale de
FEATURE → el bloque de ChatADI no corre y la cascada queda `agente → oráculo`. El natural sigue EN el
código, intocado: **ese es el rollback técnico temporal del owner** — re-encenderlo es devolver una línea.
`_cascada_resiliencia_gate` se re-apunta a la cascada de dos peldaños (caída 1 = el agente lanza → oráculo).
**Una semana de uso real así.** El humo (`_humo.mjs`) como semáforo.

**Paso 2 · El retiro físico (tras la semana verde):** borrar `caminoNatural.js`, la rama `modoNatural` del
gateway, `_fetchNatural` + el bloque de ChatADI, y el flag. Morir/re-apuntar los 6 gates de la tabla.
Suite verde al cierre.

**Paso 3 · El candado anti-resurrección** (el patrón de La Poda anterior — `_poda_anti_resurreccion_gate`
ya existe como precedente): un gate que barre `src/` y arde si alguien re-importa `caminoNatural`, recrea
`modoNatural` en el gateway, o re-declara `ADI_CAMINO_NATURAL` — con carnada (plantar el import → ROJO).
Lo muerto no vuelve por accidente.

---

## 4 · Riesgos nombrados

1. **La primera red pasa a ser el oráculo, que responde peor que el natural** (sin playbooks ni escalera).
   Aceptable y ya probado: la caída doble del gate de cascada demuestra que el turno llega vivo; la
   certificación 28/28 demuestra que el agente casi nunca cae. El riesgo real es una semana rara del
   gateway del agente → por eso el paso 1 es reversible en una línea.
2. **La dependencia oculta** (`_respaldoDeLoYaAprobado`) — cerrada como paso 0. Si el barrido del paso 2
   encuentra OTRA, se frena y se trae (el patrón de siempre).
3. **El molde del natural** («sigue verificado y en pie») tiene un check que exige que SIGA VIVO para el
   natural — hay que retirar el check EN el mismo commit del retiro o la suite arde al revés.
4. **Los 81 gates del oráculo NO se tocan** — si alguien confunde esta poda con «retirar el viejo entero»
   y borra el oráculo, se queda sin red final Y sin 81 gates. El oráculo se discute otro día, con su
   propio plan.

---

## 5 · El cierre — por qué esto no puede esperar mucho

**El costo de mantener dos ADIs ya lo pagamos dos veces, medido:** la *quinta fuente* (el juez del turno
que no leyó tuvo que ACOTARSE al agente porque aplicarlo al natural lo apagaba entero — dos conductas
distintas para el mismo defecto) y el *sujeto sustituido* (el arreglo llegó al natural por import
compartido, pero la CONDUCTA del turno alrededor era distinta en cada camino y hubo que verificarla dos
veces). Cada defecto futuro cuesta doble mientras haya dos caminos; cada certificación, doble; cada
playbook nuevo, doble o desigual.

**Checklist ejecutable — LA PODA SE EJECUTÓ EL 2026-09-05** (la palabra del owner: «poda inmediata» tras el
pulido del anclaje; la semana de uso del paso 1 la eliminó él mismo — pasos 1+2 fueron al mismo commit, y por
eso el rollback es UNO: `git revert` del commit del retiro):
- [x] 0 · extraer `_respaldoDeLoYaAprobado` → módulo compartido · suite verde — HECHO 2026-09-03 (`respaldoAprobado.js`, extracción verbatim verificada contra HEAD; natural y agente importan del mismo módulo; candado de una-fuente en _examen4_cierres_gate)
- [x] 1+2 · retiro físico COMPLETO — HECHO 2026-09-05 (commit «feat(poda): LA PODA»): caminoNatural.js ·
      naturalPrompt.js (solo lo importaban el orquestador y la rama) · rama modoNatural del gateway (freno
      TIPADO para callers viejos) y de los DOS adapters · _fetchNatural/bloque ChatADI · flag fuera de
      FEATURE y de voiceFlags · 2 gates muertos · re-apuntados: cascada (dos peldaños con carnada), puente
      (por el bucle del agente), ficha de texto libre, sello (cableado del agente), examen4 (respaldo y
      `ultimaAprobada` del agente), telemetría/razonamiento (el stop del agente, que el gateway tiraba),
      consola solo-agente, probe A2.e. Suite 230·0 · build verde · bundle sin rastros.
      **Dos conductas re-cableadas que el retiro destapó:** la puerta a la ficha desde texto libre
      (`detectFichaIntent` quedaba huérfano — el plan lo daba por compartido y su único caller era el
      orquestador) ahora la adjunta el bucle del agente; y el `stop` del proveedor en el canal del agente,
      que el adapter devolvía y el gateway tiraba.
- [x] 3 · `_poda_natural_anti_resurreccion_gate` — HECHO 2026-09-05, 20/20 con la carnada ejecutada de punta
      a punta (import plantado → 19/20 ROJO → restaurado → 20/20). Suite final: 231·0.
- [x] §7 de CLAUDE.md reescrito el mismo día, como estaba previsto.
- Falcon (`numberGuard.js` · `entityGuard.js` · `_guard_gate.mjs`) NI SE ROZÓ. Pendiente menor anotado: la
  rama sin-señal de `respaldoAprobado.js` (el molde «sigue verificado y en pie») quedó sin caller — se
  conserva como contrato de la función; retirarla es una decisión aparte.
