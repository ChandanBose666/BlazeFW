import type { BaseProps, ColorValue, SpaceValue } from "./common.js";
import type { UltimateNode } from "./stack.js";

/**
 * <Action> — the universal interactive primitive.
 *
 * Maps to:
 *   Web    → <button> or <a> (when `href` is provided)
 *   Native → <Pressable> from react-native
 *   Email  → <a> with MSO VML button fallback
 *
 * Design intent: a single primitive covers every interactive affordance.
 * The render target decides the correct native element — the developer
 * never writes `<button>` or `<a>` directly in UltimateJs UI code.
 */

export type ActionVariant =
  | "primary"    // filled, high-emphasis CTA
  | "secondary"  // outlined, medium-emphasis
  | "ghost"      // no background, low-emphasis
  | "danger"     // destructive action
  | "link";      // looks like a hyperlink

export type ActionSize = "xs" | "sm" | "md" | "lg";

export interface ActionProps extends BaseProps {
  /** Visual style. Defaults to "primary". */
  variant?: ActionVariant;

  /** Size preset. Defaults to "md". */
  size?: ActionSize;

  /**
   * Navigation target.
   * When set, the web renderer uses <a href={href}> instead of <button>.
   * Native uses Linking.openURL. Email renders an MSO-safe hyperlink.
   */
  href?: string;

  /** Open link in a new tab / external browser. Only meaningful with `href`. */
  external?: boolean;

  /** Disabled state — prevents interaction and applies muted styling. */
  disabled?: boolean;

  /** Loading state — shows spinner, prevents interaction. */
  loading?: boolean;

  /**
   * Click / press handler.
   * Not serialized into the Email bundle (email has no JS runtime).
   */
  onPress?: () => void;

  /** Background color override. */
  background?: ColorValue;

  /** Text / icon color override. */
  color?: ColorValue;

  /** Padding override. */
  padding?: SpaceValue;
  paddingX?: SpaceValue;
  paddingY?: SpaceValue;

  /** Border radius override. */
  radius?: "none" | "sm" | "md" | "lg" | "full";

  /** Full-width stretch. */
  fullWidth?: boolean;

  children?: UltimateNode;
}
