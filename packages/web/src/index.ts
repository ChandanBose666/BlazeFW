/**
 * @ultimatejs/web — Web renderer for UltimateJs semantic UI primitives.
 *
 * Exports four React components (Stack, Text, Action, Input) that implement
 * the UltimateRenderer<ReactElement> contract defined in @ultimatejs/primitives.
 *
 * Usage:
 *   import { Stack, Text, Action, Input } from "@ultimatejs/web";
 *   // or import the renderer object:
 *   import { webRenderer } from "@ultimatejs/web";
 */

export { Stack }  from "./Stack.js";
export { Text }   from "./Text.js";
export { Action } from "./Action.js";
export { Input }  from "./Input.js";

// Re-export the renderer object that satisfies UltimateRenderer<ReactElement>.
export { webRenderer } from "./renderer.js";
