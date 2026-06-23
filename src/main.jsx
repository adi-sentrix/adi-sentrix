/* === src/main.jsx · entry de la app (Fase 6 · Vite) ===
 * Monta <App/> (ADISentric shell). No toca motor ni shell · solo bootstrap de React. */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";

createRoot(document.getElementById("root")).render(<App />);
