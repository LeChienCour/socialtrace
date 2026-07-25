import type { CSSProperties } from "react";

export const CHART_COLORS = {
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  pink: "#ec4899",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

export const chartTooltipStyle: CSSProperties = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "0.8rem",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
};

export const chartGridColor = "var(--border)";
export const chartAxisColor = "var(--muted-foreground)";
