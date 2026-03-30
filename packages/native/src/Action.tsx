import type { ReactElement, ReactNode } from "react";
import { Pressable, Text as RNText, Linking, ActivityIndicator } from "react-native";
import type { ActionProps, ActionVariant, ActionSize } from "@blazefw/primitives";
import { resolveSpace, resolveColor, RADIUS_DP, DEFAULT_THEME } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static style maps hoisted outside the component
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<ActionVariant, {
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
}> = {
  primary:   { backgroundColor: DEFAULT_THEME.primary },
  secondary: { backgroundColor: "transparent", borderColor: DEFAULT_THEME.border, borderWidth: 1 },
  ghost:     { backgroundColor: "transparent" },
  danger:    { backgroundColor: DEFAULT_THEME.danger },
  link:      { backgroundColor: "transparent" },
};

const VARIANT_TEXT_COLOR: Record<ActionVariant, string> = {
  primary:   DEFAULT_THEME["primary-fg"],
  secondary: DEFAULT_THEME.primary,
  ghost:     DEFAULT_THEME.primary,
  danger:    DEFAULT_THEME["primary-fg"],
  link:      DEFAULT_THEME.primary,
};

const SIZE_STYLES: Record<ActionSize, {
  paddingVertical: number;
  paddingHorizontal: number;
  fontSize: number;
  borderRadius: number;
}> = {
  xs: { paddingVertical: 4,  paddingHorizontal: 8,  fontSize: 12, borderRadius: 4 },
  sm: { paddingVertical: 6,  paddingHorizontal: 12, fontSize: 14, borderRadius: 4 },
  md: { paddingVertical: 8,  paddingHorizontal: 16, fontSize: 16, borderRadius: 6 },
  lg: { paddingVertical: 12, paddingHorizontal: 24, fontSize: 18, borderRadius: 8 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Native implementation of the <Action> primitive.
 * Renders as <Pressable> wrapping a <Text>.
 *
 * When `href` is provided, tapping opens the URL via Linking.openURL.
 * The `external` prop is ignored on native — all URLs open in the system browser.
 */
export function Action({
  variant = "primary",
  size = "md",
  href,
  disabled,
  loading,
  onPress,
  background,
  color,
  padding,
  paddingX,
  paddingY,
  radius,
  fullWidth,
  label,
  testId,
  children,
  // `external` is web-only (target="_blank") — ignored on native
  external: _external,
  role,
  "aria-expanded":    ariaExpanded,
  "aria-pressed":     ariaPressed,
  "aria-selected":    ariaSelected,
  // `aria-haspopup` and `aria-controls` have no RN equivalent — silently ignored
  "aria-haspopup":    _ariaHaspopup,
  "aria-controls":    _ariaControls,
  // `aria-hidden` → importantForAccessibility
  "aria-hidden":      ariaHidden,
  // `aria-describedby` / `aria-labelledby` not supported in RN new-arch — silently ignored
  "aria-describedby": _ariaDescribedby,
  "aria-labelledby":  _ariaLabelledby,
}: ActionProps): ReactElement {
  const isInteractive = !(disabled ?? false) && !(loading ?? false);

  const handlePress = isInteractive
    ? () => {
        if (href !== undefined) {
          void Linking.openURL(href);
        } else {
          onPress?.();
        }
      }
    : undefined;

  // Padding overrides
  let pv = SIZE_STYLES[size].paddingVertical;
  let ph = SIZE_STYLES[size].paddingHorizontal;

  if (padding !== undefined) {
    const v = resolveSpace(padding);
    if (v !== undefined) { pv = v; ph = v; }
  }
  if (paddingX !== undefined) { const v = resolveSpace(paddingX); if (v !== undefined) ph = v; }
  if (paddingY !== undefined) { const v = resolveSpace(paddingY); if (v !== undefined) pv = v; }

  const linkVariantStyle = variant === "link"
    ? { paddingVertical: 0, paddingHorizontal: 0 }
    : { paddingVertical: pv, paddingHorizontal: ph };

  const resolvedBg  = background !== undefined ? resolveColor(background) : VARIANT_STYLES[variant].backgroundColor;
  const resolvedColor = color !== undefined ? resolveColor(color) : VARIANT_TEXT_COLOR[variant];

  return (
    <Pressable
      onPress={handlePress}
      disabled={!(isInteractive)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accessibilityRole={(role ?? (href !== undefined ? "link" : "button")) as any}
      accessibilityLabel={label}
      accessibilityState={{
        disabled: disabled ?? false,
        busy:     loading ?? false,
        expanded: ariaExpanded,
        checked:  ariaPressed,
        selected: ariaSelected,
      }}
      importantForAccessibility={ariaHidden ? "no-hide-descendants" : undefined}
      testID={testId}
      style={({ pressed }) => ({
        ...VARIANT_STYLES[variant],
        ...linkVariantStyle,
        backgroundColor: resolvedBg,
        borderRadius: radius !== undefined ? RADIUS_DP[radius] : SIZE_STYLES[size].borderRadius,
        ...(fullWidth && { alignSelf: "stretch" as const }),
        opacity: pressed ? 0.75 : (disabled ?? false) || (loading ?? false) ? 0.5 : 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      })}
    >
      {(loading ?? false) ? (
        <ActivityIndicator
          size="small"
          color={resolvedColor ?? DEFAULT_THEME["primary-fg"]}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <RNText
        style={{
          color:       resolvedColor,
          fontSize:    SIZE_STYLES[size].fontSize,
          fontWeight:  "500",
          ...(variant === "link" && { textDecorationLine: "underline" as const }),
        }}
      >
        {children as ReactNode}
      </RNText>
    </Pressable>
  );
}
