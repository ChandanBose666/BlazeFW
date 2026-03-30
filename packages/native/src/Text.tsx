import type { ReactElement } from "react";
import { Text as RNText } from "react-native";
import type { TextProps, TextVariant } from "@blazefw/primitives";
import { resolveColor, FONT_SIZE_DP, FONT_WEIGHT_RN } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static maps hoisted outside the component
// ---------------------------------------------------------------------------

/**
 * Visual style presets per variant.
 * The `as` prop is web-only and has no effect in the native renderer.
 */
const VARIANT_STYLES: Record<TextVariant, {
  fontSize: number;
  fontWeight?: "400" | "500" | "600" | "700";
  fontFamily?: string;
  lineHeight: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  letterSpacing?: number;
}> = {
  body:     { fontSize: 16, lineHeight: 26 },
  caption:  { fontSize: 12, lineHeight: 18 },
  label:    { fontSize: 14, fontWeight: "500", lineHeight: 14 },
  heading:  { fontSize: 24, fontWeight: "600", lineHeight: 30 },
  title:    { fontSize: 20, fontWeight: "600", lineHeight: 26 },
  display:  { fontSize: 36, fontWeight: "700", lineHeight: 45 },
  code:     { fontSize: 14, fontFamily: "monospace", lineHeight: 22 },
  overline: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.5, lineHeight: 14 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Native implementation of the <Text> primitive.
 * Renders as React Native's <Text> component.
 *
 * Note: the `as` prop (HTML element override) is web-only and is ignored here.
 */
export function Text({
  variant = "body",
  size,
  weight,
  color,
  align,
  maxLines,
  underline,
  strikethrough,
  label,
  testId,
  children,
  // `as` is intentionally destructured and discarded — web-only prop
  as: _as,
  // `role` → accessibilityRole on RNText
  role,
  // `aria-hidden` → importantForAccessibility
  "aria-hidden":      ariaHidden,
  // `aria-describedby` / `aria-labelledby` not supported in RN new-arch — silently ignored
  "aria-describedby": _ariaDescribedby,
  "aria-labelledby":  _ariaLabelledby,
}: TextProps): ReactElement {
  const textDecoration =
    underline && strikethrough ? "underline line-through" :
    underline                  ? "underline" :
    strikethrough              ? "line-through" :
    undefined;

  return (
    <RNText
      style={[
        VARIANT_STYLES[variant],
        size !== undefined    ? { fontSize: FONT_SIZE_DP[size] }              : null,
        weight !== undefined  ? { fontWeight: FONT_WEIGHT_RN[weight] }        : null,
        color !== undefined   ? { color: resolveColor(color) }                : null,
        align !== undefined   ? { textAlign: align === "start" ? "left" : align === "end" ? "right" : "center" } : null,
        textDecoration        ? { textDecorationLine: textDecoration as "underline" | "line-through" | "underline line-through" } : null,
      ]}
      numberOfLines={maxLines}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accessibilityRole={role as any}
      accessibilityLabel={label}
      importantForAccessibility={ariaHidden ? "no-hide-descendants" : undefined}
      testID={testId}
    >
      {children}
    </RNText>
  );
}
