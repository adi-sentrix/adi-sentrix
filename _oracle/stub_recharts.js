// Stub de recharts para el oráculo headless · el pipeline de respuesta NO usa gráficos.
// Solo se referencian al renderizar módulos (que el oráculo no abre). Componentes inertes.
const Noop = () => null;
export const LineChart = Noop, Line = Noop, Bar = Noop, XAxis = Noop, YAxis = Noop,
  CartesianGrid = Noop, Tooltip = Noop, ResponsiveContainer = Noop, ReferenceLine = Noop,
  Cell = Noop, ComposedChart = Noop, Area = Noop, BarChart = Noop, PieChart = Noop, Pie = Noop,
  Legend = Noop, AreaChart = Noop;
export default {};
