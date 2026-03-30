/**
 * Token resolution utilities for the native renderer.
 *
 * Key differences from the web renderer:
 *   - SpaceValue   → unitless dp number (React Native layout unit)
 *   - ColorValue   → hex/rgb string; ColorTokens resolved via DEFAULT_THEME
 *   - No CSS custom properties — React Native has no CSS variable support
 */

import type { SpaceValue, ColorValue, ColorToken, FontSize, FontWeight } from "@blazefw/primitives";

// ---------------------------------------------------------------------------
// Default theme
// Provides fallback colors when ColorToken values are used.
// Future: replace with a React Context-based theme system.
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
// Spacing — dp (density-independent pixels, React Native's layout unit)
// Follows Tailwind's 4dp-per-unit convention to stay consistent with @blazefw/web.
// ---------------------------------------------------------------------------

const SPACE_DP: Record<number, number> = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
};

/**
 * Resolves a SpaceValue to a dp number.
 * - SpaceScale number → looked up in the 4dp table.
 * - "16px" string → parsed to 16 (pixels ≈ dp on 1x screens).
 * - Percentage strings are not supported in RN spacing — returns undefined.
 */
export function resolveSpace(v: SpaceValue | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return SPACE_DP[v] ?? v * 4;
  if (v.endsWith("px")) return parseFloat(v);
  return undefined; // "50%" — not applicable to RN spacing props
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * Resolves a ColorValue to a React Native–compatible color string.
 * - ColorToken → looked up in DEFAULT_THEME.
 * - Literal hex / rgb() / hsl() → passed through (all supported by RN).
 */
export function resolveColor(v: ColorValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return DEFAULT_THEME[v as ColorToken] ?? v;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONT_SIZE_DP: Record<FontSize, number> = {
  xs:   12,
  sm:   14,
  base: 16,
  lg:   18,
  xl:   20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

/** React Native fontWeight must be a quoted string. */
export const FONT_WEIGHT_RN: Record<FontWeight, "400" | "500" | "600" | "700"> = {
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
};

// ---------------------------------------------------------------------------
// Border radius (dp)
// ---------------------------------------------------------------------------

export const RADIUS_DP: Record<"none" | "sm" | "md" | "lg" | "full", number> = {
  none: 0,
  sm:   4,
  md:   6,
  lg:   8,
  full: 9999,
};
