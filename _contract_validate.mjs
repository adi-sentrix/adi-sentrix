/* === _contract_validate.mjs · runner del CONTRATO DE DATOS (Paso 3) ===
 * Corre el validador sobre el dataset actual. Uso: node _contract_validate.mjs [demo|ci|prod]
 * · demo (default): observe-first · reporta, no rompe (exit 0).
 * · ci/prod: exit 1 si el dataset es NO-APTO (hay blockers). Para meter en el pipeline. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path";
const root = process.cwd(), out = path.join(root, "_cvb.mjs");
await esbuild.build({ entryPoints: [path.join(root, "src/config/contract/validator.js")], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const V = await import(pathToFileURL(out).href + "?t=" + Math.random());
import fs from "fs"; try { fs.unlinkSync(out); } catch {}

const mode = process.argv[2] || "demo";
const rep = V.validateDataset(mode);
console.log(V.formatReport(rep));
process.exit((mode === "demo") ? 0 : (rep.apt ? 0 : 1));
