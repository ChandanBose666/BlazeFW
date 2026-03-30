/**
 * webRenderer — satisfies the UltimateRenderer<ReactElement> contract.
 *
 * Gives render targets a single object they can pass to a universal
 * component factory, keeping the framework host-agnostic.
 */

import type { ReactElement } from "react";
import type { UltimateRenderer } from "@blazefw/primitives";
import { Stack }  from "./Stack.js";
import { Text }   from "./Text.js";
import { Action } from "./Action.js";
import { Input }  from "./Input.js";

export const webRenderer: UltimateRenderer<ReactElement> = {
  // The primitives' children type (UltimateNode) is structurally opaque;
  // at runtime the web target always passes React elements as children.
  // The cast is safe — no runtime transformation happens.
  Stack:  Stack  as UltimateRenderer<ReactElement>["Stack"],
  Text:   Text   as UltimateRenderer<ReactElement>["Text"],
  Action: Action as UltimateRenderer<ReactElement>["Action"],
  Input:  Input  as UltimateRenderer<ReactElement>["Input"],
};
