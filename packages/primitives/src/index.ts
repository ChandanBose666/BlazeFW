// Core primitive prop types
export type { StackProps, StackDirection, StackAlign, StackJustify, StackRole, BlazeNode, BlazeElement } from "./types/stack.js";
export type { TextProps, TextVariant, TextElement, TextRole } from "./types/text.js";
export type { ActionProps, ActionVariant, ActionSize, ActionRole } from "./types/action.js";
export type { InputProps, InputType, InputVariant } from "./types/input.js";

// Shared token types
export type {
  SpaceScale,
  SpaceValue,
  ColorToken,
  ColorValue,
  FontSize,
  FontWeight,
  TextAlign,
  AriaBaseProps,
  BaseProps,
} from "./types/common.js";

// Renderer contract
export type { BlazeRenderer } from "./types/renderer.js";
