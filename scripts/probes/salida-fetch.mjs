/* sonda del cerrojo · INTENTA salir por `fetch`. Bajo el candado tiene que morir con exit 97.
 * Si imprime "ESCAPE" y sale 0, el bloqueo de red está desactivado. No se corre nunca sin el candado puesto. */
await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}" }).catch(() => {});
console.log("ESCAPE · fetch() no fue bloqueado");
process.exit(0);
