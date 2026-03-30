/**
 * @blazefw/email — Email renderer for UltimateJs semantic UI primitives.
 *
 * All functions return plain HTML strings (no React). Compose them by
 * passing pre-rendered strings as children, then wrap the result with
 * `wrapDocument` to get a full MSO-safe email HTML file.
 *
 * @example
 * ```ts
 * import { Stack, Text, Action, wrapDocument } from "@blazefw/email";
 *
 * const body = Stack({
 *   padding: 4,
 *   children: [
 *     Text({ variant: "heading", children: "Hello!" }),
 *     Text({ variant: "body",    children: "Welcome to UltimateJs." }),
 *     Action({ href: "https://example.com", children: "Get started" }),
 *   ],
 * });
 *
 * const html = wrapDocument(body, { title: "Welcome", previewText: "Hello!" });
 * ```
 */

export { Stack }          from "./Stack.js";
export { Text }           from "./Text.js";
export { Action }         from "./Action.js";
export { Input }          from "./Input.js";
export { emailRenderer }  from "./renderer.js";
export { wrapDocument }   from "./document.js";
export type { WrapDocumentOptions } from "./document.js";

// Expose the default theme palette.
export { DEFAULT_THEME }  from "./lib/tokens.js";
