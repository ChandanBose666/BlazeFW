import type { ReactElement } from "react";
import type { BlazeRenderer } from "@blazefw/primitives";
import { Stack }  from "./Stack.js";
import { Text }   from "./Text.js";
import { Action } from "./Action.js";
import { Input }  from "./Input.js";

export const nativeRenderer: BlazeRenderer<ReactElement> = {
  Stack:  Stack  as BlazeRenderer<ReactElement>["Stack"],
  Text:   Text   as BlazeRenderer<ReactElement>["Text"],
  Action: Action as BlazeRenderer<ReactElement>["Action"],
  Input:  Input  as BlazeRenderer<ReactElement>["Input"],
};
