import type { UltimateRenderer } from "@blazefw/primitives";
import { Stack }  from "./Stack.js";
import { Text }   from "./Text.js";
import { Action } from "./Action.js";
import { Input }  from "./Input.js";

/**
 * emailRenderer satisfies UltimateRenderer<string>.
 *
 * Unlike the web/native renderers, TNode is `string` — each function
 * returns a raw HTML fragment rather than a React element.
 */
export const emailRenderer: UltimateRenderer<string> = {
  Stack,
  Text,
  Action,
  Input,
};
