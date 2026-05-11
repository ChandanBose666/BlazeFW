import type { BaseProps, FontSize, FontWeight, TextAlign, ColorValue } from "./common.js";
import type { BlazeNode } from "./stack.js";

/**
 * <Text> — the universal typography primitive.
 *
 * Maps to:
 *   Web    → <p>, <span>, <h1>–<h6> based on `as` prop
 *   Native → <Text> from react-native
 *   Email  → <p> / <td> with inline font styles (MSO-safe)
 */

export type TextVariant =
  | "body"      // default body copy
  | "caption"   // small helper text
  | "label"     // form labels, metadata
  | "heading"   // section headings
  | "title"     // page / card titles
  | "display"   // hero / marketing text
  | "code"      // monospace inline code
  | "overline"; // uppercase tracking label

/** Semantic HTML element override (web only — ignored on other targets). */
export type TextElement = "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "pre" | "code";

/**
 * ARIA roles appropriate for typographic and text elements.
 */
export type TextRole =
  | "heading"
  | "paragraph"
  | "note"
  | "definition"
  | "term"
  | "tooltip"
  | "status"
  | "alert"
  | "log"
  | "marquee"
  | "timer"
  | "code"
  | "emphasis"
  | "strong"
  | "deletion"
  | "insertion"
  | "subscript"
  | "superscript";

export interface TextProps extends BaseProps {
  /** Visual style preset. Targets map each variant to their native equivalent. */
  variant?: TextVariant;

  /** Explicit font size — overrides variant default. */
  size?: FontSize;

  /** Font weight — overrides variant default. */
  weight?: FontWeight;

  /** Text color. */
  color?: ColorValue;

  /** Horizontal alignment. */
  align?: TextAlign;

  /** Maximum number of lines before truncation (Native: numberOfLines). */
  maxLines?: number;

  /** Underline decoration. */
  underline?: boolean;

  /** Strikethrough decoration. */
  strikethrough?: boolean;

  /**
   * Semantic HTML element to render on the web target.
   * Does not affect visual style — use `variant` for that.
   */
  as?: TextElement;

  /** ARIA role override — use when the rendered element does not carry the right semantic. */
  role?: TextRole;

  children?: BlazeNode;
}
