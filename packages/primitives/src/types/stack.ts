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

  children?: UltimateNode;
}

/** Anything that can appear as a child of a UltimateJs primitive. */
export type UltimateNode =
  | UltimateElement
  | string
  | number
  | boolean
  | null
  | undefined
  | UltimateNode[];

/** a rendered UltimateJs element (opaque at the type layer). */
export interface UltimateElement {
  readonly __ultimate: true;
}
