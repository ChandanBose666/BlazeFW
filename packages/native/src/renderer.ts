import type { ReactElement } from "react";
import type { UltimateRenderer } from "@blazefw/primitives";
import { Stack }  from "./Stack.js";
import { Text }   from "./Text.js";
import { Action } from "./Action.js";
import { Input }  from "./Input.js";

export const nativeRenderer: UltimateRenderer<ReactElement> = {
  Stack:  Stack  as UltimateRenderer<ReactElement>["Stack"],
  Text:   Text   as UltimateRenderer<ReactElement>["Text"],
  Action: Action as UltimateRenderer<ReactElement>["Action"],
  Input:  Input  as UltimateRenderer<ReactElement>["Input"],
};
