import type { ReactElement, CSSProperties } from "react";
import type { TextProps, TextVariant, TextElement } from "@blazefw/primitives";
import { resolveColor, FONT_SIZE, FONT_WEIGHT, TEXT_ALIGN } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static maps hoisted outside the component (rendering-hoist-jsx)
// ---------------------------------------------------------------------------

/** Visual style presets per variant — applied first, overridable by size/weight props. */
const VARIANT_STYLES: Record<TextVariant, CSSProperties> = {
  body:     { fontSize: "1rem",    lineHeight: "1.625" },
  caption:  { fontSize: "0.75rem", lineHeight: "1.5" },
  label:    { fontSize: "0.875rem", fontWeight: 500, lineHeight: "1" },
  heading:  { fontSize: "1.5rem",  fontWeight: 600, lineHeight: "1.25" },
  title:    { fontSize: "1.25rem", fontWeight: 600, lineHeight: "1.375" },
  display:  { fontSize: "2.25rem", fontWeight: 700, lineHeight: "1.25" },
  code:     { fontSize: "0.875rem", fontFamily: "monospace", lineHeight: "1.625" },
  overline: {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    lineHeight: "1",
  },
};

/**
 * Default semantic HTML element per variant.
 * The `as` prop overrides this without affecting visual style.
 */
const VARIANT_TAG: Record<TextVariant, TextElement> = {
  body:     "p",
  caption:  "span",
  label:    "span",
  heading:  "h2",
  title:    "h1",
  display:  "h1",
  code:     "code",
  overline: "span",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Web implementation of the <Text> primitive.
 *
 * Variant controls visual style preset; `as` controls the rendered HTML tag.
 * Both are independent — a "heading" variant can render as an <h3> if needed.
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
  as,
  label,
  testId,
  children,
  role,
  "aria-hidden":      ariaHidden,
  "aria-describedby": ariaDescribedby,
  "aria-labelledby":  ariaLabelledby,
}: TextProps): ReactElement {
  const Tag = as ?? VARIANT_TAG[variant];

  const style: CSSProperties = {
    // Apply variant preset first
    ...VARIANT_STYLES[variant],
    // Explicit props override variant defaults
    ...(size !== undefined && { fontSize: FONT_SIZE[size] }),
    ...(weight !== undefined && { fontWeight: FONT_WEIGHT[weight] }),
    ...(color !== undefined && { color: resolveColor(color) }),
    ...(align !== undefined && { textAlign: TEXT_ALIGN[align] as CSSProperties["textAlign"] }),
    // Text decoration
    ...(underline && { textDecoration: "underline" }),
    ...(strikethrough && {
      textDecoration: underline ? "underline line-through" : "line-through",
    }),
    // Multi-line truncation via -webkit-line-clamp
    ...(maxLines !== undefined && {
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: maxLines,
      WebkitBoxOrient: "vertical",
    }),
  };

  return (
    <Tag
      style={style}
      role={role}
      aria-label={label}
      aria-hidden={ariaHidden}
      aria-describedby={ariaDescribedby}
      aria-labelledby={ariaLabelledby}
      data-testid={testId}
    >
      {children}
    </Tag>
  );
}
