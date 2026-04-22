import { useState } from "react";
import datosReales from "./datos_reales.json";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// Colors
const C = {
  bg: "#080808",
  surface: "#0d0d0d",
  border: "#2a2a2a",
  text: "#FFFFFF",
  textSub: "#c0c0c0",
  textMuted: "#707070",
  blue: "#00c2e8",
  green: "#10b981",
  red: "#f43f5e",
  amber: "#fbbf24",
};

// Función para formatear números
function formatNumber(num) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Tarjeta de métrica
function MetricCard({ label, value, change, color = C.blue }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: "8px",
      padding: "16px",
      minWidth: "180px",
      transition: "all 0.3s"
    }}>
      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: C.textMuted, textTransform: "uppercase" }}>
        {label}
      </p>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: C.text }}>
        {typeof value === "number" ? formatNumber(value) : value}
      </h3>
      {change && (
        <span style={{ fontSize: "11px", color: change > 0 ? C.green : C.red }}>
          {change > 0 ? "↑" : "↓"} {Math.abs(change)}%
        </span>
      )}
    </div>
  );
}

// Componente principal
export default function ADISentrix() {
  const { resumen, datosClientes, datosProductos } = datosReales;
  const [selectedTab, setSelectedTab] = useState("resumen");

  const COLORES = [C.blue, C.green, C.amber, C.red, "#219ebc"];

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      paddingBottom: "40px"
    }}>
      {/* Styles */}
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px",
        position: "sticky",
        top: "0",
        zIndex: "100"
      }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "700", color: C.blue }}>
            ADI SENTRIX
          </h1>
          <p style={{ margin: "0", fontSize: "13px", color: C.textMuted }}>
            Dashboard analítico en tiempo real
          </p>
        </div>
      </header>

      {/* Contenido principal */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: `1px solid ${C.border}`, paddingBottom: "12px" }}>
          {["resumen", "clientes", "productos"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                padding: "8px 16px",
                background: selectedTab === tab ? `rgba(0, 194, 232, 0.1)` : "transparent",
                border: selectedTab === tab ? `1px solid ${C.blue}` : `1px solid ${C.border}`,
                borderRadius: "6px",
                color: selectedTab === tab ? C.blue : C.textSub,
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s",
                textTransform: "capitalize"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        {selectedTab === "resumen" && (
          <div>
            {/* Métricas principales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              <MetricCard
                label="Ventas Totales"
                value={resumen.ventas_totales}
                change={7.3}
              />
              <MetricCard
                label="Costos Totales"
                value={resumen.costos_totales}
              />
              <MetricCard
                label="Margen Bruto"
                value={resumen.margen_total}
                change={12.1}
                color={C.green}
              />
              <MetricCard
                label="% Margen"
                value={`${resumen.margen_pct}%`}
              />
            </div>

            {/* Gráficos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
              {/* Clientes top */}
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "16px"
              }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                  Top Clientes
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={datosClientes}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="cliente" stroke={C.textMuted} style={{ fontSize: "10px" }} />
                    <YAxis stroke={C.textMuted} style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "6px" }}
                      formatter={(value) => formatNumber(value)}
                    />
                    <Bar dataKey="ventas" fill={C.blue} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Distribución de ventas */}
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "16px"
              }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                  Distribución de Ventas
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={datosClientes} dataKey="ventas" cx="50%" cy="50%" outerRadius={80} label>
                      {datosClientes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {selectedTab === "clientes" && (
          <div>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Detalle de Clientes</h2>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                      Cliente
                    </th>
                    <th style={{ padding: "12px", textAlign: "right", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                      Ventas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datosClientes.map((cliente, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px", fontSize: "13px" }}>{cliente.cliente}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", color: C.blue, fontWeight: "600" }}>
                        {formatNumber(cliente.ventas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {selectedTab === "productos" && (
          <div>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Productos Top 15</h2>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                      Producto
                    </th>
                    <th style={{ padding: "12px", textAlign: "right", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: C.textMuted }}>
                      Ventas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datosProductos.map((prod, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px", fontSize: "13px" }}>{prod.nombre}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", color: C.green, fontWeight: "600" }}>
                        {formatNumber(prod.ventas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        padding: "16px 24px",
        textAlign: "center",
        fontSize: "11px",
        color: C.textMuted
      }}>
        <p style={{ margin: "0" }}>
          ADI SENTRIX © 2025 | Dashboard desarrollado con Claude
        </p>
      </footer>
    </div>
  );
}
