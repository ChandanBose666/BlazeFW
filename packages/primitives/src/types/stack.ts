import type { BaseProps, SpaceValue, ColorValue } from "./common.js";

/**
 * <Stack> — the universal layout primitive.
 *
 * Maps to:
 *   Web    → <div> with flexbox / grid classes
 *   Native → <View> with StyleSheet flex props
 *   Email  → <table> / <td> with inline styles
 */

export type StackDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type StackAlign =
  | "start"
  | "center"
  | "end"
  | "stretch"
  | "baseline";

export type StackJustify =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around"
  | "evenly";

/**
 * ARIA roles appropriate for container and landmark elements.
 */
export type StackRole =
  | "region"
  | "main"
  | "navigation"
  | "complementary"
  | "banner"
  | "contentinfo"
  | "search"
  | "form"
  | "group"
  | "list"
  | "listitem"
  | "grid"
  | "row"
  | "rowgroup"
  | "dialog"
  | "alertdialog"
  | "status"
  | "alert"
  | "log"
  | "feed";

export interface StackProps extends BaseProps {
  /** Layout direction. Defaults to "column". */
  direction?: StackDirection;

  /** Cross-axis alignment (align-items). Defaults to "stretch". */
  align?: StackAlign;

  /** Main-axis justification (justify-content). Defaults to "start". */
  justify?: StackJustify;

  /** Gap between children — mapped to design-token spacing scale. */
  gap?: SpaceValue;

  /** Inner padding applied to all four sides. */
  padding?: SpaceValue;

  /** Inner padding per side — overrides `padding` for that side. */
  paddingX?: SpaceValue;
  paddingY?: SpaceValue;
  paddingTop?: SpaceValue;
  paddingRight?: SpaceValue;
  paddingBottom?: SpaceValue;
  paddingLeft?: SpaceValue;

  /** Background fill. */
  background?: ColorValue;

  /** Border radius token. */
  radius?: "none" | "sm" | "md" | "lg" | "full";

  /** Whether children wrap onto multiple lines. */
  wrap?: boolean;

  /** Flex grow — allows a Stack inside another Stack to fill available space. */
  flex?: number;

  /** ARIA role — promotes the container to a landmark or semantic region. */
  role?: StackRole;

  /**
   * Announce dynamic content changes to screen readers.
   * Use "polite" for non-urgent updates (e.g. search results), "assertive" for urgent alerts.
   */
  "aria-live"?: "off" | "polite" | "assertive";

  /** When true, the entire live region is announced on any change (not just the changed node). */
  "aria-atomic"?: boolean;

  children?: BlazeNode;
}

/**
 * A rendered element of any target (React element on web/native, HTML string
 * on email). Kept structurally open so consumer JSX — `<Stack><Text>…</Text></Stack>`
 * — type-checks against whichever renderer's components are in scope; the
 * renderers cast it to their concrete node type internally.
 */
export type BlazeElement = object;

/** Anything that can appear as a child of a BlazeFW primitive. */
export type BlazeNode =
  | BlazeElement
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly BlazeNode[];
