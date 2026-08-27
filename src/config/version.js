/* === src/config/version.js · EL NÚMERO DE VERSIÓN, UNA SOLA VEZ (owner 2026-08-16) ============================
 * EL PROBLEMA QUE RESUELVE, y ya lo pagamos una vez: preguntarle a producción qué versión corre devolvía
 * `b9c552e` — un código que no le dice nada a nadie. Hubo un intento anterior (`v1.0-demo-privada`) que quedó
 * abandonado: producción terminó 533 commits más adelante que su propia etiqueta. El esquema no falló por la
 * idea, falló por no ponerle número a cada despliegue.
 *
 * LA REGLA DEL OWNER, textual: «cada vez que diga "deployalo", el deploy debe salir con número de versión, tag
 * en repo, /api/version actualizado y nota corta». Las cuatro cosas, en el mismo momento — no después.
 *
 * FORMATO: cambios normales suben el segundo número (1.1 · 1.2 · 1.3); un cambio grande sube el primero (2.0).
 * Supabase + carga de archivos ya está reservado como 2.0.
 *
 * ESTE ARCHIVO ES LA ÚNICA FUENTE. `/api/version` lo lee, `_VERSIONES.md` lo documenta y `_version_gate.mjs`
 * verifica que los tres digan lo mismo. Cambiar el número acá sin escribir su nota pone el gate en rojo, que es
 * exactamente la disciplina que faltó la vez pasada. */

/** El número que está declarado en ESTA rama. Ver `_VERSIONES.md` para qué trae y si ya está desplegada. */
export const ADI_VERSION = "2.0";

/** La última versión que de verdad llegó a producción. Se actualiza EN EL MISMO commit del deploy. */
export const ADI_VERSION_DESPLEGADA = "1.15";
