import type { TextProps, TextVariant, TextElement } from "@blazefw/primitives";
import { resolveColor, FONT_SIZE_PX, FONT_WEIGHT_VAL } from "./lib/tokens.js";
import { buildStyle, escapeAttr, escapeHtml, stringify } from "./lib/html.js";

// ---------------------------------------------------------------------------
// Static maps
// ---------------------------------------------------------------------------

/** MSO-safe inline style presets per variant. */
const VARIANT_STYLES: Record<TextVariant, Record<string, string>> = {
  body:     { fontSize: "16px", lineHeight: "1.6", margin: "0 0 16px 0" },
  caption:  { fontSize: "12px", lineHeight: "1.5", margin: "0 0 8px 0" },
  label:    { fontSize: "14px", fontWeight: "500", lineHeight: "1", margin: "0 0 6px 0" },
  heading:  { fontSize: "24px", fontWeight: "600", lineHeight: "1.25", margin: "0 0 16px 0" },
  title:    { fontSize: "20px", fontWeight: "600", lineHeight: "1.375", margin: "0 0 12px 0" },
  display:  { fontSize: "36px", fontWeight: "700", lineHeight: "1.2", margin: "0 0 24px 0" },
  code:     { fontSize: "14px", fontFamily: "Courier New, monospace", lineHeight: "1.6", margin: "0 0 16px 0" },
  overline: { fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", lineHeight: "1", margin: "0 0 8px 0" },
};

/** Default HTML element per variant (used when `as` is not specified). */
const VARIANT_TAG: Record<TextVariant, TextElement> = {
  body:     "p",
  caption:  "span",
  label:    "span",
  heading:  "h2",
  title:    "h1",
  display:  "h1",
  code:     "pre",
  overline: "span",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Email implementation of the <Text> primitive.
 *
 * Renders as an HTML element with MSO-safe inline styles.
 *
 * maxLines is ignored — CSS line clamping has no email equivalent.
 */
export function Text({
  variant = "body",
  size,
  weight,
  color,
  align,
  underline,
  strikethrough,
  as,
  label,
  testId,
  children,
  // maxLines: no email equivalent
  maxLines: _maxLines,
  // ARIA props — silently ignored in email (HTML element semantics already provide roles)
  role:               _role,
  "aria-hidden":      _ariaHidden,
  "aria-describedby": _ariaDescribedby,
  "aria-labelledby":  _ariaLabelledby,
}: TextProps): string {
  const tag = as ?? VARIANT_TAG[variant];

  const textDecoration =
    underline && strikethrough ? "underline line-through" :
    underline                  ? "underline" :
    strikethrough              ? "line-through" :
    undefined;

  const style = buildStyle({
    ...VARIANT_STYLES[variant],
    ...(size   !== undefined && { fontSize:   FONT_SIZE_PX[size] }),
    ...(weight !== undefined && { fontWeight:  FONT_WEIGHT_VAL[weight] }),
    ...(color  !== undefined && { color:       resolveColor(color) }),
    ...(align  !== undefined && {
      textAlign: align === "start" ? "left" : align === "end" ? "right" : "center",
    }),
    ...(textDecoration && { textDecoration }),
  });

  // Inline tags (span, code) don't get aria-label as HTML attribute
  const isBlock = !["span", "code"].includes(tag);
  const ariaLabel = isBlock && label ? ` aria-label="${escapeAttr(label)}"` : "";
  const testAttr  = testId ? ` data-testid="${testId}"` : "";

  // Children in email context are plain strings — escape them for safety
  const content = typeof children === "string" || typeof children === "number"
    ? escapeHtml(String(children))
    : stringify(children);

  return `<${tag} style="${style}"${ariaLabel}${testAttr}>${content}</${tag}>`;
}
