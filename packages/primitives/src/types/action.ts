import type { BaseProps, ColorValue, SpaceValue } from "./common.js";
import type { BlazeNode } from "./stack.js";

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
 * never writes `<button>` or `<a>` directly in BlazeFW UI code.
 */

export type ActionVariant =
  | "primary"    // filled, high-emphasis CTA
  | "secondary"  // outlined, medium-emphasis
  | "ghost"      // no background, low-emphasis
  | "danger"     // destructive action
  | "link";      // looks like a hyperlink

export type ActionSize = "xs" | "sm" | "md" | "lg";

/**
 * ARIA roles that make semantic sense on an interactive action element.
 * The renderer's native element (button/a/Pressable) carries an implicit role;
 * this prop overrides it for custom widget patterns.
 */
export type ActionRole =
  | "button"
  | "link"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "option"
  | "tab"
  | "switch"
  | "checkbox"
  | "radio";
  // "combobox" is intentionally excluded — ARIA 1.2 defines it as a composite
  // container role (requires an <input> descendant), not an interactive widget role.

/** All non-discriminating Action props. Not exported — use ActionProps. */
interface ActionBase extends BaseProps {
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

  /** ARIA role override for custom widget patterns. */
  role?: ActionRole;

  /** Whether a controlled popup (menu, dialog, etc.) is currently expanded. */
  "aria-expanded"?: boolean;

  /** Reflects the pressed state of a toggle button. */
  "aria-pressed"?: boolean | "mixed";

  /** Indicates that this element owns a popup of the given type. */
  "aria-haspopup"?: boolean | "menu" | "listbox" | "tree" | "grid" | "dialog";

  /** ID of the element this action controls or owns. */
  "aria-controls"?: string;

  /** Whether this action is the currently selected item in a set (tabs, options). */
  "aria-selected"?: boolean;
}

/**
 * <Action> prop type.
 *
 * Discriminated union: when `children` is absent, `label` is required to ensure
 * every action has an accessible name. When `children` is present, `label` is
 * optional (acts as an explicit aria-label override).
 *
 * @example Required label when no children:
 *   <Action label="Close dialog" />          // ✓
 *   <Action />                               // ✗ TypeScript error
 *
 * @example Optional label when children present:
 *   <Action>Save changes</Action>            // ✓
 *   <Action label="Save">Save changes</Action>  // ✓ (redundant but valid)
 */
export type ActionProps =
  | (ActionBase & { children: BlazeNode; label?: string })
  | (ActionBase & { children?: never; label: string });
