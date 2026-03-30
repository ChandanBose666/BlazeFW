import type { ActionProps, ActionVariant, ActionSize } from "@blazefw/primitives";
import { resolveSpace, resolveColor, RADIUS_PX, DEFAULT_THEME } from "./lib/tokens.js";
import { buildStyle, escapeAttr, stringify } from "./lib/html.js";

// ---------------------------------------------------------------------------
// Static style maps
// ---------------------------------------------------------------------------

/**
 * Base inline styles per variant.
 * Email Action always renders as <a> — there is no button element in email.
 */
const VARIANT_STYLES: Record<ActionVariant, Record<string, string>> = {
  primary:   {
    backgroundColor: DEFAULT_THEME.primary,
    color:           DEFAULT_THEME["primary-fg"],
    textDecoration:  "none",
  },
  secondary: {
    backgroundColor: "transparent",
    color:           DEFAULT_THEME.primary,
    border:          `1px solid ${DEFAULT_THEME.border}`,
    textDecoration:  "none",
  },
  ghost:     {
    backgroundColor: "transparent",
    color:           DEFAULT_THEME.primary,
    textDecoration:  "none",
  },
  danger:    {
    backgroundColor: DEFAULT_THEME.danger,
    color:           DEFAULT_THEME["primary-fg"],
    textDecoration:  "none",
  },
  link:      {
    backgroundColor: "transparent",
    color:           DEFAULT_THEME.primary,
    textDecoration:  "underline",
  },
};

const SIZE_STYLES: Record<ActionSize, Record<string, string>> = {
  xs: { fontSize: "12px", padding: "4px 8px",   borderRadius: "4px" },
  sm: { fontSize: "14px", padding: "6px 12px",  borderRadius: "4px" },
  md: { fontSize: "16px", padding: "8px 16px",  borderRadius: "6px" },
  lg: { fontSize: "18px", padding: "12px 24px", borderRadius: "8px" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Email implementation of the <Action> primitive.
 *
 * Always renders as <a href="..."> — buttons have no meaning in email.
 * When no `href` is provided, renders as `href="#"` (a safe no-op link).
 *
 * Interactive props (onPress) are silently ignored — email has no JS runtime.
 * The `loading` state collapses to disabled styling.
 */
export function Action({
  variant = "primary",
  size = "md",
  href = "#",
  external,
  disabled,
  loading,
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
  // onPress, onChange — silently ignored (no JS in email)
  onPress: _onPress,
  // ARIA props — silently ignored in email (interactive semantics have no meaning in email clients)
  role:                     _role,
  "aria-expanded":          _ariaExpanded,
  "aria-pressed":           _ariaPressed,
  "aria-haspopup":          _ariaHaspopup,
  "aria-controls":          _ariaControls,
  "aria-selected":          _ariaSelected,
  "aria-hidden":            _ariaHidden,
  "aria-describedby":       _ariaDescribedby,
  "aria-labelledby":        _ariaLabelledby,
}: ActionProps): string {
  const isDisabled = (disabled ?? false) || (loading ?? false);

  // Padding overrides
  const sizeP = SIZE_STYLES[size].padding;
  let paddingOverride: string | undefined;

  if (padding !== undefined) {
    paddingOverride = resolveSpace(padding);
  } else {
    const px = resolveSpace(paddingX);
    const py = resolveSpace(paddingY);
    if (px !== undefined || py !== undefined) {
      paddingOverride = `${py ?? "8px"} ${px ?? "16px"}`;
    }
  }

  const style = buildStyle({
    display:         fullWidth ? "block" : "inline-block",
    ...VARIANT_STYLES[variant],
    ...(variant !== "link" ? { ...SIZE_STYLES[size], padding: paddingOverride ?? sizeP } : {}),
    ...(radius     !== undefined  && { borderRadius:     RADIUS_PX[radius] }),
    ...(background !== undefined  && { backgroundColor:  resolveColor(background) }),
    ...(color      !== undefined  && { color:            resolveColor(color) }),
    ...(isDisabled && { opacity: "0.5" }),
    // MSO font reset
    fontFamily:   "Arial, sans-serif",
    fontWeight:   "500",
    lineHeight:   "1",
    msoHide:       undefined,
  });

  const target = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  const ariaLabel  = label  ? ` aria-label="${escapeAttr(label)}"` : "";
  const testAttr   = testId ? ` data-testid="${escapeAttr(testId)}"` : "";
  const ariaDisabled = isDisabled ? ' aria-disabled="true"' : "";

  const content = stringify(children);

  return `<a href="${escapeAttr(href)}"${target} style="${style}"${ariaLabel}${ariaDisabled}${testAttr}>${content}</a>`;
}
