# ADI Sentric — MVP local

Proyecto Vite + React listo para correr el dashboard `ADISentric`.

## Requisitos

- Node.js 18+ (verifica con `node -v`)
- npm 9+ (incluido con Node)

## Pasos para arrancarlo (Windows / PowerShell)

1. Abre PowerShell en esta carpeta:
   ```powershell
   cd "C:\ruta\a\adi-sentric-app"
   ```
2. Instala dependencias (la primera vez tarda 1–2 minutos):
   ```powershell
   npm install
   ```
3. Arranca el servidor de desarrollo:
   ```powershell
   npm run dev
   ```
4. Vite abrirá automáticamente `http://localhost:5173` en tu navegador.

## Estructura

```
adi-sentric-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx          ← punto de entrada
    └── ADISentric.jsx    ← tu componente (el JSX original)
```

## Comandos útiles

- `npm run dev`     — modo desarrollo con hot-reload
- `npm run build`   — genera la versión de producción en `dist/`
- `npm run preview` — sirve la versión `build` localmente
