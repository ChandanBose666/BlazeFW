import type { ReactElement, ReactNode, CSSProperties } from "react";
import type { ActionProps, ActionVariant, ActionSize } from "@blazefw/primitives";
import { resolveSpace, resolveColor, RADIUS } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static style maps (rendering-hoist-jsx)
// ---------------------------------------------------------------------------

const BASE_STYLE: CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  fontWeight:     500,
  cursor:         "pointer",
  border:         "none",
  textDecoration: "none",
  fontFamily:     "inherit",
  lineHeight:     1,
  outline:        "none",
  transition:     "opacity 150ms ease, background-color 150ms ease",
};

const VARIANT_STYLES: Record<ActionVariant, CSSProperties> = {
  primary:   {
    backgroundColor: "var(--ultimate-primary)",
    color:           "var(--ultimate-primary-fg)",
  },
  secondary: {
    backgroundColor: "transparent",
    color:           "var(--ultimate-primary)",
    border:          "1px solid var(--ultimate-border)",
  },
  ghost:     {
    backgroundColor: "transparent",
    color:           "var(--ultimate-primary)",
  },
  danger:    {
    backgroundColor: "var(--ultimate-danger)",
    color:           "var(--ultimate-danger-fg, #fff)",
  },
  link:      {
    backgroundColor: "transparent",
    color:           "var(--ultimate-primary)",
    textDecoration:  "underline",
    padding:         "0",
  },
};

const SIZE_STYLES: Record<ActionSize, CSSProperties> = {
  xs: { fontSize: "0.75rem",  paddingTop: "4px",  paddingBottom: "4px",  paddingLeft: "8px",  paddingRight: "8px",  borderRadius: "4px" },
  sm: { fontSize: "0.875rem", paddingTop: "6px",  paddingBottom: "6px",  paddingLeft: "12px", paddingRight: "12px", borderRadius: "4px" },
  md: { fontSize: "1rem",     paddingTop: "8px",  paddingBottom: "8px",  paddingLeft: "16px", paddingRight: "16px", borderRadius: "6px" },
  lg: { fontSize: "1.125rem", paddingTop: "12px", paddingBottom: "12px", paddingLeft: "24px", paddingRight: "24px", borderRadius: "8px" },
};

const DISABLED_STYLE: CSSProperties = {
  opacity: 0.5,
  cursor:  "not-allowed",
  pointerEvents: "none",
};

// ---------------------------------------------------------------------------
// Spinner — defined at module level (rerender-no-inline-components)
// ---------------------------------------------------------------------------

function Spinner(): ReactElement {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        animation: "ultimate-spin 0.75s linear infinite",
        marginRight: "0.4em",
        flexShrink: 0,
      }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity={0.25} />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Web implementation of the <Action> primitive.
 *
 * Renders as <a> when `href` is provided, <button> otherwise.
 * The `link` variant skips size padding — use it for inline text links.
 */
export function Action({
  variant = "primary",
  size = "md",
  href,
  external,
  disabled,
  loading,
  onPress,
  background,
  color,
  padding,
  paddingX,
  paddingY,
  radius,
  fullWidth,
  label,
  testId,
  children,
  role,
  "aria-expanded":    ariaExpanded,
  "aria-pressed":     ariaPressed,
  "aria-haspopup":    ariaHaspopup,
  "aria-controls":    ariaControls,
  "aria-selected":    ariaSelected,
  "aria-hidden":      ariaHidden,
  "aria-describedby": ariaDescribedby,
  "aria-labelledby":  ariaLabelledby,
}: ActionProps): ReactElement {
  const isLink = href !== undefined;
  const isInteractive = !(disabled ?? false) && !(loading ?? false);

  // Compute padding overrides (only if any padding prop is set)
  const paddingOverride: CSSProperties = {};
  if (padding !== undefined) {
    const v = resolveSpace(padding);
    paddingOverride.paddingTop = paddingOverride.paddingBottom =
    paddingOverride.paddingLeft = paddingOverride.paddingRight = v;
  }
  if (paddingX !== undefined) {
    const v = resolveSpace(paddingX);
    paddingOverride.paddingLeft = v;
    paddingOverride.paddingRight = v;
  }
  if (paddingY !== undefined) {
    const v = resolveSpace(paddingY);
    paddingOverride.paddingTop = v;
    paddingOverride.paddingBottom = v;
  }

  const style: CSSProperties = {
    ...BASE_STYLE,
    ...VARIANT_STYLES[variant],
    // Link variant gets no size padding — it lives inline with text
    ...(variant !== "link" ? SIZE_STYLES[size] : {}),
    ...(radius !== undefined && { borderRadius: RADIUS[radius] }),
    ...(background !== undefined && { backgroundColor: resolveColor(background) }),
    ...(color !== undefined && { color: resolveColor(color) }),
    ...paddingOverride,
    ...(fullWidth && { width: "100%" }),
    ...((disabled ?? false) || (loading ?? false) ? DISABLED_STYLE : {}),
  };

  const sharedProps = {
    style,
    role,
    "aria-label":       label,
    "aria-disabled":    (disabled ?? false) || undefined,
    "aria-busy":        (loading ?? false) || undefined,
    "aria-expanded":    ariaExpanded,
    "aria-pressed":     ariaPressed,
    "aria-haspopup":    ariaHaspopup,
    "aria-controls":    ariaControls,
    "aria-selected":    ariaSelected,
    "aria-hidden":      ariaHidden,
    "aria-describedby": ariaDescribedby,
    "aria-labelledby":  ariaLabelledby,
    "data-testid":      testId,
  };

  const content = (
    <>
      {(loading ?? false) ? <Spinner /> : null}
      {children as ReactNode}
    </>
  );

  return isLink ? (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={isInteractive ? onPress : undefined}
      {...sharedProps}
    >
      {content}
    </a>
  ) : (
    <button
      type="button"
      disabled={disabled ?? false}
      onClick={isInteractive ? onPress : undefined}
      {...sharedProps}
    >
      {content}
    </button>
  );
}
