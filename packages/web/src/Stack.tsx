import type { ReactElement, ReactNode, CSSProperties } from "react";
import type { StackProps, StackDirection, StackAlign, StackJustify } from "@blazefw/primitives";
import { resolveSpace, resolveColor, RADIUS } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Tailwind-free flex maps — resolved at render time to CSS property values
// ---------------------------------------------------------------------------

const FLEX_DIRECTION: Record<StackDirection, CSSProperties["flexDirection"]> = {
  row:            "row",
  column:         "column",
  "row-reverse":  "row-reverse",
  "column-reverse": "column-reverse",
};

const ALIGN_ITEMS: Record<StackAlign, CSSProperties["alignItems"]> = {
  start:    "flex-start",
  center:   "center",
  end:      "flex-end",
  stretch:  "stretch",
  baseline: "baseline",
};

const JUSTIFY_CONTENT: Record<StackJustify, CSSProperties["justifyContent"]> = {
  start:   "flex-start",
  center:  "center",
  end:     "flex-end",
  between: "space-between",
  around:  "space-around",
  evenly:  "space-evenly",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Web implementation of the <Stack> primitive.
 * Renders as a <div> with flexbox styles derived from the prop token system.
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
  wrap,
  flex,
  label,
  testId,
  children,
  role,
  "aria-live":        ariaLive,
  "aria-atomic":      ariaAtomic,
  "aria-hidden":      ariaHidden,
  "aria-describedby": ariaDescribedby,
  "aria-labelledby":  ariaLabelledby,
}: StackProps): ReactElement {
  // --- Padding resolution (least-to-most specific, later writes win) ---
  const pt_base = resolveSpace(padding);
  let pt = pt_base, pr = pt_base, pb = pt_base, pl = pt_base;

  if (paddingX !== undefined) { pl = pr = resolveSpace(paddingX); }
  if (paddingY !== undefined) { pt = pb = resolveSpace(paddingY); }
  if (paddingTop !== undefined)    pt = resolveSpace(paddingTop);
  if (paddingRight !== undefined)  pr = resolveSpace(paddingRight);
  if (paddingBottom !== undefined) pb = resolveSpace(paddingBottom);
  if (paddingLeft !== undefined)   pl = resolveSpace(paddingLeft);

  const hasPadding = pt || pr || pb || pl;

  const style: CSSProperties = {
    display:         "flex",
    flexDirection:   FLEX_DIRECTION[direction],
    alignItems:      ALIGN_ITEMS[align],
    justifyContent:  JUSTIFY_CONTENT[justify],
    ...(gap !== undefined && { gap: resolveSpace(gap) }),
    ...(hasPadding && {
      paddingTop:    pt,
      paddingRight:  pr,
      paddingBottom: pb,
      paddingLeft:   pl,
    }),
    ...(background !== undefined && { backgroundColor: resolveColor(background) }),
    ...(radius !== undefined && { borderRadius: RADIUS[radius] }),
    ...(wrap && { flexWrap: "wrap" }),
    ...(flex !== undefined && { flex }),
  };

  return (
    <div
      style={style}
      role={role}
      aria-label={label}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      aria-hidden={ariaHidden}
      aria-describedby={ariaDescribedby}
      aria-labelledby={ariaLabelledby}
      data-testid={testId}
    >
      {children as ReactNode}
    </div>
  );
}
