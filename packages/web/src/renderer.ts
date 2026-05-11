/**
 * webRenderer — satisfies the BlazeRenderer<ReactElement> contract.
 *
 * Gives render targets a single object they can pass to a universal
 * component factory, keeping the framework host-agnostic.
 */

import type { ReactElement } from "react";
import type { BlazeRenderer } from "@blazefw/primitives";
import { Stack }  from "./Stack.js";
import { Text }   from "./Text.js";
import { Action } from "./Action.js";
import { Input }  from "./Input.js";

export const webRenderer: BlazeRenderer<ReactElement> = {
  // The primitives' children type (BlazeNode) is structurally opaque;
  // at runtime the web target always passes React elements as children.
  // The cast is safe — no runtime transformation happens.
  Stack:  Stack  as BlazeRenderer<ReactElement>["Stack"],
  Text:   Text   as BlazeRenderer<ReactElement>["Text"],
  Action: Action as BlazeRenderer<ReactElement>["Action"],
  Input:  Input  as BlazeRenderer<ReactElement>["Input"],
};
