/**
 * Token resolution utilities for the web renderer.
 *
 * SpaceValue → CSS length string (px)
 * ColorValue → CSS color string (CSS variable or literal)
 * Named scales → CSS string maps
 */

import type { SpaceValue, ColorValue, ColorToken, FontSize, FontWeight, TextAlign } from "@blazefw/primitives";

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/** Maps SpaceScale integers to CSS pixel values (Tailwind 4px unit convention). */
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

/**
 * Resolves a SpaceValue to a CSS length string.
 * - Number (SpaceScale): looked up in the 4px-unit table.
 * - String ("16px", "50%"): passed through unchanged.
 */
export function resolveSpace(v: SpaceValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return SPACE_PX[v] ?? `${v * 4}px`;
  return v;
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** Maps ColorToken names to CSS custom property references. */
const COLOR_TOKEN_VARS: Record<ColorToken, string> = {
  background:     "var(--ultimate-background)",
  surface:        "var(--ultimate-surface)",
  border:         "var(--ultimate-border)",
  primary:        "var(--ultimate-primary)",
  "primary-fg":   "var(--ultimate-primary-fg)",
  secondary:      "var(--ultimate-secondary)",
  "secondary-fg": "var(--ultimate-secondary-fg)",
  success:        "var(--ultimate-success)",
  warning:        "var(--ultimate-warning)",
  danger:         "var(--ultimate-danger)",
  muted:          "var(--ultimate-muted)",
  "muted-fg":     "var(--ultimate-muted-fg)",
};

/**
 * Resolves a ColorValue to a CSS color string.
 * - ColorToken: expanded to a --ultimate-* CSS variable.
 * - Literal (#hex, rgb(), hsl()): passed through unchanged.
 */
export function resolveColor(v: ColorValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return COLOR_TOKEN_VARS[v as ColorToken] ?? v;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONT_SIZE: Record<FontSize, string> = {
  xs:   "0.75rem",
  sm:   "0.875rem",
  base: "1rem",
  lg:   "1.125rem",
  xl:   "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
};

export const FONT_WEIGHT: Record<FontWeight, number> = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
};

export const TEXT_ALIGN: Record<TextAlign, string> = {
  start:  "left",
  center: "center",
  end:    "right",
};

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const RADIUS: Record<"none" | "sm" | "md" | "lg" | "full", string> = {
  none: "0px",
  sm:   "4px",
  md:   "6px",
  lg:   "8px",
  full: "9999px",
};
