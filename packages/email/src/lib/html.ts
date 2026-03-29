/**
 * HTML utility helpers for the email renderer.
 *
 * escapeHtml    — escapes text content to prevent injection
 * escapeAttr    — escapes HTML attribute values
 * buildStyle    — converts a style map to an inline style string
 * stringify     — converts UltimateNode children to a plain HTML string
 */

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/** Escapes HTML special characters in text content nodes. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes double-quote characters inside HTML attribute values. */
export function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Inline style builder
// ---------------------------------------------------------------------------

/** Converts camelCase property names to kebab-case CSS property names. */
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

/**
 * Builds an inline style string from a plain object.
 * Undefined / null / empty-string values are omitted.
 *
 * @example
 * buildStyle({ fontSize: "16px", fontWeight: "600", color: undefined })
 * // → "font-size:16px;font-weight:600"
 */
export function buildStyle(styles: Record<string, string | number | undefined | null>): string {
  return Object.entries(styles)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${camelToKebab(k)}:${v as string}`)
    .join(";");
}

// ---------------------------------------------------------------------------
// Children serialisation
// ---------------------------------------------------------------------------

/**
 * Converts a UltimateNode tree into a flat HTML string.
 *
 * At email render time, children are always:
 *   - Strings / numbers (already-rendered HTML or text)
 *   - Arrays of the above
 *   - null / undefined / false (ignored)
 *
 * UltimateElement (the opaque { __ultimate: true } type) never appears at runtime
 * when using the email renderer — it is only used by React-based targets.
 */
export function stringify(children: unknown): string {
  if (children === null || children === undefined || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return (children as unknown[]).map(stringify).join("");
  return "";
}
