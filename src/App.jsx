import { useState, useEffect } from "react";
import ADISentrix from "./ADISentrix.jsx";

const CREDENTIALS = {
  usuario: "admin",
  contraseña: "123456"
};

const LoginScreen = ({ onLogin }) => {
  const [usuario, setUsuario] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    // Simulamos delay de red
    setTimeout(() => {
      if (usuario === CREDENTIALS.usuario && contraseña === CREDENTIALS.contraseña) {
        localStorage.setItem("adi_autenticado", "true");
        onLogin();
      } else {
        setError("Usuario o contraseña incorrectos");
      }
      setCargando(false);
    }, 500);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Logo/Header */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <h1 style={{
          fontSize: "48px",
          fontWeight: "700",
          color: "#00c2e8",
          margin: "0 0 10px 0",
          letterSpacing: "-1px"
        }}>
          ADI SENTRIX
        </h1>
        <p style={{
          fontSize: "14px",
          color: "#9ca3af",
          margin: "0",
          fontWeight: "500"
        }}>
          Dashboard de Análisis
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleLogin} style={{
        background: "#0d0d0d",
        border: "1px solid #2a2a2a",
        borderRadius: "12px",
        padding: "40px",
        width: "100%",
        maxWidth: "380px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)"
      }}>
        {/* Input Usuario */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            color: "#c0c0c0",
            fontWeight: "500"
          }}>
            Usuario
          </label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="admin"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #3d3d3d",
              borderRadius: "8px",
              background: "#0f0f0f",
              color: "#ffffff",
              fontSize: "14px",
              boxSizing: "border-box",
              transition: "all 0.3s",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#00c2e8"}
            onBlur={(e) => e.target.style.borderColor = "#3d3d3d"}
          />
        </div>

        {/* Input Contraseña */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            color: "#c0c0c0",
            fontWeight: "500"
          }}>
            Contraseña
          </label>
          <input
            type="password"
            value={contraseña}
            onChange={(e) => setContraseña(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #3d3d3d",
              borderRadius: "8px",
              background: "#0f0f0f",
              color: "#ffffff",
              fontSize: "14px",
              boxSizing: "border-box",
              transition: "all 0.3s",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#00c2e8"}
            onBlur={(e) => e.target.style.borderColor = "#3d3d3d"}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#1f1016",
            border: "1px solid #5e3a3d",
            borderRadius: "6px",
            padding: "10px 12px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#ff6b6b"
          }}>
            {error}
          </div>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={cargando}
          style={{
            width: "100%",
            padding: "12px",
            background: cargando ? "#0e6078" : "#00c2e8",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: cargando ? "not-allowed" : "pointer",
            transition: "all 0.3s",
            opacity: cargando ? 0.7 : 1
          }}
          onMouseEnter={(e) => !cargando && (e.target.style.background = "#00b3d4")}
          onMouseLeave={(e) => !cargando && (e.target.style.background = "#00c2e8")}
        >
          {cargando ? "Autenticando..." : "Ingresar"}
        </button>
      </form>

      {/* Info */}
      <div style={{
        marginTop: "40px",
        textAlign: "center",
        fontSize: "12px",
        color: "#707070"
      }}>
        <p style={{ margin: "0 0 10px 0" }}>Para demostración:</p>
        <p style={{ margin: "0", fontFamily: "monospace" }}>
          <span style={{ color: "#10b981" }}>admin</span> / <span style={{ color: "#f43f5e" }}>123456</span>
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Verificar si ya está autenticado (persiste entre recargas)
    const token = localStorage.getItem("adi_autenticado");
    if (token === "true") {
      setAutenticado(true);
    }
    setCargando(false);
  }, []);

  if (cargando) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#080808"
      }}>
        <div style={{ color: "#00c2e8", fontSize: "18px" }}>Cargando...</div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("adi_autenticado");
    setAutenticado(false);
  };

  if (!autenticado) {
    return <LoginScreen onLogin={() => setAutenticado(true)} />;
  }

  return (
    <div style={{ position: "relative" }}>
      <ADISentrix />
      {/* Botón de logout en esquina superior derecha */}
      <button
        onClick={handleLogout}
        style={{
          position: "fixed",
          top: "16px",
          right: "16px",
          padding: "8px 16px",
          background: "#f43f5e",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 4px 12px rgba(244, 63, 94, 0.3)",
          transition: "all 0.3s"
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "#e63946";
          e.target.style.boxShadow = "0 6px 16px rgba(244, 63, 94, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "#f43f5e";
          e.target.style.boxShadow = "0 4px 12px rgba(244, 63, 94, 0.3)";
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
