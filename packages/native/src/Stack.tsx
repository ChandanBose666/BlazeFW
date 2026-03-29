import type { ReactElement } from "react";
import { View } from "react-native";
import type { StackProps, StackDirection, StackAlign, StackJustify } from "@ultimatejs/primitives";
import { resolveSpace, resolveColor, RADIUS_DP } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static maps hoisted outside the component
// ---------------------------------------------------------------------------

const FLEX_DIRECTION: Record<StackDirection, "row" | "column" | "row-reverse" | "column-reverse"> = {
  row:             "row",
  column:          "column",
  "row-reverse":   "row-reverse",
  "column-reverse":"column-reverse",
};

const ALIGN_ITEMS: Record<StackAlign, "flex-start" | "center" | "flex-end" | "stretch" | "baseline"> = {
  start:    "flex-start",
  center:   "center",
  end:      "flex-end",
  stretch:  "stretch",
  baseline: "baseline",
};

const JUSTIFY_CONTENT: Record<
  StackJustify,
  "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly"
> = {
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
 * Native implementation of the <Stack> primitive.
 * Renders as a <View> with React Native flex layout props.
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
}: StackProps): ReactElement {
  // Padding resolution — least-to-most specific (later assignments win)
  const baseP = resolveSpace(padding);
  let pt = baseP, pr = baseP, pb = baseP, pl = baseP;

  if (paddingX !== undefined) { pl = pr = resolveSpace(paddingX); }
  if (paddingY !== undefined) { pt = pb = resolveSpace(paddingY); }
  if (paddingTop !== undefined)    pt = resolveSpace(paddingTop);
  if (paddingRight !== undefined)  pr = resolveSpace(paddingRight);
  if (paddingBottom !== undefined) pb = resolveSpace(paddingBottom);
  if (paddingLeft !== undefined)   pl = resolveSpace(paddingLeft);

  const hasPadding = pt != null || pr != null || pb != null || pl != null;

  return (
    <View
      style={{
        flexDirection:  FLEX_DIRECTION[direction],
        alignItems:     ALIGN_ITEMS[align],
        justifyContent: JUSTIFY_CONTENT[justify],
        ...(gap !== undefined && { gap: resolveSpace(gap) }),
        ...(hasPadding && {
          paddingTop:    pt,
          paddingRight:  pr,
          paddingBottom: pb,
          paddingLeft:   pl,
        }),
        ...(background !== undefined && { backgroundColor: resolveColor(background) }),
        ...(radius !== undefined && { borderRadius: RADIUS_DP[radius] }),
        ...(wrap && { flexWrap: "wrap" as const }),
        ...(flex !== undefined && { flex }),
      }}
      accessibilityLabel={label}
      testID={testId}
    >
      {children as React.ReactNode}
    </View>
  );
}
