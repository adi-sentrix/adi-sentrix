// Diff byte · composeModuleOverview MODULAR vs PISO (copia instrumentada · NO la referencia).
// Hipótesis del arquitecto: el composer modular de margen/inventario está reducido (le falta el lead).
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const root = path.dirname(fileURLToPath(import.meta.url));

// 1 · copia instrumentada del monolito con exports (la referencia queda intacta)
const monoSrc = fs.readFileSync(path.join(root, "_REFERENCIA_PISO_41cc33d8.jsx"), "utf8");
const instrPath = path.join(root, "_oracle", "_mono_instr.jsx");
fs.writeFileSync(instrPath, monoSrc + "\nexport { composeModuleOverview as pisoComposeModuleOverview, composeModuleOverviewV2 as pisoComposeModuleOverviewV2 };\n");

// 2 · bundle (composeModuleOverview es puro · react externo · recharts stub)
const bundlePath = path.join(root, "_oracle", "_mono_instr_bundle.mjs");
await esbuild.build({
  entryPoints: [instrPath], bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "warning",
});

const piso = await import(pathToFileURL(bundlePath).href);
const modular = await import(pathToFileURL(path.join(root, "src", "adi", "composers", "overview.js")).href);

const N = (s) => (s || "").replace(/\s+/g, " ").trim();
for (const mod of ["ventas", "margenes", "inventario"]) {
  const m = modular.composeModuleOverview("bonanza", mod);
  const p = piso.pisoComposeModuleOverview("bonanza", mod);
  const v2 = piso.pisoComposeModuleOverviewV2("bonanza", mod);
  const mo = (m && m.opener) || "";
  const po = (p && p.opener) || "";
  const v2o = (v2 && v2.opener) || "";
  console.log("\n══════ " + mod + " ══════");
  console.log("modular composeModuleOverview len:", mo.length);
  console.log("piso    composeModuleOverview len:", po.length, "· ¿idéntico al modular?:", N(mo) === N(po) ? "SÍ ✓" : "NO ✗");
  console.log("piso    composeModuleOverviewV2 len:", v2o.length, "· ¿= modular?:", N(mo) === N(v2o) ? "SÍ" : "no");
  if (N(mo) !== N(po)) {
    console.log("  modular head:", N(mo).slice(0, 80));
    console.log("  piso    head:", N(po).slice(0, 80));
  }
}
