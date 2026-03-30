import type { StackProps } from "@blazefw/primitives";
import { resolveSpace, resolveColor, RADIUS_PX } from "./lib/tokens.js";
import { buildStyle, escapeAttr, stringify } from "./lib/html.js";

/**
 * Email implementation of the <Stack> primitive.
 *
 * Renders as a table-based layout — the only reliable way to control
 * spacing and background in email clients (including Outlook).
 *
 * Layout strategy:
 *   direction "column" (default) — single-column table; children stack vertically.
 *   direction "row" — children render side-by-side inside a single <tr>.
 *     For a true multi-column layout, pass each column as a pre-rendered
 *     Stack string wrapped in `<td>` — the row Stack places them in one row.
 *
 * gap — applied as bottom padding on the wrapping <td> for column layouts,
 *        or as right padding on each inline element for row layouts.
 *        Email clients do not reliably support the CSS `gap` property.
 */
export function Stack({
  direction = "column",
  align = "stretch",
  justify = "start",
  gap,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  background,
  radius,
  wrap: _wrap,     // flex-wrap has no email equivalent
  flex: _flex,     // flex-grow has no email equivalent
  label,
  testId,
  children,
  // role — overrides the default role="presentation" when semantic structure is needed
  role,
  // Dynamic ARIA props have no meaning in email clients — silently ignored
  "aria-live":        _ariaLive,
  "aria-atomic":      _ariaAtomic,
  "aria-hidden":      _ariaHidden,
  "aria-describedby": _ariaDescribedby,
  "aria-labelledby":  _ariaLabelledby,
}: StackProps): string {
  // --- Padding resolution (least-to-most specific) ---
  const baseP  = resolveSpace(padding);
  let pt = baseP, pr = baseP, pb = baseP, pl = baseP;

  if (paddingX !== undefined) { pl = pr = resolveSpace(paddingX); }
  if (paddingY !== undefined) { pt = pb = resolveSpace(paddingY); }
  if (paddingTop !== undefined)    pt = resolveSpace(paddingTop);
  if (paddingRight !== undefined)  pr = resolveSpace(paddingRight);
  if (paddingBottom !== undefined) pb = resolveSpace(paddingBottom);
  if (paddingLeft !== undefined)   pl = resolveSpace(paddingLeft);

  const gapValue = resolveSpace(gap);

  // Align / justify → table attributes + inline styles
  const valign =
    align === "start"  ? "top" :
    align === "end"    ? "bottom" :
    align === "center" ? "middle" : "top";

  const halign =
    justify === "center" ? "center" :
    justify === "end"    ? "right"  : "left";

  const tableStyle = buildStyle({
    width:           "100%",
    borderCollapse:  "collapse",
    backgroundColor: resolveColor(background),
    borderRadius:    radius !== undefined ? RADIUS_PX[radius] : undefined,
  });

  const tdStyle = buildStyle({
    paddingTop:    pt,
    paddingRight:  pr,
    paddingBottom: pb,
    paddingLeft:   pl,
    // For row layout, gap becomes right-padding between items
    ...(direction !== "column" && gapValue ? { paddingRight: gapValue } : {}),
    // For column layout, gap adds breathing room below the content block
    ...(direction === "column" && gapValue ? { paddingBottom: gapValue } : {}),
  });

  const content = stringify(children);

  // --- Row layout: children fill a single <tr>, expected to be <td> elements ---
  if (direction === "row" || direction === "row-reverse") {
    return [
      `<table role="${role ?? "presentation"}" width="100%" cellpadding="0" cellspacing="0" border="0"`,
      ` style="${tableStyle}"`,
      label   ? ` aria-label="${escapeAttr(label)}"` : "",
      testId  ? ` data-testid="${testId}"` : "",
      `>`,
      `<tr valign="${valign}" align="${halign}">`,
      content,
      `</tr>`,
      `</table>`,
    ].join("");
  }

  // --- Column layout (default): children stack in a single <td> ---
  return [
    `<table role="${role ?? "presentation"}" width="100%" cellpadding="0" cellspacing="0" border="0"`,
    ` style="${tableStyle}"`,
    label  ? ` aria-label="${label}"` : "",
    testId ? ` data-testid="${testId}"` : "",
    `>`,
    `<tr>`,
    `<td valign="${valign}" align="${halign}"`,
    tdStyle ? ` style="${tdStyle}"` : "",
    `>`,
    content,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("");
}
