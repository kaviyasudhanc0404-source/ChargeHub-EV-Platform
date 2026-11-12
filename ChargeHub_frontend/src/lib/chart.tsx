// Shared Recharts styling so every chart matches the theme (and the panel's colour)
export const chartTooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  color: "hsl(var(--foreground))",
  boxShadow: "0 12px 32px -12px rgb(0 0 0 / 0.5)",
};

export const gridProps = { strokeDasharray: "4 6", stroke: "hsl(var(--border))", vertical: false } as const;

export const axisProps = { stroke: "hsl(var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false } as const;

export const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--electric))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];

// Soft fill under area charts: put {areaGradient()} inside the chart and use fill={AREA_FILL}
export const AREA_FILL = "url(#area-fill)";
export const areaGradient = () => (
  <defs>
    <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
    </linearGradient>
  </defs>
);
