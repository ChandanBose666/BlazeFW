/**
 * Token resolution for the email renderer.
 *
 * Identical contract to @blazefw/web tokens — SpaceValue → CSS px string,
 * ColorValue → CSS color string — but ColorToken resolves via DEFAULT_THEME
 * (no CSS custom properties in email clients).
 */

import type { SpaceValue, ColorValue, ColorToken, FontSize, FontWeight } from "@blazefw/primitives";

// ---------------------------------------------------------------------------
// Default theme — hex strings (no CSS variables in email clients)
// ---------------------------------------------------------------------------

export const DEFAULT_THEME: Record<ColorToken, string> = {
  background:     "#ffffff",
  surface:        "#f8f9fa",
  border:         "#e2e8f0",
  primary:        "#6366f1",
  "primary-fg":   "#ffffff",
  secondary:      "#64748b",
  "secondary-fg": "#ffffff",
  success:        "#22c55e",
  warning:        "#f59e0b",
  danger:         "#ef4444",
  muted:          "#f1f5f9",
  "muted-fg":     "#94a3b8",
};

// ---------------------------------------------------------------------------
// Spacing → CSS px string
// ---------------------------------------------------------------------------

const SPACE_PX: Record<number, string> = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
};

export function resolveSpace(v: SpaceValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return SPACE_PX[v] ?? `${v * 4}px`;
  return v;
}

// ---------------------------------------------------------------------------
// Color → CSS color string
// ---------------------------------------------------------------------------

export function resolveColor(v: ColorValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return DEFAULT_THEME[v as ColorToken] ?? v;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONT_SIZE_PX: Record<FontSize, string> = {
  xs:   "12px",
  sm:   "14px",
  base: "16px",
  lg:   "18px",
  xl:   "20px",
  "2xl": "24px",
  "3xl": "30px",
  "4xl": "36px",
};

export const FONT_WEIGHT_VAL: Record<FontWeight, string> = {
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
};

// ---------------------------------------------------------------------------
// Border radius (limited email client support — included for modern clients)
// ---------------------------------------------------------------------------

export const RADIUS_PX: Record<"none" | "sm" | "md" | "lg" | "full", string> = {
  none: "0px",
  sm:   "4px",
  md:   "6px",
  lg:   "8px",
  full: "9999px",
};
