/**
 * @blazefw/native — Native renderer for UltimateJs semantic UI primitives.
 *
 * Exports four React Native components (Stack, Text, Action, Input) that
 * implement the UltimateRenderer<ReactElement> contract from @blazefw/primitives.
 *
 * Usage:
 *   import { Stack, Text, Action, Input } from "@blazefw/native";
 *   // or import the renderer object:
 *   import { nativeRenderer } from "@blazefw/native";
 */

export { Stack }          from "./Stack.js";
export { Text }           from "./Text.js";
export { Action }         from "./Action.js";
export { Input }          from "./Input.js";
export { nativeRenderer } from "./renderer.js";

// Expose the default theme so apps can read or override token values.
export { DEFAULT_THEME }  from "./lib/tokens.js";
